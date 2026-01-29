import { useCallback } from 'react';
import { NUM_ROWS, NUM_COLS } from './config';
import type { CellData, CellFormatData, Selection, CopiedRange } from './types';
import { getCellKey, getColumnLabel } from './drawUtils';
import { writeToClipboard, readFromClipboard, applyPaste } from './clipboardUtils';

/**
 * Convert a Selection to a cell reference string (e.g., "A1" or "A1:B5")
 */
function selectionToRef(sel: Selection): string {
  if (!sel) return '';
  const startCol = getColumnLabel(sel.start.col);
  const startRow = sel.start.row + 1;
  
  if (sel.start.row === sel.end.row && sel.start.col === sel.end.col) {
    return `${startCol}${startRow}`;
  }
  
  const endCol = getColumnLabel(sel.end.col);
  const endRow = sel.end.row + 1;
  return `${startCol}${startRow}:${endCol}${endRow}`;
}

/**
 * Check if the formula ends with a cell reference pattern
 * Returns the start index of the reference if found, -1 otherwise
 */
function findTrailingReference(formula: string): number {
  // Match cell reference or range at the end: A1, $A$1, A1:B5, etc.
  const match = formula.match(/(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)$/);
  if (match) {
    return formula.length - match[1].length;
  }
  return -1;
}

/**
 * Check if formula ends with an operator or opening bracket (ready for new reference)
 */
