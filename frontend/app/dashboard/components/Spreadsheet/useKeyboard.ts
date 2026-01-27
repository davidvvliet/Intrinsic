import { useCallback } from 'react';
import { NUM_ROWS, NUM_COLS } from './config';
import type { CellData, Selection, CopiedRange } from './types';
import { getCellKey, determineCellType } from './drawUtils';

type Direction = 'up' | 'down' | 'left' | 'right';

function findJumpTarget(
  row: number,
  col: number,
  direction: Direction,
  cellData: CellData
): { row: number; col: number } {
  const hasData = (r: number, c: number) => !!cellData.get(getCellKey(r, c));
  const currentHasData = hasData(row, col);

  if (direction === 'down') {
    const nextHasData = row + 1 < NUM_ROWS && hasData(row + 1, col);
    if (currentHasData && nextHasData) {
      // Find end of contiguous block
      for (let r = row + 1; r < NUM_ROWS; r++) {
        if (!hasData(r, col)) return { row: r - 1, col };
      }
      return { row: NUM_ROWS - 1, col };
    } else {
      // Find next non-empty or edge
      for (let r = row + 1; r < NUM_ROWS; r++) {
        if (hasData(r, col)) return { row: r, col };
      }
      return { row: NUM_ROWS - 1, col };
    }
  }

  if (direction === 'up') {
    const nextHasData = row - 1 >= 0 && hasData(row - 1, col);
    if (currentHasData && nextHasData) {
      for (let r = row - 1; r >= 0; r--) {
        if (!hasData(r, col)) return { row: r + 1, col };
      }
      return { row: 0, col };
    } else {
      for (let r = row - 1; r >= 0; r--) {
        if (hasData(r, col)) return { row: r, col };
      }
      return { row: 0, col };
    }
  }

  if (direction === 'right') {
    const nextHasData = col + 1 < NUM_COLS && hasData(row, col + 1);
    if (currentHasData && nextHasData) {
      for (let c = col + 1; c < NUM_COLS; c++) {
        if (!hasData(row, c)) return { row, col: c - 1 };
      }
      return { row, col: NUM_COLS - 1 };
    } else {
      for (let c = col + 1; c < NUM_COLS; c++) {
        if (hasData(row, c)) return { row, col: c };
      }
      return { row, col: NUM_COLS - 1 };
    }
  }

  if (direction === 'left') {
    const nextHasData = col - 1 >= 0 && hasData(row, col - 1);
    if (currentHasData && nextHasData) {
      for (let c = col - 1; c >= 0; c--) {
        if (!hasData(row, c)) return { row, col: c + 1 };
      }
      return { row, col: 0 };
    } else {
      for (let c = col - 1; c >= 0; c--) {
        if (hasData(row, c)) return { row, col: c };
      }
      return { row, col: 0 };
    }
  }

  return { row, col };
}

