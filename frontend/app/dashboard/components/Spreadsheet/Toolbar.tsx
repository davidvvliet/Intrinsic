import { useCallback, useState, useRef } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';

import { useAuthFetch } from '../../hooks/useAuthFetch';
import { getCellKey } from './drawUtils';
import type { CellFormat, NumberFormatSettings } from './types';
import ColorButton from './ColorButton';
import FormatDropdown from './FormatDropdown';
import ViewDropdown from './ViewDropdown';
import InsertDropdown from './InsertDropdown';
import styles from './Toolbar.module.css';

const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.5 3L2 6.5L5.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 6.5H10C11.933 6.5 13.5 8.067 13.5 10C13.5 11.933 11.933 13.5 10 13.5H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const RedoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.5 3L14 6.5L10.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 6.5H6C4.067 6.5 2.5 8.067 2.5 10C2.5 11.933 4.067 13.5 6 13.5H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function Toolbar() {
  const selection = useSpreadsheetStore(state => state.selection);
  const cellFormat = useSpreadsheetStore(state => state.cellFormat);
  const updateCellFormats = useSpreadsheetStore(state => state.updateCellFormats);
  const undo = useSpreadsheetStore(state => state.undo);
  const redo = useSpreadsheetStore(state => state.redo);
  const canUndo = useSpreadsheetStore(state => state.canUndo);
  const canRedo = useSpreadsheetStore(state => state.canRedo);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const sheets = useSpreadsheetStore(state => state.sheets);
  const workspaceId = useSpreadsheetStore(state => state.workspaceId);

  const workspaceName = useSpreadsheetStore(state => state.workspaceName);
  const setWorkspaceName = useSpreadsheetStore(state => state.setWorkspaceName);
  const { fetchWithAuth } = useAuthFetch();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const response = await fetchWithAuth(`/api/workspaces/${workspaceId}/export`);
      if (!response.ok) throw new Error('Failed to export');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${workspaceName || 'workspace'}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export workspace:', err);
    }
  }, [workspaceId, workspaceName, fetchWithAuth]);

  const handleStartRename = () => {
    if (!workspaceName) return;
    setIsEditingName(true);
    setEditingName(workspaceName);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const handleSaveRename = () => {
    if (!isEditingName) return;
    const trimmed = editingName.trim() || 'Untitled';
    setIsEditingName(false);
    if (!workspaceId || trimmed === workspaceName) return;
    setWorkspaceName(trimmed);
    fetchWithAuth(`/api/workspaces/${workspaceId}/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    }).catch(err => console.error('Failed to rename workspace:', err));
  };

  const handleCancelRename = () => {
    setIsEditingName(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveRename();
    else if (e.key === 'Escape') handleCancelRename();
  };

  // Get active sheet info
  const activeSheet = sheets.find(s => s.sheetId === activeSheetId);

  // Get current cell's format
  const getCurrentFormat = useCallback((): CellFormat => {
    if (!selection) return {};
    const key = getCellKey(selection.start.row, selection.start.col);
    return cellFormat.get(key) || {};
  }, [selection, cellFormat]);

  const currentFormat = getCurrentFormat();

  // Toggle a format property for all selected cells
  const toggleFormat = useCallback((property: keyof CellFormat) => {
    if (!selection) return;

    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    // Check current state of anchor cell to determine toggle direction
    const anchorKey = getCellKey(selection.start.row, selection.start.col);
    const anchorFormat = cellFormat.get(anchorKey) || {};
    const newValue = !anchorFormat[property];

    const newCellFormat = new Map(cellFormat);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = getCellKey(row, col);
        const existing = cellFormat.get(key) || {};
        newCellFormat.set(key, {
          ...existing,
          [property]: newValue || undefined,
        });
      }
    }
    updateCellFormats(newCellFormat);
  }, [selection, cellFormat, updateCellFormats]);

  // Set text color for all selected cells
  const handleTextColor = useCallback((color: string | null) => {
    if (!selection) return;

    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    const newCellFormat = new Map(cellFormat);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = getCellKey(row, col);
        const existing = cellFormat.get(key) || {};
        if (color) {
          newCellFormat.set(key, { ...existing, textColor: color });
        } else {
          const { textColor, ...rest } = existing;
          if (Object.keys(rest).length > 0) {
            newCellFormat.set(key, rest);
          } else {
            newCellFormat.delete(key);
          }
        }
      }
    }
    updateCellFormats(newCellFormat);
  }, [selection, cellFormat, updateCellFormats]);

  // Set fill color for all selected cells
  const handleFillColor = useCallback((color: string | null) => {
    if (!selection) return;

    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    const newCellFormat = new Map(cellFormat);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = getCellKey(row, col);
        const existing = cellFormat.get(key) || {};
        if (color) {
          newCellFormat.set(key, { ...existing, fillColor: color });
        } else {
          const { fillColor, ...rest } = existing;
          if (Object.keys(rest).length > 0) {
            newCellFormat.set(key, rest);
          } else {
            newCellFormat.delete(key);
          }
        }
      }
    }
    updateCellFormats(newCellFormat);
  }, [selection, cellFormat, updateCellFormats]);

  // Set number format for all selected cells
  const handleNumberFormat = useCallback((format: NumberFormatSettings | null) => {
    if (!selection) return;

    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    const newCellFormat = new Map(cellFormat);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = getCellKey(row, col);
        const existing = cellFormat.get(key) || {};
        if (format) {
          newCellFormat.set(key, { ...existing, numberFormat: format });
        } else {
          const { numberFormat, ...rest } = existing;
          if (Object.keys(rest).length > 0) {
            newCellFormat.set(key, rest);
          } else {
            newCellFormat.delete(key);
          }
        }
      }
    }
    updateCellFormats(newCellFormat);
  }, [selection, cellFormat, updateCellFormats]);

  // Prevent focus loss when clicking toolbar buttons
  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className={styles.toolbar}>
      <button
        className={styles.formatButton}
        onMouseDown={preventFocusLoss}
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        <UndoIcon />
      </button>
      <button
        className={styles.formatButton}
        onMouseDown={preventFocusLoss}
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <RedoIcon />
      </button>
      <div className={styles.separator} />
      <button
        className={`${styles.formatButton} ${currentFormat.bold ? styles.active : ''}`}
        onMouseDown={preventFocusLoss}
        onClick={() => toggleFormat('bold')}
        disabled={!selection}
        title="Bold"
      >
        B
      </button>
      <button
        className={`${styles.formatButton} ${styles.italic} ${currentFormat.italic ? styles.active : ''}`}
        onMouseDown={preventFocusLoss}
        onClick={() => toggleFormat('italic')}
        disabled={!selection}
        title="Italic"
      >
        I
      </button>
      <button
        className={`${styles.formatButton} ${currentFormat.underline ? styles.active : ''}`}
        onMouseDown={preventFocusLoss}
        onClick={() => toggleFormat('underline')}
        disabled={!selection}
        title="Underline (Ctrl+U)"
      >
        <span className={styles.underline}>U</span>
      </button>
      <button
        className={`${styles.formatButton} ${currentFormat.strikethrough ? styles.active : ''}`}
        onMouseDown={preventFocusLoss}
        onClick={() => toggleFormat('strikethrough')}
        disabled={!selection}
        title="Strikethrough"
      >
        <span className={styles.strikethrough}>S</span>
      </button>
      <div className={styles.separator} />
      <ColorButton
        icon="text"
        currentColor={currentFormat.textColor}
        onSelectColor={handleTextColor}
        disabled={!selection}
      />
      <ColorButton
        icon="fill"
        currentColor={currentFormat.fillColor}
        onSelectColor={handleFillColor}
        disabled={!selection}
      />
      <div className={styles.separator} />
      <FormatDropdown
        currentFormat={currentFormat.numberFormat}
        onSelectFormat={handleNumberFormat}
        disabled={!selection}
      />
      <button
        className={`${styles.formatButton} ${currentFormat.numberFormat?.type === 'percent' ? styles.active : ''}`}
        onMouseDown={preventFocusLoss}
        onClick={() => handleNumberFormat({ type: 'percent' })}
        disabled={!selection}
        title="Percent"
      >
        %
      </button>
      <button
        className={`${styles.formatButton} ${currentFormat.numberFormat?.type === 'currency' ? styles.active : ''}`}
        onMouseDown={preventFocusLoss}
        onClick={() => handleNumberFormat({ type: 'currency' })}
        disabled={!selection}
        title="Currency"
      >
        $
      </button>
      <div className={styles.separator} />
      <ViewDropdown />
      <InsertDropdown />
      <div className={styles.spacer} />
      {workspaceName && (
        <span className={styles.workspaceName}>
          Workspace:{' '}
          {isEditingName ? (
            <input
              ref={nameInputRef}
              className={styles.renameInput}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleSaveRename}
            />
          ) : (
            <strong onClick={handleStartRename}>{workspaceName}</strong>
          )}
          <button
            className={styles.exportButton}
            onClick={handleExport}
            title="Export as .xlsx"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2v8M8 10L5 7M8 10l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </span>
      )}
    </div>
  );
}
