import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import { NUM_ROWS, NUM_COLS, AUTO_SAVE_DELAY_MS } from './config';
import type { CellFormat, CellType } from './types';

export function useSheetPersistence() {
  const { fetchWithAuth } = useAuthFetch();
  const hasLoadedRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Subscribe to store state
  const cellData = useSpreadsheetStore(state => state.cellData);
  const cellFormat = useSpreadsheetStore(state => state.cellFormat);
  const dirtyCells = useSpreadsheetStore(state => state.dirtyCells);
  const dirtySettings = useSpreadsheetStore(state => state.dirtySettings);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const sheets = useSpreadsheetStore(state => state.sheets);
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
  const setSheets = useSpreadsheetStore(state => state.setSheets);
  const setColumnWidthsBySheet = useSpreadsheetStore(state => state.setColumnWidthsBySheet);
  const setFrozenRowsBySheet = useSpreadsheetStore(state => state.setFrozenRowsBySheet);
  const setFrozenColumnsBySheet = useSpreadsheetStore(state => state.setFrozenColumnsBySheet);

  // Get sheet ID from URL (don't generate until first save)
  const sheetIdFromUrl = searchParams.get('sheet');

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

    // Get current sheet name
    const activeSheet = sheets.find(s => s.sheetId === activeSheetId);
    const name = activeSheet?.name || 'Untitled';

    // Get per-sheet settings
    const columnWidthsForSheet = columnWidthsBySheet.get(activeSheetId || '') || new Map();
    const frozenRows = frozenRowsBySheet.get(activeSheetId || '') || 0;
    const frozenColumns = frozenColumnsBySheet.get(activeSheetId || '') || 0;

    // Convert columnWidths Map to array format for JSON
    const columnWidthsArray: [number, number][] = Array.from(columnWidthsForSheet.entries());

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
    };
  }, [cellData, cellFormat, sheets, activeSheetId, columnWidthsBySheet, frozenRowsBySheet, frozenColumnsBySheet]);

  // Save batch of dirty cells to server
  const saveBatch = useCallback(async () => {
    if (dirtyCells.size === 0 && !dirtySettings) return;

    const sheetData = serializeSheetData();

    let response: Response;
    let returnedSheetId: string;

    if (!sheetIdFromUrl) {
      // First save - create new sheet via POST
      response = await fetchWithAuth('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create sheet: ${response.statusText}`);
      }

      const result = await response.json();
      returnedSheetId = result.id;
    } else {
      // Update existing sheet via PUT
      response = await fetchWithAuth(`/api/sheets/${sheetIdFromUrl}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save sheet: ${response.statusText}`);
      }

      const result = await response.json();
      returnedSheetId = result.id;
    }

    // Mark as saved after successful save
    markSaved();

    // Update URL with sheet ID (from response for new sheets, or existing for updates)
    router.replace(`/dashboard?sheet=${returnedSheetId}`);

    // Update fetchId in localStorage for the active sheet
    if (activeSheetId) {
      try {
        const stored = localStorage.getItem('spreadsheet_sheets');
        if (stored) {
        const sheets = JSON.parse(stored);
        const activeSheetIndex = sheets.findIndex((s: { sheetId: string }) => s.sheetId === activeSheetId);
        if (activeSheetIndex !== -1) {
          sheets[activeSheetIndex].fetchId = returnedSheetId;
          localStorage.setItem('spreadsheet_sheets', JSON.stringify(sheets));
          
          // Also update React state
          setSheets(prevSheets => {
            const updated = [...prevSheets];
            const index = updated.findIndex(s => s.sheetId === activeSheetId);
            if (index !== -1) {
              updated[index] = { ...updated[index], fetchId: returnedSheetId };
            }
            return updated;
          });
        }
        }
      } catch (err) {
        console.error('Failed to update fetchId in localStorage:', err);
      }
    }
  }, [dirtyCells, dirtySettings, serializeSheetData, markSaved, sheetIdFromUrl, router, activeSheetId, setSheets, fetchWithAuth]);

  // Load sheet from server
  const loadSheet = useCallback(async (sheetIdToLoad: string) => {
    const response = await fetchWithAuth(`/api/sheets/${sheetIdToLoad}`, {
      method: 'GET',
    });

    if (!response.ok) {
      // If sheet doesn't exist (404), that's fine - it's a new sheet
      if (response.status === 404) {
        return;
      }
      // Log full error details for debugging
      console.error('Failed to load sheet:', {
        sheetId: sheetIdToLoad,
        status: response.status,
        statusText: response.statusText,
      });
      // Try to get error body
      try {
        const errorBody = await response.text();
        console.error('Error response body:', errorBody);
      } catch (e) {
        // Ignore if can't read body
      }
      throw new Error(`Failed to load sheet: ${response.status} ${response.statusText}`);
    }

    const sheet = await response.json();
    const data = sheet.data;
    const backendName = sheet.name;

    // Deserialize cells
    const newCellData = new Map<string, { raw: string; type: CellType }>();
    if (data.cells) {
      Object.entries(data.cells).forEach(([key, value]: [string, any]) => {
        newCellData.set(key, {
          raw: value.raw,
          type: value.type,
        });
      });
    }

    // Deserialize formatting
    const newCellFormat = new Map<string, CellFormat>();
    if (data.formatting) {
      Object.entries(data.formatting).forEach(([key, format]: [string, any]) => {
        newCellFormat.set(key, format as CellFormat);
      });
    }

    // Deserialize settings (columnWidths, freeze panes)
    if (data.settings && activeSheetId) {
      // Restore columnWidths for this sheet
      if (data.settings.columnWidths) {
        const widthsMap = new Map<number, number>(data.settings.columnWidths);
        setColumnWidthsBySheet(prev => {
          const next = new Map(prev);
          next.set(activeSheetId, widthsMap);
          return next;
        });
      }

      // Restore freeze panes for this sheet
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

    // Set current state
    setCellData(newCellData);
    setCellFormat(newCellFormat);

    // Set baseline (what was loaded = last saved state)
    setBaselineData(new Map(newCellData));
    setBaselineFormat(new Map(newCellFormat));

    // Clear dirty cells
    setDirtyCells(new Set());

    // Clear UI state
    setSelection(null);
    setHighlightedCells(null);
    setInputValue('');
    setIsEditing(false);
    setCopiedRange(null);

    // Update URL to match loaded sheet
    router.replace(`/dashboard?sheet=${sheetIdToLoad}`);

    // Update sheet name from backend if it differs
    if (backendName) {
      setSheets(prevSheets => {
        const updated = prevSheets.map(s => {
          if (s.fetchId === sheetIdToLoad && s.name !== backendName) {
            return { ...s, name: backendName };
          }
          return s;
        });
        // Also update localStorage
        localStorage.setItem('spreadsheet_sheets', JSON.stringify(updated));
        return updated;
      });
    }
  }, [activeSheetId, setCellData, setCellFormat, setBaselineData, setBaselineFormat, setDirtyCells, setSelection, setHighlightedCells, setInputValue, setIsEditing, setCopiedRange, router, setSheets, setColumnWidthsBySheet, setFrozenRowsBySheet, setFrozenColumnsBySheet, fetchWithAuth]);

  // Auto-save: debounced save after delay of inactivity
  useEffect(() => {
    if (dirtyCells.size === 0 && !dirtySettings) return;

    const timer = setTimeout(() => {
      saveBatch().catch(err => {
        console.error('Auto-save failed:', err);
      });
    }, AUTO_SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [dirtyCells, dirtySettings, saveBatch]);

  // Watch activeSheetId and load data when it changes
  useEffect(() => {
    if (!activeSheetId) return;

    // Skip if we already loaded this sheet (prevents reload on token refresh)
    if (hasLoadedRef.current === activeSheetId) return;

    // Find active sheet from state
    const activeSheet = sheets.find(s => s.sheetId === activeSheetId);

    if (!activeSheet) return;

    // Mark as loaded for this sheet
    hasLoadedRef.current = activeSheetId;

    // Clear cell data immediately when switching sheets (before async load)
    // This prevents old content from showing briefly
    setCellData(new Map());
    setCellFormat(new Map());
    setBaselineData(new Map());
    setBaselineFormat(new Map());
    setDirtyCells(new Set());
    
    // Clear UI state
    setSelection(null);
    setHighlightedCells(null);
    setInputValue('');
    setIsEditing(false);
    setCopiedRange(null);

    if (activeSheet.fetchId) {
      // Sheet has backend ID - load it
      console.log('Loading sheet with fetchId:', activeSheet.fetchId, 'for sheetId:', activeSheetId);
      loadSheet(activeSheet.fetchId).catch(err => {
        console.error('Load sheet failed:', err);
      });
    } else {
      console.log('No fetchId for sheet:', activeSheetId, '- redirecting to /dashboard');
      router.replace('/dashboard');
    }

    // Save activeSheetId to localStorage
    localStorage.setItem('spreadsheet_last_active_sheet_id', activeSheetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheetId]);
}
