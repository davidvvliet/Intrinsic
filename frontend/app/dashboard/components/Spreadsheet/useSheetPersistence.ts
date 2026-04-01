import { useEffect, useCallback, useRef } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import { useSheetRouter } from '../../hooks/useSheetRouter';
import { useRefContext } from './RefContext';
import { NUM_ROWS, NUM_COLS, AUTO_SAVE_DELAY_MS } from './config';
import type { CellFormat, CellType } from './types';
import type { ChartConfig } from './chartDataResolver';

export function useSheetPersistence() {
  const { fetchWithAuth } = useAuthFetch();
  const { updateSheetName, markSheetSaved } = useSheetRouter();
  const { containerRef } = useRefContext();
  const loadedSheetKeyRef = useRef<string | null>(null); // set after fetch completes — gates tab-switch logic
  const loadingSheetKeyRef = useRef<string | null>(null); // set before fetch starts — prevents duplicate fetches
  const prevActiveSheetIdRef = useRef<string | null>(null);

  // Subscribe to store state
  const dirtySheets = useSpreadsheetStore(state => state.dirtySheets);
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
  const setChartsBySheet = useSpreadsheetStore(state => state.setChartsBySheet);

  // Convert Maps to JSON format for API — works for any sheet
  const serializeSheetData = useCallback((sheetId: string) => {
    const state = useSpreadsheetStore.getState();

    // Use cellData for active sheet (it's the live copy), allSheetsData for others
    const sheetCellData = sheetId === state.activeSheetId
      ? state.cellData
      : (state.allSheetsData.get(sheetId) || new Map());
    const sheetCellFormat = sheetId === state.activeSheetId
      ? state.cellFormat
      : (state.allSheetsFormat.get(sheetId) || new Map());

    const cells: Record<string, { raw: string; type: CellType }> = {};
    sheetCellData.forEach((value, key) => {
      cells[key] = {
        raw: value.raw,
        type: value.type,
      };
    });

    const formatting: Record<string, CellFormat> = {};
    sheetCellFormat.forEach((format, key) => {
      formatting[key] = format;
    });

    const sheetForName = sheets.find(s => s.sheetId === sheetId);
    const name = sheetForName?.name || 'Untitled';

    const columnWidthsForSheet = columnWidthsBySheet.get(sheetId) || new Map();
    const frozenRows = frozenRowsBySheet.get(sheetId) || 0;
    const frozenColumns = frozenColumnsBySheet.get(sheetId) || 0;
    const columnWidthsArray: [number, number][] = Array.from(columnWidthsForSheet.entries());

    // Extract preview_data if this is the first sheet (A1:F10)
    let preview_data: Record<string, { raw: string; type: string; format?: CellFormat }> | undefined;
    if (sheets.length > 0 && sheets[0].sheetId === sheetId) {
      preview_data = {};
      sheetCellData.forEach((value, key) => {
        const [rowStr, colStr] = key.split(',');
        const row = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);
        if (row < 10 && col < 6) {
          const format = sheetCellFormat.get(key);
          preview_data![key] = {
            raw: value.raw,
            type: value.type,
            ...(format && { format }),
          };
        }
      });
    }

    const charts = state.chartsBySheet.get(sheetId) || [];

    return {
      cells,
      dimensions: { rows: NUM_ROWS, cols: NUM_COLS },
      settings: {
        columnWidths: columnWidthsArray,
        frozenRows,
        frozenColumns,
      },
      formatting,
      charts,
      name,
      preview_data,
    };
  }, [sheets, columnWidthsBySheet, frozenRowsBySheet, frozenColumnsBySheet]);

  // Save dirty sheets to server
  const saveBatch = useCallback(async () => {
    if (dirtySheets.size === 0) return;

    const sheetsToSave = Array.from(dirtySheets);
    const savedIds: string[] = [];

    for (const sheetId of sheetsToSave) {
      const sheetData = serializeSheetData(sheetId);
      const sheet = sheets.find(s => s.sheetId === sheetId);
      const isSaved = sheet?.isSaved ?? false;

      try {
        if (!isSaved) {
          // First save - create new sheet with client-generated ID
          const response = await fetchWithAuth('/api/sheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...sheetData, id: sheetId, workspace_id: workspaceId }),
          });

          if (!response.ok) {
            throw new Error(`Failed to create sheet: ${response.statusText}`);
          }

          markSheetSaved(sheetId);
        } else {
          // Update existing sheet
          const response = await fetchWithAuth(`/api/sheets/${sheetId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sheetData),
          });

          if (!response.ok) {
            throw new Error(`Failed to save sheet: ${response.statusText}`);
          }
        }

        savedIds.push(sheetId);
      } catch (err) {
        console.error(`Auto-save failed for sheet ${sheetId}:`, err);
      }
    }

    if (savedIds.length > 0) {
      markSaved(savedIds);
    }
  }, [dirtySheets, sheets, serializeSheetData, markSaved, markSheetSaved, fetchWithAuth, workspaceId]);

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

    // Deserialize charts
    if (data.charts && Array.isArray(data.charts)) {
      setChartsBySheet(prev => {
        const next = new Map(prev);
        next.set(sheetId, data.charts as ChartConfig[]);
        return next;
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
  }, [setColumnWidthsBySheet, setFrozenRowsBySheet, setFrozenColumnsBySheet, setChartsBySheet]);

  // Load ALL sheets for the workspace into allSheetsData
  useEffect(() => {
    if (!workspaceId) return;
    if (!activeSheetId) return;
    if (sheets.length === 0) return;
    const sheetKey = workspaceId + ':' + sheets.map(s => s.sheetId).sort().join(',');
    if (loadedSheetKeyRef.current === sheetKey) return;
    if (loadingSheetKeyRef.current === sheetKey) return;
    loadingSheetKeyRef.current = sheetKey;

    const loadAllSheets = async () => {
      // Fetch each sheet that has been saved to the backend
      const savedSheets = sheets.filter(s => s.isSaved);

      console.log('[loadAllSheets] starting, activeSheetId:', activeSheetId, 'sheets:', savedSheets.map(s => s.sheetId));
      const results = await Promise.all(
        savedSheets.map(async (sheet) => {
          try {
            const response = await fetchWithAuth(`/api/sheets/${sheet.sheetId}`, { method: 'GET' });
            if (!response.ok) {
              console.warn('[loadAllSheets] fetch not ok for', sheet.sheetId, 'status:', response.status);
              return { sheetId: sheet.sheetId, data: null, name: null };
            }
            const result = await response.json();
            const fmtCount = result.data?.formatting ? Object.keys(result.data.formatting).length : 0;
            console.log('[loadAllSheets] fetched', sheet.sheetId, 'cells:', result.data?.cells ? Object.keys(result.data.cells).length : 0, 'formatting:', fmtCount);
            return { sheetId: sheet.sheetId, data: result.data, name: result.name };
          } catch (err) {
            console.error('[loadAllSheets] fetch error for', sheet.sheetId, err);
            return { sheetId: sheet.sheetId, data: null, name: null };
          }
        })
      );

      // Process each sheet's data
      // Set active sheet's cellData FIRST so formula engine sees it when allSheetsData triggers recalc
      let foundActiveSheet = false;
      for (const result of results) {
        if (!result.data) continue;
        if (result.sheetId === activeSheetId) {
          foundActiveSheet = true;
          const { cellData: sheetCells, cellFormat: sheetFormat } = deserializeSheet(result.data, result.sheetId);
          console.log('[loadAllSheets] setting active sheet data, sheetId:', result.sheetId, 'cells:', sheetCells.size, 'format:', sheetFormat.size);
          setCellData(sheetCells);
          setCellFormat(sheetFormat);
        }
      }
      if (!foundActiveSheet) {
        console.warn('[loadAllSheets] active sheet NOT found in results! activeSheetId:', activeSheetId, 'result sheetIds:', results.map(r => r.sheetId));
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

      // Data is ready — allow tab-switch logic
      loadedSheetKeyRef.current = sheetKey;
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
    if (!loadedSheetKeyRef.current) return; // Wait for bulk load to finish
    if (prevActiveSheetIdRef.current === activeSheetId) return;
    const switchState = useSpreadsheetStore.getState();
    const switchFmtSize = switchState.allSheetsFormat.get(activeSheetId)?.size ?? 0;
    console.log('[tab-switch] switching to', activeSheetId, 'from', prevActiveSheetIdRef.current, 'allSheetsFormat has', switchFmtSize, 'entries for this sheet');

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
    setCellFormat(newSheetFormat);

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
    if (dirtySheets.size === 0) return;

    const timer = setTimeout(() => {
      saveBatch().catch(err => {
        console.error('Auto-save failed:', err);
      });
    }, AUTO_SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [dirtySheets, saveBatch]);
}
