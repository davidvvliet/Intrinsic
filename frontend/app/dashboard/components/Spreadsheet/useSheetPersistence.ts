import { useEffect, useCallback, useRef } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import { useSheetRouter } from '../../hooks/useSheetRouter';
import { useRefContext } from './RefContext';
import { NUM_ROWS, NUM_COLS, AUTO_SAVE_DELAY_MS } from './config';
import type { CellFormat, CellType } from './types';

export function useSheetPersistence() {
  const { fetchWithAuth } = useAuthFetch();
  const { updateSheetName, markSheetSaved } = useSheetRouter();
  const { containerRef } = useRefContext();
  const hasLoadedAllRef = useRef<string | null>(null); // tracks workspaceId that was bulk-loaded
  const prevActiveSheetIdRef = useRef<string | null>(null);

  // Subscribe to store state
  const cellData = useSpreadsheetStore(state => state.cellData);
  const cellFormat = useSpreadsheetStore(state => state.cellFormat);
  const dirtyCells = useSpreadsheetStore(state => state.dirtyCells);
  const dirtySettings = useSpreadsheetStore(state => state.dirtySettings);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const sheets = useSpreadsheetStore(state => state.sheets);
  const workspaceId = useSpreadsheetStore(state => state.workspaceId);
  const columnWidthsBySheet = useSpreadsheetStore(state => state.columnWidthsBySheet);
  const frozenRowsBySheet = useSpreadsheetStore(state => state.frozenRowsBySheet);
  const frozenColumnsBySheet = useSpreadsheetStore(state => state.frozenColumnsBySheet);

  // Get actions from store
  const markSaved = useSpreadsheetStore(state => state.markSaved);
  const setCellData = useSpreadsheetStore(state => state.setCellData);
  const setCellFormat = useSpreadsheetStore(state => state.setCellFormat);
  const setBaselineData = useSpreadsheetStore(state => state.setBaselineData);
  const setBaselineFormat = useSpreadsheetStore(state => state.setBaselineFormat);
  const setDirtyCells = useSpreadsheetStore(state => state.setDirtyCells);
  const setSelection = useSpreadsheetStore(state => state.setSelection);
  const setHighlightedCells = useSpreadsheetStore(state => state.setHighlightedCells);
  const setInputValue = useSpreadsheetStore(state => state.setInputValue);
  const setIsEditing = useSpreadsheetStore(state => state.setIsEditing);
  const setCopiedRange = useSpreadsheetStore(state => state.setCopiedRange);
  const setColumnWidthsBySheet = useSpreadsheetStore(state => state.setColumnWidthsBySheet);
  const setFrozenRowsBySheet = useSpreadsheetStore(state => state.setFrozenRowsBySheet);
  const setFrozenColumnsBySheet = useSpreadsheetStore(state => state.setFrozenColumnsBySheet);
  const setSheetCellData = useSpreadsheetStore(state => state.setSheetCellData);
  const setSheetCellFormat = useSpreadsheetStore(state => state.setSheetCellFormat);
  const setScrollPosition = useSpreadsheetStore(state => state.setScrollPosition);
  const recalculateFormulas = useSpreadsheetStore(state => state.recalculateFormulas);

  // Check if active sheet has been saved
  const activeSheet = sheets.find(s => s.sheetId === activeSheetId);
  const isActiveSheetSaved = activeSheet?.isSaved ?? false;

  // Convert Maps to JSON format for API
  const serializeSheetData = useCallback(() => {
    const cells: Record<string, { raw: string; type: CellType }> = {};
    cellData.forEach((value, key) => {
      cells[key] = {
        raw: value.raw,
        type: value.type,
      };
    });

    const formatting: Record<string, CellFormat> = {};
    cellFormat.forEach((format, key) => {
      formatting[key] = format;
    });

    const sheetForName = sheets.find(s => s.sheetId === activeSheetId);
    const name = sheetForName?.name || 'Untitled';

    const columnWidthsForSheet = columnWidthsBySheet.get(activeSheetId || '') || new Map();
    const frozenRows = frozenRowsBySheet.get(activeSheetId || '') || 0;
    const frozenColumns = frozenColumnsBySheet.get(activeSheetId || '') || 0;
    const columnWidthsArray: [number, number][] = Array.from(columnWidthsForSheet.entries());

    // Extract preview_data if this is the first sheet (A1:F10)
    let preview_data: Record<string, { raw: string; type: string; format?: CellFormat }> | undefined;
    if (sheets.length > 0 && sheets[0].sheetId === activeSheetId) {
      preview_data = {};
      cellData.forEach((value, key) => {
        const [rowStr, colStr] = key.split(',');
        const row = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);
        if (row < 10 && col < 6) {
          const format = cellFormat.get(key);
          preview_data![key] = {
            raw: value.raw,
            type: value.type,
            ...(format && { format }),
          };
        }
      });
    }

    return {
      cells,
      dimensions: { rows: NUM_ROWS, cols: NUM_COLS },
      settings: {
        columnWidths: columnWidthsArray,
        frozenRows,
        frozenColumns,
      },
      formatting,
      name,
      preview_data,
    };
  }, [cellData, cellFormat, sheets, activeSheetId, columnWidthsBySheet, frozenRowsBySheet, frozenColumnsBySheet]);

  // Save sheet to server
  const saveBatch = useCallback(async () => {
    if (dirtyCells.size === 0 && !dirtySettings) return;
    if (!activeSheetId) return;

    const sheetData = serializeSheetData();

    if (!isActiveSheetSaved) {
      // First save - create new sheet with client-generated ID
      const response = await fetchWithAuth('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sheetData, id: activeSheetId, workspace_id: workspaceId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create sheet: ${response.statusText}`);
      }

      markSheetSaved(activeSheetId);
    } else {
      // Update existing sheet
      const response = await fetchWithAuth(`/api/sheets/${activeSheetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save sheet: ${response.statusText}`);
      }
    }

    markSaved();
  }, [dirtyCells, dirtySettings, activeSheetId, isActiveSheetSaved, serializeSheetData, markSaved, markSheetSaved, fetchWithAuth, workspaceId]);

  // Deserialize a single sheet's API response into CellData and settings
  const deserializeSheet = useCallback((data: any, sheetId: string) => {
    const newCellData = new Map<string, { raw: string; type: CellType }>();
    if (data.cells) {
      Object.entries(data.cells).forEach(([key, value]: [string, any]) => {
        newCellData.set(key, { raw: value.raw, type: value.type });
      });
    }

    const newCellFormat = new Map<string, CellFormat>();
    if (data.formatting) {
      Object.entries(data.formatting).forEach(([key, format]: [string, any]) => {
        newCellFormat.set(key, format as CellFormat);
      });
    }

    // Deserialize settings
    if (data.settings) {
      if (data.settings.columnWidths) {
        const widthsMap = new Map<number, number>(data.settings.columnWidths);
        setColumnWidthsBySheet(prev => {
          const next = new Map(prev);
          next.set(sheetId, widthsMap);
          return next;
        });
      }

      if (typeof data.settings.frozenRows === 'number') {
        setFrozenRowsBySheet(prev => {
          const next = new Map(prev);
          next.set(sheetId, data.settings.frozenRows);
          return next;
        });
      }

      if (typeof data.settings.frozenColumns === 'number') {
        setFrozenColumnsBySheet(prev => {
          const next = new Map(prev);
          next.set(sheetId, data.settings.frozenColumns);
          return next;
        });
      }
    }

    return { cellData: newCellData, cellFormat: newCellFormat };
  }, [setColumnWidthsBySheet, setFrozenRowsBySheet, setFrozenColumnsBySheet]);

  // Load ALL sheets for the workspace into allSheetsData
  useEffect(() => {
    if (!workspaceId) return;
    if (!activeSheetId) return;
    if (sheets.length === 0) return;
    if (hasLoadedAllRef.current === workspaceId) return;

    hasLoadedAllRef.current = workspaceId;

    const loadAllSheets = async () => {
      // Fetch each sheet that has been saved to the backend
      const savedSheets = sheets.filter(s => s.isSaved);

      const results = await Promise.all(
        savedSheets.map(async (sheet) => {
          try {
            const response = await fetchWithAuth(`/api/sheets/${sheet.sheetId}`, { method: 'GET' });
            if (!response.ok) return { sheetId: sheet.sheetId, data: null, name: null };
            const result = await response.json();
            return { sheetId: sheet.sheetId, data: result.data, name: result.name };
          } catch {
            return { sheetId: sheet.sheetId, data: null, name: null };
          }
        })
      );

      // Process each sheet's data
      // Set active sheet's cellData FIRST so formula engine sees it when allSheetsData triggers recalc
      for (const result of results) {
        if (!result.data) continue;
        if (result.sheetId === activeSheetId) {
          const { cellData: sheetCells, cellFormat: sheetFormat } = deserializeSheet(result.data, result.sheetId);
          setCellData(sheetCells);
          setCellFormat(sheetFormat);
          setBaselineData(new Map(sheetCells));
          setBaselineFormat(new Map(sheetFormat));
          setDirtyCells(new Set());
        }
      }

      for (const result of results) {
        if (!result.data) continue;

        const { cellData: sheetCells, cellFormat: sheetFormat } = deserializeSheet(result.data, result.sheetId);

        // Store in allSheetsData and allSheetsFormat
        setSheetCellData(result.sheetId, sheetCells);
        setSheetCellFormat(result.sheetId, sheetFormat);

        // Update sheet name from backend
        if (result.name) {
          updateSheetName(result.sheetId, result.name);
        }
      }

      // For unsaved sheets, store empty data
      for (const sheet of sheets) {
        if (!sheet.isSaved) {
          setSheetCellData(sheet.sheetId, new Map());
          setSheetCellFormat(sheet.sheetId, new Map());
        }
      }

      // Recalculate all formulas now that all data is loaded
      recalculateFormulas();

      prevActiveSheetIdRef.current = activeSheetId;
    };

    loadAllSheets().catch(err => {
      console.error('Failed to load all sheets:', err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, activeSheetId, sheets]);

  // Handle tab switch: swap cellData from allSheetsData
  useEffect(() => {
    if (!activeSheetId) return;
    if (!hasLoadedAllRef.current) return; // Wait for bulk load to finish
    if (prevActiveSheetIdRef.current === activeSheetId) return;

    const prevSheetId = prevActiveSheetIdRef.current;
    prevActiveSheetIdRef.current = activeSheetId;

    // Save scroll position for the sheet we're leaving
    if (prevSheetId && containerRef.current) {
      setScrollPosition(prevSheetId, containerRef.current.scrollLeft, containerRef.current.scrollTop);
    }

    // Snapshot current cellData and cellFormat into allSheets for the sheet we're leaving
    if (prevSheetId) {
      const state = useSpreadsheetStore.getState();
      setSheetCellData(prevSheetId, state.cellData);
      setSheetCellFormat(prevSheetId, state.cellFormat);
    }

    // Load the new sheet's data and format from allSheets
    const state = useSpreadsheetStore.getState();
    const newSheetData = state.allSheetsData.get(activeSheetId) || new Map();
    const newSheetFormat = state.allSheetsFormat.get(activeSheetId) || new Map();

    setCellData(newSheetData);
    setBaselineData(new Map(newSheetData));
    setCellFormat(newSheetFormat);
    setBaselineFormat(new Map(newSheetFormat));
    setDirtyCells(new Set());

    // Clear UI state
    setSelection(null);
    setHighlightedCells(null);
    setInputValue('');
    setIsEditing(false);
    setCopiedRange(null);

    // Restore scroll position for the new sheet
    const savedScroll = useSpreadsheetStore.getState().scrollPositionBySheet.get(activeSheetId);
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo(savedScroll?.left ?? 0, savedScroll?.top ?? 0);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheetId]);

  // Auto-save
  useEffect(() => {
    if (dirtyCells.size === 0 && !dirtySettings) return;

    const timer = setTimeout(() => {
      saveBatch().catch(err => {
        console.error('Auto-save failed:', err);
      });
    }, AUTO_SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [dirtyCells, dirtySettings, saveBatch]);
}
