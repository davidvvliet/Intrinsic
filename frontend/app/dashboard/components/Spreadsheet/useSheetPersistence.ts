import { useEffect, useCallback, useRef } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import { useSheetRouter } from '../../hooks/useSheetRouter';
import { NUM_ROWS, NUM_COLS, AUTO_SAVE_DELAY_MS } from './config';
import type { CellFormat, CellType } from './types';

export function useSheetPersistence() {
  const { fetchWithAuth } = useAuthFetch();
  const { updateFetchId, updateSheetName } = useSheetRouter();
  const hasLoadedRef = useRef<string | null>(null);

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

  // Get current sheet's fetchId
  const activeSheet = sheets.find(s => s.sheetId === activeSheetId);
  const currentFetchId = activeSheet?.fetchId || null;

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
    let returnedFetchId: string;

    if (!currentFetchId) {
      // First save - create new sheet
      const response = await fetchWithAuth('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sheetData, workspace_id: workspaceId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create sheet: ${response.statusText}`);
      }

      const result = await response.json();
      returnedFetchId = result.id;

      // Update fetchId via router hook
      updateFetchId(activeSheetId, returnedFetchId);
    } else {
      // Update existing sheet
      const response = await fetchWithAuth(`/api/sheets/${currentFetchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save sheet: ${response.statusText}`);
      }

      returnedFetchId = currentFetchId;
    }

    markSaved();
  }, [dirtyCells, dirtySettings, activeSheetId, currentFetchId, serializeSheetData, markSaved, updateFetchId, fetchWithAuth]);

  // Load sheet from server
  const loadSheet = useCallback(async (fetchIdToLoad: string) => {
    const response = await fetchWithAuth(`/api/sheets/${fetchIdToLoad}`, {
      method: 'GET',
    });

    if (!response.ok) {
      if (response.status === 404) return;
      console.error('Failed to load sheet:', { fetchId: fetchIdToLoad, status: response.status });
      throw new Error(`Failed to load sheet: ${response.status}`);
    }

    const sheet = await response.json();
    const data = sheet.data;
    const backendName = sheet.name;

    // Deserialize cells
    const newCellData = new Map<string, { raw: string; type: CellType }>();
    if (data.cells) {
      Object.entries(data.cells).forEach(([key, value]: [string, any]) => {
        newCellData.set(key, { raw: value.raw, type: value.type });
      });
    }

    // Deserialize formatting
    const newCellFormat = new Map<string, CellFormat>();
    if (data.formatting) {
      Object.entries(data.formatting).forEach(([key, format]: [string, any]) => {
        newCellFormat.set(key, format as CellFormat);
      });
    }

    // Deserialize settings
    if (data.settings && activeSheetId) {
      if (data.settings.columnWidths) {
        const widthsMap = new Map<number, number>(data.settings.columnWidths);
        setColumnWidthsBySheet(prev => {
          const next = new Map(prev);
          next.set(activeSheetId, widthsMap);
          return next;
        });
      }

      if (typeof data.settings.frozenRows === 'number') {
        setFrozenRowsBySheet(prev => {
          const next = new Map(prev);
          next.set(activeSheetId, data.settings.frozenRows);
          return next;
        });
      }

      if (typeof data.settings.frozenColumns === 'number') {
        setFrozenColumnsBySheet(prev => {
          const next = new Map(prev);
          next.set(activeSheetId, data.settings.frozenColumns);
          return next;
        });
      }
    }

    // Set state
    setCellData(newCellData);
    setCellFormat(newCellFormat);
    setBaselineData(new Map(newCellData));
    setBaselineFormat(new Map(newCellFormat));
    setDirtyCells(new Set());

    // Clear UI state
    setSelection(null);
    setHighlightedCells(null);
    setInputValue('');
    setIsEditing(false);
    setCopiedRange(null);

    // Update sheet name from backend
    if (backendName) {
      updateSheetName(fetchIdToLoad, backendName);
    }
  }, [activeSheetId, setCellData, setCellFormat, setBaselineData, setBaselineFormat, setDirtyCells, setSelection, setHighlightedCells, setInputValue, setIsEditing, setCopiedRange, setColumnWidthsBySheet, setFrozenRowsBySheet, setFrozenColumnsBySheet, updateSheetName, fetchWithAuth]);

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

  // Load data when activeSheetId changes
  useEffect(() => {
    if (!activeSheetId) return;
    if (hasLoadedRef.current === activeSheetId) return;

    const sheet = sheets.find(s => s.sheetId === activeSheetId);
    if (!sheet) return;

    hasLoadedRef.current = activeSheetId;

    // Clear cell data immediately
    setCellData(new Map());
    setCellFormat(new Map());
    setBaselineData(new Map());
    setBaselineFormat(new Map());
    setDirtyCells(new Set());
    setSelection(null);
    setHighlightedCells(null);
    setInputValue('');
    setIsEditing(false);
    setCopiedRange(null);

    if (sheet.fetchId) {
      loadSheet(sheet.fetchId).catch(err => {
        console.error('Load sheet failed:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheetId]);
}