function endsWithOperator(formula: string): boolean {
  const trimmed = formula.trim();
  return /[+\-*/^&=<>,(]$/.test(trimmed) || trimmed === '=';
}

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
  pointingSelection,
  isEditing,
  inputValue,
  cellData,
  cellFormat,
  copiedRange,
  setCellData,
  setCellFormat,
  setSelection,
  setPointingSelection,
  setIsEditing,
  setInputValue,
  setCopiedRange,
  moveToCell,
  saveCurrentCell,
  inputRef,
  containerRef,
}: {
  selection: Selection;
  pointingSelection: Selection;
  isEditing: boolean;
  inputValue: string;
  cellData: CellData;
  cellFormat: CellFormatData;
  copiedRange: CopiedRange;
  setCellData: React.Dispatch<React.SetStateAction<CellData>>;
  setCellFormat: React.Dispatch<React.SetStateAction<CellFormatData>>;
  setSelection: React.Dispatch<React.SetStateAction<Selection>>;
  setPointingSelection: React.Dispatch<React.SetStateAction<Selection>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  setCopiedRange: React.Dispatch<React.SetStateAction<CopiedRange>>;
  moveToCell: (row: number, col: number, startEditing?: boolean) => void;
  saveCurrentCell: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  // Check if we're in formula mode (editing a formula)
  const isFormulaMode = isEditing && inputValue.startsWith('=');

  /**
   * Update the formula with a cell reference based on pointing selection
   */
  const updateFormulaWithReference = useCallback((newPointingSel: Selection) => {
    if (!newPointingSel) return;
    
    const ref = selectionToRef(newPointingSel);
    
    // Check if formula ends with empty parentheses (from auto-pairing)
    if (inputValue.endsWith('()')) {
      // Insert reference before the closing parenthesis
      setInputValue(inputValue.slice(0, -1) + ref + ')');
      return;
    }
    
    // Check if formula ends with a cell reference followed by closing parenthesis
    // e.g., =SUM(A1) or =SUM(A1:B5)
    const refBeforeParenMatch = inputValue.match(/(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)\)$/);
    if (refBeforeParenMatch) {
      // Replace the reference before the closing parenthesis
      const refStart = inputValue.length - refBeforeParenMatch[0].length;
      setInputValue(inputValue.slice(0, refStart) + ref + ')');
      return;
    }
    
    const trailingRefStart = findTrailingReference(inputValue);
    
    if (trailingRefStart >= 0 && !endsWithOperator(inputValue)) {
      // Replace the trailing reference
      setInputValue(inputValue.slice(0, trailingRefStart) + ref);
    } else {
      // Append new reference
      setInputValue(inputValue + ref);
    }
  }, [inputValue, setInputValue]);
  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selection || isEditing) return;

    const { row, col } = selection.start;
    const endRow = selection.end.row;
    const endCol = selection.end.col;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
          const target = findJumpTarget(endRow, endCol, 'up', cellData);
          setSelection(prev => prev ? { start: prev.start, end: { row: target.row, col: target.col } } : null);
        } else if (e.metaKey || e.ctrlKey) {
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
        if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
          const target = findJumpTarget(endRow, endCol, 'down', cellData);
          setSelection(prev => prev ? { start: prev.start, end: { row: target.row, col: target.col } } : null);
        } else if (e.metaKey || e.ctrlKey) {
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
        if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
          const target = findJumpTarget(endRow, endCol, 'left', cellData);
          setSelection(prev => prev ? { start: prev.start, end: { row: target.row, col: target.col } } : null);
        } else if (e.metaKey || e.ctrlKey) {
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
        if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
          const target = findJumpTarget(endRow, endCol, 'right', cellData);
          setSelection(prev => prev ? { start: prev.start, end: { row: target.row, col: target.col } } : null);
        } else if (e.metaKey || e.ctrlKey) {
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
          const copyRange = {
            minRow: Math.min(selection.start.row, selection.end.row),
            maxRow: Math.max(selection.start.row, selection.end.row),
            minCol: Math.min(selection.start.col, selection.end.col),
            maxCol: Math.max(selection.start.col, selection.end.col),
          };
          writeToClipboard(cellData, cellFormat, copyRange);
          setCopiedRange(copyRange);
        }
        break;
      case 'v':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          readFromClipboard().then(({ values, formats }) => {
            const { newCellData, newCellFormat } = applyPaste(
              values,
              formats,
              selection.start.row,
              selection.start.col,
              NUM_ROWS,
              NUM_COLS,
              cellData,
              cellFormat,
              copiedRange
            );
            setCellData(newCellData);
            setCellFormat(newCellFormat);
            
            // Update inputValue to show pasted formula in formula bar
            const pastedKey = getCellKey(selection.start.row, selection.start.col);
            setInputValue(newCellData.get(pastedKey)?.raw || '');
          });
        }
        break;
      case 'x':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const cutRange = {
            minRow: Math.min(selection.start.row, selection.end.row),
            maxRow: Math.max(selection.start.row, selection.end.row),
            minCol: Math.min(selection.start.col, selection.end.col),
            maxCol: Math.max(selection.start.col, selection.end.col),
          };
          
          // Copy with formats
          writeToClipboard(cellData, cellFormat, cutRange);
          
          // Delete cells and formats
          setCellData(prev => {
            const next = new Map(prev);
            for (let r = cutRange.minRow; r <= cutRange.maxRow; r++) {
              for (let c = cutRange.minCol; c <= cutRange.maxCol; c++) {
                next.delete(getCellKey(r, c));
              }
            }
            return next;
          });
          setCellFormat(prev => {
            const next = new Map(prev);
            for (let r = cutRange.minRow; r <= cutRange.maxRow; r++) {
              for (let c = cutRange.minCol; c <= cutRange.maxCol; c++) {
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
  }, [selection, isEditing, moveToCell, setCellData, setCellFormat, setInputValue, cellData, cellFormat, setSelection, setIsEditing, setCopiedRange, inputRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!selection) return;

    const { row, col } = selection.start;

    // Handle formula mode arrow keys
    if (isFormulaMode && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      
      // Calculate direction delta
      const deltaRow = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      const deltaCol = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      
      if (e.shiftKey && pointingSelection) {
        // Extend the pointing selection (create/extend range)
        const newEndRow = Math.max(0, Math.min(NUM_ROWS - 1, pointingSelection.end.row + deltaRow));
        const newEndCol = Math.max(0, Math.min(NUM_COLS - 1, pointingSelection.end.col + deltaCol));
        const newSel = { start: pointingSelection.start, end: { row: newEndRow, col: newEndCol } };
        setPointingSelection(newSel);
        updateFormulaWithReference(newSel);
      } else {
        // Start new pointing selection or move it
        let baseRow: number, baseCol: number;
        if (pointingSelection && !endsWithOperator(inputValue)) {
          // Move existing pointing selection
          baseRow = pointingSelection.start.row;
          baseCol = pointingSelection.start.col;
        } else {
          // Start from the editing cell
          baseRow = row;
          baseCol = col;
        }
        
        const newRow = Math.max(0, Math.min(NUM_ROWS - 1, baseRow + deltaRow));
        const newCol = Math.max(0, Math.min(NUM_COLS - 1, baseCol + deltaCol));
        const newSel = { start: { row: newRow, col: newCol }, end: { row: newRow, col: newCol } };
        setPointingSelection(newSel);
        updateFormulaWithReference(newSel);
      }
      return;
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        setPointingSelection(null);
        saveCurrentCell();
        moveToCell(row + 1, col, false);
        break;
      case 'Escape':
        e.preventDefault();
        // Discard changes, reload original value
        const key = getCellKey(row, col);
        setInputValue(cellData.get(key)?.raw || '');
        setIsEditing(false);
        setPointingSelection(null);
        setTimeout(() => containerRef.current?.focus(), 0);
        break;
      case 'Tab':
        e.preventDefault();
        setPointingSelection(null);
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
      case 'Backspace':
        // Smart backspace for empty parentheses
        if (!e.ctrlKey && !e.metaKey) {
          const inputBackspace = e.currentTarget;
          const cursorPos = inputBackspace.selectionStart || 0;
          const value = inputBackspace.value;
          
          // Check if cursor is right after '(' and next char is ')'
          if (cursorPos > 0 && value[cursorPos - 1] === '(' && value[cursorPos] === ')') {
            e.preventDefault();
            // Delete both parentheses
            const newValue = value.slice(0, cursorPos - 1) + value.slice(cursorPos + 1);
            inputBackspace.value = newValue;
            inputBackspace.setSelectionRange(cursorPos - 1, cursorPos - 1);
            setInputValue(newValue);
            return;
          }
        }
        break;
      default:
        // Auto-pair parentheses
        if (e.key === '(' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          const input = e.currentTarget;
          const cursorPos = input.selectionStart || 0;
          const newValue = input.value.slice(0, cursorPos) + '()' + input.value.slice(cursorPos);
          input.value = newValue;
          input.setSelectionRange(cursorPos + 1, cursorPos + 1);
          setInputValue(newValue);
          return;
        }
        
        // If typing an operator in formula mode, commit the current reference
        if (isFormulaMode && pointingSelection && /^[+\-*/^&=<>,)]$/.test(e.key)) {
          setPointingSelection(null);
        }
        break;
    }
  }, [selection, pointingSelection, isFormulaMode, inputValue, saveCurrentCell, moveToCell, cellData, setInputValue, setIsEditing, setPointingSelection, updateFormulaWithReference, containerRef]);

  return {
    handleContainerKeyDown,
    handleKeyDown,
  };
}
