import { useCallback } from 'react';
import { useSpreadsheetStore } from '../stores/spreadsheetStore';
import { useAuthFetch } from './useAuthFetch';

type SheetMetadata = {
  sheetId: string;
  name: string;
  createdAt: string;
  isSaved: boolean;
};

export function useSheetRouter() {
  const { fetchWithAuth } = useAuthFetch();

  // Store state
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const setActiveSheetId = useSpreadsheetStore(state => state.setActiveSheetId);
  const sheets = useSpreadsheetStore(state => state.sheets);
  const setSheets = useSpreadsheetStore(state => state.setSheets);

  // Set active sheet by sheetId
  const setActiveSheet = useCallback((sheetId: string) => {
    setActiveSheetId(sheetId);
  }, [setActiveSheetId]);

  // Create new sheet
  const createSheet = useCallback((name?: string) => {
    const sheetId = crypto.randomUUID();
    const newSheet: SheetMetadata = {
      sheetId,
      name: name || `Sheet ${sheets.length + 1}`,
      createdAt: new Date().toISOString(),
      isSaved: false,
    };

    const updated = [...sheets, newSheet];
    setSheets(updated);
    setActiveSheetId(sheetId);
    return sheetId;
  }, [sheets, setSheets, setActiveSheetId]);

  // Delete sheet
  const deleteSheet = useCallback(async (sheetId: string) => {
    const sheet = sheets.find(s => s.sheetId === sheetId);
    if (!sheet) return;

    // Delete from backend if saved
    if (sheet.isSaved) {
      try {
        await fetchWithAuth(`/api/sheets/${sheetId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete sheet from backend:', err);
      }
    }

    const deletedIndex = sheets.findIndex(s => s.sheetId === sheetId);
    let updated = sheets.filter(s => s.sheetId !== sheetId);

    // Create default if deleting last sheet
    if (updated.length === 0) {
      const newSheetId = crypto.randomUUID();
      updated = [{
        sheetId: newSheetId,
        name: 'Sheet 1',
        createdAt: new Date().toISOString(),
        isSaved: false,
      }];
      setSheets(updated);
      setActiveSheetId(newSheetId);
      return;
    }

    setSheets(updated);

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

    // Sync to backend
    const sheet = sheets.find(s => s.sheetId === sheetId);
    if (sheet?.isSaved) {
      try {
        await fetchWithAuth(`/api/sheets/${sheetId}/name`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
      } catch (err) {
        console.error('Failed to rename sheet on backend:', err);
      }
    }
  }, [sheets, setSheets, fetchWithAuth]);

  // Update sheet name (called when loading from backend)
  const updateSheetName = useCallback((sheetId: string, name: string) => {
    const updated = sheets.map(s =>
      s.sheetId === sheetId ? { ...s, name } : s
    );
    setSheets(updated);
  }, [sheets, setSheets]);

  // Mark a sheet as saved
  const markSheetSaved = useCallback((sheetId: string) => {
    const updated = sheets.map(s =>
      s.sheetId === sheetId ? { ...s, isSaved: true } : s
    );
    setSheets(updated);
  }, [sheets, setSheets]);

  return {
    activeSheetId,
    sheets,
    setActiveSheet,
    createSheet,
    deleteSheet,
    renameSheet,
    updateSheetName,
    markSheetSaved,
  };
}
