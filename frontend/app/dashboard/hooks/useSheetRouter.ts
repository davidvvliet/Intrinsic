import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSpreadsheetStore } from '../stores/spreadsheetStore';
import { useAuthFetch } from './useAuthFetch';

type SheetMetadata = {
  sheetId: string;
  fetchId: string | null;
  name: string;
  createdAt: string;
};

const STORAGE_KEY_SHEETS = 'spreadsheet_sheets';
const STORAGE_KEY_ACTIVE = 'spreadsheet_last_active_sheet_id';

export function useSheetRouter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchWithAuth } = useAuthFetch();
  const initializedRef = useRef(false);

  // Store state
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const setActiveSheetId = useSpreadsheetStore(state => state.setActiveSheetId);
  const sheets = useSpreadsheetStore(state => state.sheets);
  const setSheets = useSpreadsheetStore(state => state.setSheets);

  // Initialize from URL or localStorage on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY_SHEETS);
      let parsed: SheetMetadata[] = stored ? JSON.parse(stored) : [];

      // Create default sheet if none exist
      if (parsed.length === 0) {
        const sheetId = Date.now().toString();
        parsed = [{
          sheetId,
          fetchId: null,
          name: 'Sheet 1',
          createdAt: new Date().toISOString(),
        }];
        localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(parsed));
      }

      // Check URL param first
      const fetchIdFromUrl = searchParams.get('sheet');

      if (fetchIdFromUrl) {
        let targetSheet = parsed.find(s => s.fetchId === fetchIdFromUrl);

        if (!targetSheet) {
          // Create new entry for this backend sheet
          const newSheetId = Date.now().toString();
          targetSheet = {
            sheetId: newSheetId,
            fetchId: fetchIdFromUrl,
            name: 'Loading...',
            createdAt: new Date().toISOString(),
          };
          parsed = [...parsed, targetSheet];
          localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(parsed));
        }

        setSheets(parsed);
        setActiveSheetId(targetSheet.sheetId);
        localStorage.setItem(STORAGE_KEY_ACTIVE, targetSheet.sheetId);
      } else {
        setSheets(parsed);

        // Fall back to localStorage
        const lastActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE);
        const activeSheet = lastActiveId
          ? parsed.find(s => s.sheetId === lastActiveId)
          : null;

        setActiveSheetId(activeSheet?.sheetId || parsed[0].sheetId);
      }
    } catch (err) {
      console.error('Failed to initialize sheets:', err);
    }
  }, [searchParams, setSheets, setActiveSheetId]);

  // Sync URL when activeSheetId changes
  useEffect(() => {
    if (!activeSheetId) return;

    const activeSheet = sheets.find(s => s.sheetId === activeSheetId);
    if (!activeSheet) return;

    // Update localStorage
    localStorage.setItem(STORAGE_KEY_ACTIVE, activeSheetId);

    // Update URL to match fetchId
    const currentUrlFetchId = searchParams.get('sheet');
    if (activeSheet.fetchId && activeSheet.fetchId !== currentUrlFetchId) {
      router.replace(`/dashboard?sheet=${activeSheet.fetchId}`);
    } else if (!activeSheet.fetchId && currentUrlFetchId) {
      router.replace('/dashboard');
    }
  }, [activeSheetId, sheets, searchParams, router]);

  // Set active sheet by sheetId
  const setActiveSheet = useCallback((sheetId: string) => {
    setActiveSheetId(sheetId);
  }, [setActiveSheetId]);

  // Create new sheet
  const createSheet = useCallback((name?: string) => {
    const sheetId = Date.now().toString();
    const newSheet: SheetMetadata = {
      sheetId,
      fetchId: null,
      name: name || `Sheet ${sheets.length + 1}`,
      createdAt: new Date().toISOString(),
    };

    const updated = [...sheets, newSheet];
    setSheets(updated);
    localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(updated));

    setActiveSheetId(sheetId);
    return sheetId;
  }, [sheets, setSheets, setActiveSheetId]);

  // Delete sheet
  const deleteSheet = useCallback(async (sheetId: string) => {
    const sheet = sheets.find(s => s.sheetId === sheetId);
    if (!sheet) return;

    // Delete from backend if saved
    if (sheet.fetchId) {
      try {
        await fetchWithAuth(`/api/sheets/${sheet.fetchId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete sheet from backend:', err);
      }
    }

    const deletedIndex = sheets.findIndex(s => s.sheetId === sheetId);
    let updated = sheets.filter(s => s.sheetId !== sheetId);

    // Create default if deleting last sheet
    if (updated.length === 0) {
      const newSheetId = Date.now().toString();
      updated = [{
        sheetId: newSheetId,
        fetchId: null,
        name: 'Sheet 1',
        createdAt: new Date().toISOString(),
      }];
      setSheets(updated);
      localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(updated));
      setActiveSheetId(newSheetId);
      return;
    }

    setSheets(updated);
    localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(updated));

    // Switch to nearest tab if deleting active
    if (sheetId === activeSheetId) {
      const newIndex = Math.min(deletedIndex, updated.length - 1);
      setActiveSheetId(updated[newIndex].sheetId);
    }
  }, [sheets, activeSheetId, setSheets, setActiveSheetId, fetchWithAuth]);

  // Rename sheet
  const renameSheet = useCallback(async (sheetId: string, name: string) => {
    const trimmed = name.trim() || 'Untitled';
    const updated = sheets.map(s =>
      s.sheetId === sheetId ? { ...s, name: trimmed } : s
    );

    setSheets(updated);
    localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(updated));

    // Sync to backend
    const sheet = sheets.find(s => s.sheetId === sheetId);
    if (sheet?.fetchId) {
      try {
        await fetchWithAuth(`/api/sheets/${sheet.fetchId}/name`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
      } catch (err) {
        console.error('Failed to rename sheet on backend:', err);
      }
    }
  }, [sheets, setSheets, fetchWithAuth]);

  // Update fetchId after first save
  const updateFetchId = useCallback((sheetId: string, fetchId: string) => {
    const updated = sheets.map(s =>
      s.sheetId === sheetId ? { ...s, fetchId } : s
    );
    setSheets(updated);
    localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(updated));

    // Update URL if this is the active sheet
    if (sheetId === activeSheetId) {
      router.replace(`/dashboard?sheet=${fetchId}`);
    }
  }, [sheets, activeSheetId, setSheets, router]);

  // Update sheet name (called when loading from backend)
  const updateSheetName = useCallback((fetchId: string, name: string) => {
    const updated = sheets.map(s =>
      s.fetchId === fetchId ? { ...s, name } : s
    );
    setSheets(updated);
    localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(updated));
  }, [sheets, setSheets]);

  return {
    activeSheetId,
    sheets,
    setActiveSheet,
    createSheet,
    deleteSheet,
    renameSheet,
    updateFetchId,
    updateSheetName,
  };
}