export function useKeyboard({
  selection,
  isEditing,
  cellData,
  setCellData,
  setSelection,
  setIsEditing,
  setInputValue,
  setCopiedRange,
  moveToCell,
  saveCurrentCell,
  inputRef,
  containerRef,
}: {
  selection: Selection;
  isEditing: boolean;
  cellData: CellData;
  setCellData: React.Dispatch<React.SetStateAction<CellData>>;
  setSelection: React.Dispatch<React.SetStateAction<Selection>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  setCopiedRange: React.Dispatch<React.SetStateAction<CopiedRange>>;
  moveToCell: (row: number, col: number, startEditing?: boolean) => void;
  saveCurrentCell: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selection || isEditing) return;

    const { row, col } = selection.start;
    const endRow = selection.end.row;
    const endCol = selection.end.col;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          const target = findJumpTarget(row, col, 'up', cellData);
          moveToCell(target.row, target.col);
        } else if (e.shiftKey) {
          const newEndRow = Math.max(0, endRow - 1);
          setSelection(prev => prev ? { start: prev.start, end: { row: newEndRow, col: prev.end.col } } : null);
        } else {
          moveToCell(row - 1, col);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          const target = findJumpTarget(row, col, 'down', cellData);
          moveToCell(target.row, target.col);
        } else if (e.shiftKey) {
          const newEndRow = Math.min(NUM_ROWS - 1, endRow + 1);
          setSelection(prev => prev ? { start: prev.start, end: { row: newEndRow, col: prev.end.col } } : null);
        } else {
          moveToCell(row + 1, col);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          const target = findJumpTarget(row, col, 'left', cellData);
          moveToCell(target.row, target.col);
        } else if (e.shiftKey) {
          const newEndCol = Math.max(0, endCol - 1);
          setSelection(prev => prev ? { start: prev.start, end: { row: prev.end.row, col: newEndCol } } : null);
        } else {
          moveToCell(row, col - 1);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          const target = findJumpTarget(row, col, 'right', cellData);
          moveToCell(target.row, target.col);
        } else if (e.shiftKey) {
          const newEndCol = Math.min(NUM_COLS - 1, endCol + 1);
          setSelection(prev => prev ? { start: prev.start, end: { row: prev.end.row, col: newEndCol } } : null);
        } else {
          moveToCell(row, col + 1);
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          moveToCell(row, col - 1);
        } else {
          moveToCell(row, col + 1);
        }
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (selection) {
          // Calculate selection bounds
          const minRow = Math.min(selection.start.row, selection.end.row);
          const maxRow = Math.max(selection.start.row, selection.end.row);
          const minCol = Math.min(selection.start.col, selection.end.col);
          const maxCol = Math.max(selection.start.col, selection.end.col);

          setCellData(prev => {
            const next = new Map(prev);
            // Delete all cells in the selection range
            for (let row = minRow; row <= maxRow; row++) {
              for (let col = minCol; col <= maxCol; col++) {
                const key = getCellKey(row, col);
                next.delete(key);
              }
            }
            return next;
          });
          setInputValue('');
        }
        break;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
        break;
      case 'Escape':
        e.preventDefault();
        setCopiedRange(null);
        break;
      case 'c':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Calculate selection bounds
          const copyMinRow = Math.min(selection.start.row, selection.end.row);
          const copyMaxRow = Math.max(selection.start.row, selection.end.row);
          const copyMinCol = Math.min(selection.start.col, selection.end.col);
          const copyMaxCol = Math.max(selection.start.col, selection.end.col);
          
          // Build TSV string (tabs between columns, newlines between rows)
          const rows: string[] = [];
          for (let r = copyMinRow; r <= copyMaxRow; r++) {
            const cols: string[] = [];
            for (let c = copyMinCol; c <= copyMaxCol; c++) {
              cols.push(cellData.get(getCellKey(r, c))?.raw || '');
            }
            rows.push(cols.join('\t'));
          }
          navigator.clipboard.writeText(rows.join('\n'));
          setCopiedRange({ minRow: copyMinRow, maxRow: copyMaxRow, minCol: copyMinCol, maxCol: copyMaxCol });
        }
        break;
      case 'v':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          navigator.clipboard.readText().then(text => {
            const lines = text.split('\n');
            const anchorRow = selection.start.row;
            const anchorCol = selection.start.col;
            
            setCellData(prev => {
              const next = new Map(prev);
              lines.forEach((line, rowOffset) => {
                const cells = line.split('\t');
                cells.forEach((value, colOffset) => {
                  const newRow = anchorRow + rowOffset;
                  const newCol = anchorCol + colOffset;
                  if (newRow < NUM_ROWS && newCol < NUM_COLS) {
                    const key = getCellKey(newRow, newCol);
                    if (value.trim()) {
                      next.set(key, {
                        raw: value,
                        type: determineCellType(value),
                      });
                    } else {
                      next.delete(key);
                    }
                  }
                });
              });
              return next;
            });
          });
        }
        break;
      case 'x':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          // Calculate selection bounds
          const cutMinRow = Math.min(selection.start.row, selection.end.row);
          const cutMaxRow = Math.max(selection.start.row, selection.end.row);
          const cutMinCol = Math.min(selection.start.col, selection.end.col);
          const cutMaxCol = Math.max(selection.start.col, selection.end.col);
          
          // Build TSV string and copy to clipboard
          const cutRows: string[] = [];
          for (let r = cutMinRow; r <= cutMaxRow; r++) {
            const cols: string[] = [];
            for (let c = cutMinCol; c <= cutMaxCol; c++) {
              cols.push(cellData.get(getCellKey(r, c))?.raw || '');
            }
            cutRows.push(cols.join('\t'));
          }
          navigator.clipboard.writeText(cutRows.join('\n'));
          
          // Delete the cells
          setCellData(prev => {
            const next = new Map(prev);
            for (let r = cutMinRow; r <= cutMaxRow; r++) {
              for (let c = cutMinCol; c <= cutMaxCol; c++) {
                next.delete(getCellKey(r, c));
              }
            }
            return next;
          });
          setInputValue('');
        }
        break;
      default:
        // Start editing on any printable character
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setInputValue(e.key);
          setIsEditing(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }
        break;
    }
  }, [selection, isEditing, moveToCell, setCellData, setInputValue, cellData, setSelection, setIsEditing, setCopiedRange, inputRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!selection) return;

    const { row, col } = selection.start;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        saveCurrentCell();
        moveToCell(row + 1, col, false);
        break;
      case 'Escape':
        e.preventDefault();
        // Discard changes, reload original value
        const key = getCellKey(row, col);
        setInputValue(cellData.get(key)?.raw || '');
        setIsEditing(false);
        setTimeout(() => containerRef.current?.focus(), 0);
        break;
      case 'Tab':
        e.preventDefault();
        saveCurrentCell();
        if (e.shiftKey) {
          moveToCell(row, col - 1, false);
        } else {
          moveToCell(row, col + 1, false);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        saveCurrentCell();
        setIsEditing(false);
        moveToCell(row - 1, col, false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        saveCurrentCell();
        setIsEditing(false);
        moveToCell(row + 1, col, false);
        break;
      case 'ArrowLeft':
        // Only navigate if cursor is at start of text
        const input = e.currentTarget;
        if (input.selectionStart === 0 && input.selectionEnd === 0) {
          e.preventDefault();
          saveCurrentCell();
          setIsEditing(false);
          moveToCell(row, col - 1, false);
        }
        break;
      case 'ArrowRight':
        // Only navigate if cursor is at end of text
        const inputRight = e.currentTarget;
        if (inputRight.selectionStart === inputRight.value.length && inputRight.selectionEnd === inputRight.value.length) {
          e.preventDefault();
          saveCurrentCell();
          setIsEditing(false);
          moveToCell(row, col + 1, false);
        }
        break;
    }
  }, [selection, saveCurrentCell, moveToCell, cellData, setInputValue, setIsEditing, containerRef]);

  return {
    handleContainerKeyDown,
    handleKeyDown,
  };
}
