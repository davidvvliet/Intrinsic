import { useCallback } from 'react';
import { NUM_ROWS, NUM_COLS } from './config';
import type { CellData, CellFormatData, CellType, CellFormat, Selection, CopiedRange } from './types';
import { getCellKey, getColumnLabel, parseInputValue } from './drawUtils';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { parseCellRef, adjustCellRef, formatCellRef } from './formulaEngine/cellRef';
import { writeToClipboard, readFromClipboard, applyPaste } from './clipboardUtils';
import { scrollToCell } from './scrollUtils';

/**
 * Convert a Selection to a cell reference string (e.g., "A1" or "A1:B5")
 */
function selectionToRef(sel: Selection | null): string {
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

/**
 * Adjust formula references by row/col delta (handles $absolute markers)
 */
function adjustFormulaReferences(formula: string, rowDelta: number, colDelta: number): string {
  if (!formula.startsWith('=')) return formula;

  const cellRefPattern = /\$?[A-Za-z]+\$?\d+/g;

  return formula.replace(cellRefPattern, (match) => {
    const ref = parseCellRef(match);
    if (!ref) return match;

    const adjusted = adjustCellRef(ref, rowDelta, colDelta);
    if (adjusted.row < 0 || adjusted.col < 0) return match;

    return formatCellRef(adjusted);
  });
}

export function useKeyboard({
  selection,
  isEditing,
  inputValue,
  cellData,
  cellFormat,
  copiedRange,
  updateCells,
  updateCellFormats,
  setSelection,
  setIsEditing,
  setInputValue,
  setCopiedRange,
  moveToCell,
  saveCurrentCell,
  inputRef,
  containerRef,
  showFunctionDropdown,
  filteredFunctions,
  selectedFunctionIndex,
  setShowFunctionDropdown,
  setSelectedFunctionIndex,
  insertFunction,
  parseCellReferencesFromFormula,
  setHighlightedCells,
  highlightedCells,
  zoom,
  undo,
  redo,
  canUndo,
  canRedo,
  columnWidths,
}: {
  selection: Selection | null;
  isEditing: boolean;
  inputValue: string;
  cellData: CellData;
  cellFormat: CellFormatData;
  copiedRange: CopiedRange;
  updateCells: (newCellData: Map<string, { raw: string; type: CellType }>) => void;
  updateCellFormats: (newCellFormat: Map<string, CellFormat>) => void;
  setSelection: React.Dispatch<React.SetStateAction<Selection | null>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  setCopiedRange: React.Dispatch<React.SetStateAction<CopiedRange>>;
  moveToCell: (row: number, col: number, startEditing?: boolean) => void;
  saveCurrentCell: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  showFunctionDropdown: boolean;
  filteredFunctions: string[];
  selectedFunctionIndex: number;
  setShowFunctionDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedFunctionIndex: React.Dispatch<React.SetStateAction<number>>;
  insertFunction: (functionName: string) => void;
  parseCellReferencesFromFormula: (value: string) => Selection[];
  setHighlightedCells: React.Dispatch<React.SetStateAction<Selection[] | null>>;
  highlightedCells: Selection[] | null;
  zoom: number;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  columnWidths: Map<number, number>;
}) {
  // Check if we're in formula mode (editing a formula)
  const isFormulaMode = isEditing && inputValue.startsWith('=');

  /**
   * Update the formula with a cell reference based on pointing selection
   */
  const updateFormulaWithReference = useCallback((newPointingSel: Selection) => {
    if (!newPointingSel) return;
    
    const ref = selectionToRef(newPointingSel);
    let newValue: string;
    
    // Check if formula ends with empty parentheses (from auto-pairing)
    if (inputValue.endsWith('()')) {
      // Insert reference before the closing parenthesis
      newValue = inputValue.slice(0, -1) + ref + ')';
    } else {
      // Check if formula ends with a cell reference followed by closing parenthesis
      // e.g., =SUM(A1) or =SUM(A1:B5)
      const refBeforeParenMatch = inputValue.match(/(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)\)$/);
      if (refBeforeParenMatch) {
        // Replace the reference before the closing parenthesis
        const refStart = inputValue.length - refBeforeParenMatch[0].length;
        newValue = inputValue.slice(0, refStart) + ref + ')';
      } else {
        const trailingRefStart = findTrailingReference(inputValue);
        if (trailingRefStart >= 0 && !endsWithOperator(inputValue)) {
          // Replace the trailing reference
          newValue = inputValue.slice(0, trailingRefStart) + ref;
        } else {
          // Append new reference
          newValue = inputValue + ref;
        }
      }
    }
    
    // Set cursor position inside parentheses (or at end)
    if (inputRef.current) {
      inputRef.current.value = newValue;
      const cursorPos = newValue.endsWith(')') ? newValue.length - 1 : newValue.length;
      inputRef.current.setSelectionRange(cursorPos, cursorPos);
    }
    setInputValue(newValue);
  }, [inputValue, setInputValue, inputRef]);
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

          // Create new Map with all current cells except the deleted ones
          const newCellData = new Map(cellData);
          for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
              newCellData.delete(getCellKey(row, col));
            }
          }
          updateCells(newCellData);
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
            updateCells(newCellData);
            updateCellFormats(newCellFormat);
            
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
          const newCellDataAfterCut = new Map(cellData);
          const newCellFormatAfterCut = new Map(cellFormat);
          for (let r = cutRange.minRow; r <= cutRange.maxRow; r++) {
            for (let c = cutRange.minCol; c <= cutRange.maxCol; c++) {
              const key = getCellKey(r, c);
              newCellDataAfterCut.delete(key);
              newCellFormatAfterCut.delete(key);
            }
          }
          updateCells(newCellDataAfterCut);
          updateCellFormats(newCellFormatAfterCut);
          setInputValue('');
        }
        break;
      case 'z':
        if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
          // Ctrl+Shift+Z: Redo
          e.preventDefault();
          if (canRedo) {
            redo();
          }
        } else if (e.ctrlKey || e.metaKey) {
          // Ctrl+Z: Undo
          e.preventDefault();
          if (canUndo) {
            undo();
          }
        }
        break;
      case 'd':
        // Ctrl+D: Fill (down if multi-row, right if multi-col horizontal)
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const minRow = Math.min(selection.start.row, selection.end.row);
          const maxRow = Math.max(selection.start.row, selection.end.row);
          const minCol = Math.min(selection.start.col, selection.end.col);
          const maxCol = Math.max(selection.start.col, selection.end.col);

          const cellUpdates = new Map(cellData);

          // Fill down if multi-row
          if (maxRow > minRow) {
            for (let col = minCol; col <= maxCol; col++) {
              const sourceKey = getCellKey(minRow, col);
              const sourceCell = cellData.get(sourceKey);
              if (!sourceCell) continue;

              for (let row = minRow + 1; row <= maxRow; row++) {
                const rowDelta = row - minRow;
                let newValue: string;
                if (sourceCell.type === 'formula') {
                  newValue = adjustFormulaReferences(sourceCell.raw, rowDelta, 0);
                } else {
                  newValue = sourceCell.raw;
                }
                const key = getCellKey(row, col);
                const parsed = parseInputValue(newValue);
                cellUpdates.set(key, { raw: parsed.value, type: parsed.type });
              }
            }
            updateCells(cellUpdates);
          }
          // Fill right if multi-col (and single row)
          else if (maxCol > minCol) {
            for (let row = minRow; row <= maxRow; row++) {
              const sourceKey = getCellKey(row, minCol);
              const sourceCell = cellData.get(sourceKey);
              if (!sourceCell) continue;

              for (let col = minCol + 1; col <= maxCol; col++) {
                const colDelta = col - minCol;
                let newValue: string;
                if (sourceCell.type === 'formula') {
                  newValue = adjustFormulaReferences(sourceCell.raw, 0, colDelta);
                } else {
                  newValue = sourceCell.raw;
                }
                const key = getCellKey(row, col);
                const parsed = parseInputValue(newValue);
                cellUpdates.set(key, { raw: parsed.value, type: parsed.type });
              }
            }
            updateCells(cellUpdates);
          }
        }
        break;
      case 'f':
        // Ctrl+F: Open find bar
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          useSpreadsheetStore.getState().setFindOpen(true);
        }
        break;
      case 'b':
        // Ctrl+B: Toggle bold
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const minRow = Math.min(selection.start.row, selection.end.row);
          const maxRow = Math.max(selection.start.row, selection.end.row);
          const minCol = Math.min(selection.start.col, selection.end.col);
          const maxCol = Math.max(selection.start.col, selection.end.col);

          // Check if any cell in selection is bold
          let anyBold = false;
          for (let r = minRow; r <= maxRow && !anyBold; r++) {
            for (let c = minCol; c <= maxCol && !anyBold; c++) {
              const format = cellFormat.get(getCellKey(r, c));
              if (format?.bold) anyBold = true;
            }
          }

          // Toggle: if any bold, remove all; else add all
          const newFormats = new Map(cellFormat);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              const key = getCellKey(r, c);
              const existing = cellFormat.get(key) || {};
              newFormats.set(key, { ...existing, bold: !anyBold });
            }
          }
          updateCellFormats(newFormats);
        }
        break;
      case 'i':
        // Ctrl+I: Toggle italic
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const minRow = Math.min(selection.start.row, selection.end.row);
          const maxRow = Math.max(selection.start.row, selection.end.row);
          const minCol = Math.min(selection.start.col, selection.end.col);
          const maxCol = Math.max(selection.start.col, selection.end.col);

          // Check if any cell in selection is italic
          let anyItalic = false;
          for (let r = minRow; r <= maxRow && !anyItalic; r++) {
            for (let c = minCol; c <= maxCol && !anyItalic; c++) {
              const format = cellFormat.get(getCellKey(r, c));
              if (format?.italic) anyItalic = true;
            }
          }

          // Toggle: if any italic, remove all; else add all
          const newFormats = new Map(cellFormat);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              const key = getCellKey(r, c);
              const existing = cellFormat.get(key) || {};
              newFormats.set(key, { ...existing, italic: !anyItalic });
            }
          }
          updateCellFormats(newFormats);
        }
        break;
      case 'u':
        // Ctrl+U: Toggle underline
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const minRow = Math.min(selection.start.row, selection.end.row);
          const maxRow = Math.max(selection.start.row, selection.end.row);
          const minCol = Math.min(selection.start.col, selection.end.col);
          const maxCol = Math.max(selection.start.col, selection.end.col);

          // Check if any cell in selection is underlined
          let anyUnderline = false;
          for (let r = minRow; r <= maxRow && !anyUnderline; r++) {
            for (let c = minCol; c <= maxCol && !anyUnderline; c++) {
              const format = cellFormat.get(getCellKey(r, c));
              if (format?.underline) anyUnderline = true;
            }
          }

          // Toggle: if any underlined, remove all; else add all
          const newFormats = new Map(cellFormat);
          for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
              const key = getCellKey(r, c);
              const existing = cellFormat.get(key) || {};
              newFormats.set(key, { ...existing, underline: !anyUnderline });
            }
          }
          updateCellFormats(newFormats);
        }
        break;
      default:
        // Start editing on any printable character
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          const key = getCellKey(selection.start.row, selection.start.col);
          const format = cellFormat.get(key);
          // Preserve percent format when typing over
          if (format?.numberFormat?.type === 'percent') {
            setInputValue(e.key + '%');
          } else {
            setInputValue(e.key);
          }
          setIsEditing(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }
        break;
    }
  }, [selection, isEditing, moveToCell, updateCells, updateCellFormats, setInputValue, cellData, cellFormat, setSelection, setIsEditing, setCopiedRange, inputRef, undo, redo, canUndo, canRedo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!selection) return;

    const { row, col } = selection.start;

    // Handle function dropdown navigation FIRST (takes priority over formula mode)
    if (showFunctionDropdown && filteredFunctions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedFunctionIndex(prev => (prev + 1) % filteredFunctions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedFunctionIndex(prev => (prev - 1 + filteredFunctions.length) % filteredFunctions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertFunction(filteredFunctions[selectedFunctionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowFunctionDropdown(false);
        return;
      }
    }

    // Handle formula mode arrow keys (only when dropdown not showing)
    if (isFormulaMode && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      
      // Get existing references from current formula (before navigation updates it)
      const existingRefs = parseCellReferencesFromFormula(inputValue);
      
      // Get base position - use last highlighted cell if exists, otherwise use editing cell
      let baseRow: number, baseCol: number;
      if (highlightedCells && highlightedCells.length > 0 && !endsWithOperator(inputValue)) {
        const lastSel = highlightedCells[highlightedCells.length - 1];
        baseRow = lastSel.start.row;
        baseCol = lastSel.start.col;
      } else {
        baseRow = row;
        baseCol = col;
      }
      
      let newSel: Selection;
      
      // Cmd/Ctrl+Arrow: jump to next non-empty cell
      if (e.metaKey || e.ctrlKey) {
        const direction = e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowDown' ? 'down' : e.key === 'ArrowLeft' ? 'left' : 'right';
        const target = findJumpTarget(baseRow, baseCol, direction, cellData);
        newSel = { start: { row: target.row, col: target.col }, end: { row: target.row, col: target.col } };
      } else if (e.shiftKey && highlightedCells && highlightedCells.length > 0 && highlightedCells[0]) {
        // Shift+Arrow: extend the last selection (create/extend range)
        const lastSel = highlightedCells[highlightedCells.length - 1];
        const deltaRow = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
        const deltaCol = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        const newEndRow = Math.max(0, Math.min(NUM_ROWS - 1, lastSel.end.row + deltaRow));
        const newEndCol = Math.max(0, Math.min(NUM_COLS - 1, lastSel.end.col + deltaCol));
        newSel = { start: lastSel.start, end: { row: newEndRow, col: newEndCol } };
      } else {
        // Normal Arrow: move one cell
        const deltaRow = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
        const deltaCol = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        const newRow = Math.max(0, Math.min(NUM_ROWS - 1, baseRow + deltaRow));
        const newCol = Math.max(0, Math.min(NUM_COLS - 1, baseCol + deltaCol));
        newSel = { start: { row: newRow, col: newCol }, end: { row: newRow, col: newCol } };
      }
      
      // Update formula with new reference
      updateFormulaWithReference(newSel);
      
      // Synchronously update highlightedCells: existing refs + navigating cell
      const allSelections = [...existingRefs, newSel];
      setHighlightedCells(allSelections);
      
      // Scroll to the navigated cell
      scrollToCell(newSel.start.row, newSel.start.col, containerRef, zoom, columnWidths);
      
      return;
    }

    switch (e.key) {
      case 'Enter':
        if (!showFunctionDropdown) {
          e.preventDefault();
          // Clear highlightedCells - useEffect will update it from formula
          setHighlightedCells(null);
          saveCurrentCell();
          moveToCell(row + 1, col, false);
        }
        break;
      case 'Escape':
        if (!showFunctionDropdown) {
          e.preventDefault();
          // Discard changes, reload original value
          const key = getCellKey(row, col);
          setInputValue(cellData.get(key)?.raw || '');
          setIsEditing(false);
          setHighlightedCells(null);
          setTimeout(() => containerRef.current?.focus(), 0);
        }
        break;
      case 'Tab':
        if (!showFunctionDropdown) {
          e.preventDefault();
          // Clear highlightedCells - useEffect will update it from formula
          setHighlightedCells(null);
          saveCurrentCell();
          if (e.shiftKey) {
            moveToCell(row, col - 1, false);
          } else {
            moveToCell(row, col + 1, false);
          }
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
        // Materialize closing parenthesis if user types ')' over auto-inserted one
        if (e.key === ')' && !e.ctrlKey && !e.metaKey) {
          const input = e.currentTarget;
          const cursorPos = input.selectionStart || 0;
          const value = input.value;
          
          // Check if next character is already ')'
          if (value[cursorPos] === ')') {
            e.preventDefault();
            // Just move cursor forward, don't insert new ')'
            input.setSelectionRange(cursorPos + 1, cursorPos + 1);
            return;
          }
        }
        
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
        
        // If typing an operator in formula mode, clear highlightedCells - useEffect will update from formula
        if (isFormulaMode && /^[+\-*/^&=<>,)]$/.test(e.key)) {
          setHighlightedCells(null);
        }
        break;
    }
  }, [selection, isFormulaMode, inputValue, saveCurrentCell, moveToCell, cellData, setInputValue, setIsEditing, updateFormulaWithReference, containerRef, inputRef, showFunctionDropdown, filteredFunctions, selectedFunctionIndex, setShowFunctionDropdown, setSelectedFunctionIndex, insertFunction, parseCellReferencesFromFormula, setHighlightedCells, highlightedCells, endsWithOperator, zoom]);

  return {
    handleContainerKeyDown,
    handleKeyDown,
  };
}
