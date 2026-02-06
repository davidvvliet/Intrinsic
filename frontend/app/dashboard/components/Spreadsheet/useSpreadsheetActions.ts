import { useCallback, useMemo } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { useRefContext } from './RefContext';
import { getCellKey, determineCellType, getColumnLabel } from './drawUtils';
import { NUM_ROWS, NUM_COLS, CELL_WIDTH, CELL_FONT_SIZE, CELL_TEXT_PADDING } from './config';

/**
 * Hook that provides actions requiring DOM refs.
 * Use this inside components that need saveCurrentCell, moveToCell, etc.
 */
export function useSpreadsheetActions() {
  const { inputRef, containerRef } = useRefContext();

  const selection = useSpreadsheetStore(state => state.selection);
  const inputValue = useSpreadsheetStore(state => state.inputValue);
  const isEditing = useSpreadsheetStore(state => state.isEditing);
  const cellFormat = useSpreadsheetStore(state => state.cellFormat);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const columnWidthsBySheet = useSpreadsheetStore(state => state.columnWidthsBySheet);

  const setSelection = useSpreadsheetStore(state => state.setSelection);
  const setInputValue = useSpreadsheetStore(state => state.setInputValue);
  const setIsEditing = useSpreadsheetStore(state => state.setIsEditing);
  const setHighlightedCells = useSpreadsheetStore(state => state.setHighlightedCells);
  const setColumnWidthsBySheet = useSpreadsheetStore(state => state.setColumnWidthsBySheet);
  const updateCell = useSpreadsheetStore(state => state.updateCell);
  const getDisplayValue = useSpreadsheetStore(state => state.getDisplayValue);

  // Compute column widths for active sheet
  const columnWidths = useMemo(() => {
    return columnWidthsBySheet.get(activeSheetId || '') || new Map<number, number>();
  }, [columnWidthsBySheet, activeSheetId]);

  // Get cumulative x position of a column
  const getColumnX = useCallback((col: number): number => {
    let x = 0;
    for (let i = 0; i < col; i++) {
      x += columnWidths.get(i) || CELL_WIDTH;
    }
    return x;
  }, [columnWidths]);

  // Auto-resize column based on widest value
  const autoResizeColumn = useCallback((col: number) => {
    if (col < 0 || col >= NUM_COLS || !activeSheetId) return;

    let maxWidth = CELL_WIDTH;
    const measureRows = Math.min(1000, NUM_ROWS);

    for (let row = 0; row < measureRows; row++) {
      const cellKey = getCellKey(row, col);
      const displayValue = getDisplayValue(cellKey);

      if (displayValue) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const format = cellFormat.get(cellKey);
          ctx.font = format?.bold
            ? `bold ${CELL_FONT_SIZE}px Arial`
            : `${CELL_FONT_SIZE}px Arial`;
          const textWidth = ctx.measureText(displayValue).width;
          const cellWidth = textWidth + CELL_TEXT_PADDING * 2;
          maxWidth = Math.max(maxWidth, cellWidth);
        }
      }
    }

    // Check header label width
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `bold ${CELL_FONT_SIZE}px Arial`;
      const headerLabel = getColumnLabel(col);
      const headerWidth = ctx.measureText(headerLabel).width + CELL_TEXT_PADDING * 2;
      maxWidth = Math.max(maxWidth, headerWidth);
    }

    setColumnWidthsBySheet(prev => {
      const next = new Map(prev);
      const sheetWidths = new Map(next.get(activeSheetId) || new Map());
      sheetWidths.set(col, maxWidth);
      next.set(activeSheetId, sheetWidths);
      return next;
    });
  }, [activeSheetId, cellFormat, getDisplayValue, setColumnWidthsBySheet]);

  // Save current cell
  const saveCurrentCell = useCallback(() => {
    if (selection) {
      const key = getCellKey(selection.start.row, selection.start.col);
      if (inputValue.trim()) {
        updateCell(key, {
          raw: inputValue,
          type: determineCellType(inputValue),
        }, true);
      } else {
        updateCell(key, null, true);
      }
      setHighlightedCells(null);
    }
  }, [selection, inputValue, updateCell, setHighlightedCells]);

  // Move to cell
  const moveToCell = useCallback((row: number, col: number, startEditing = false) => {
    const newRow = Math.max(0, Math.min(NUM_ROWS - 1, row));
    const newCol = Math.max(0, Math.min(NUM_COLS - 1, col));

    if (isEditing) {
      saveCurrentCell();
    }

    setSelection({ start: { row: newRow, col: newCol }, end: { row: newRow, col: newCol } });
    const key = getCellKey(newRow, newCol);
    const cell = useSpreadsheetStore.getState().cellData.get(key);
    setInputValue(cell?.raw || '');
    setIsEditing(startEditing);

    if (startEditing) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setTimeout(() => containerRef.current?.focus(), 0);
    }
  }, [isEditing, saveCurrentCell, setSelection, setInputValue, setIsEditing, inputRef, containerRef]);

  return {
    inputRef,
    containerRef,
    columnWidths,
    getColumnX,
    autoResizeColumn,
    saveCurrentCell,
    moveToCell,
  };
}
