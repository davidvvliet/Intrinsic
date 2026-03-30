import { useCallback, useEffect } from 'react';
import type { CellData, Selection, CellPosition } from './types';
import { getCellKey, getColumnLabel } from './drawUtils';

export function useMouse({
  getCellFromEvent,
  selection,
  isEditing,
  isDragging,
  setIsDragging,
  cellData,
  setSelection,
  setIsEditing,
  setInputValue,
  saveCurrentCell,
  moveToCell,
  containerRef,
  inputValue,
  parseCellReferencesFromFormula,
  setHighlightedCells,
  inputRef,
  addSelectedRange,
  clearSelectedRanges,
}: {
  getCellFromEvent: (e: MouseEvent | React.MouseEvent) => CellPosition;
  selection: Selection | null;
  isEditing: boolean;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  cellData: CellData;
  setSelection: React.Dispatch<React.SetStateAction<Selection | null>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  saveCurrentCell: () => void;
  moveToCell: (row: number, col: number, startEditing?: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputValue: string;
  parseCellReferencesFromFormula: (value: string) => Selection[];
  setHighlightedCells: React.Dispatch<React.SetStateAction<Selection[] | null>>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  addSelectedRange: (range: {start: {row: number; col: number}; end: {row: number; col: number}}) => void;
  clearSelectedRanges: () => void;
}) {
  const isFormulaMode = isEditing && inputValue.startsWith('=');

  const selectionToRef = (sel: Selection | null): string => {
    if (!sel) return '';
    const startCol = getColumnLabel(sel.start.col);
    const startRow = sel.start.row + 1;
    if (sel.start.row === sel.end.row && sel.start.col === sel.end.col) {
      return `${startCol}${startRow}`;
    }
    const endCol = getColumnLabel(sel.end.col);
    const endRow = sel.end.row + 1;
    return `${startCol}${startRow}:${endCol}${endRow}`;
  };

  const findTrailingReference = (formula: string): number => {
    const match = formula.match(/(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)$/);
    if (match) {
      return formula.length - match[1].length;
    }
    return -1;
  };

  const endsWithOperator = (formula: string): boolean => {
    const trimmed = formula.trim();
    return /[+\-*/^&=<>,(]$/.test(trimmed) || trimmed === '=';
  };

  const updateFormulaWithReference = (newPointingSel: Selection) => {
    if (!newPointingSel) return;
    const ref = selectionToRef(newPointingSel);
    let newValue: string;
    
    if (inputValue.endsWith('()')) {
      newValue = inputValue.slice(0, -1) + ref + ')';
    } else {
      const refBeforeParenMatch = inputValue.match(/(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)\)$/);
      if (refBeforeParenMatch) {
        const refStart = inputValue.length - refBeforeParenMatch[0].length;
        newValue = inputValue.slice(0, refStart) + ref + ')';
      } else {
        const trailingRefStart = findTrailingReference(inputValue);
        if (trailingRefStart >= 0 && !endsWithOperator(inputValue)) {
          newValue = inputValue.slice(0, trailingRefStart) + ref;
        } else {
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
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = getCellFromEvent(e);
    if (!cell) return;

    if (isFormulaMode) {
      e.preventDefault();
      // Get existing references from current formula
      const existingRefs = parseCellReferencesFromFormula(inputValue);
      const lastSel = existingRefs.length > 0 ? existingRefs[existingRefs.length - 1] : null;

      const newSel = e.shiftKey && lastSel
        ? { start: lastSel.start, end: cell }
        : { start: cell, end: cell };

      // Update formula with new reference
      updateFormulaWithReference(newSel);

      // Synchronously update highlightedCells: existing refs + navigating cell
      const allSelections = [...existingRefs, newSel];
      setHighlightedCells(allSelections);

      setIsDragging(true);
      return;
    }

    // Cmd/Ctrl+click: lock current selection into selectedRanges, start new selection at clicked cell
    const isCmdClick = (e.metaKey || e.ctrlKey) && !e.shiftKey;
    if (isCmdClick && selection) {
      e.preventDefault();
      addSelectedRange({
        start: { row: Math.min(selection.start.row, selection.end.row), col: Math.min(selection.start.col, selection.end.col) },
        end: { row: Math.max(selection.start.row, selection.end.row), col: Math.max(selection.start.col, selection.end.col) },
      });
      setSelection({ start: cell, end: cell });
      setInputValue(cellData.get(getCellKey(cell.row, cell.col))?.raw || '');
      setIsDragging(true);
      return;
    }

    if (e.shiftKey && selection) {
      // Shift+click: extend selection from anchor
      setSelection(prev => prev ? { start: prev.start, end: cell } : null);
    } else {
      // Normal click: new selection, clear multi-range selection
      if (isEditing) saveCurrentCell();
      clearSelectedRanges();
      setSelection({ start: cell, end: cell });
      setInputValue(cellData.get(getCellKey(cell.row, cell.col))?.raw || '');
      setIsEditing(false);
    }
    setIsDragging(true);
    containerRef.current?.focus();
  }, [getCellFromEvent, selection, isEditing, isFormulaMode, saveCurrentCell, cellData, setSelection, setInputValue, setIsEditing, setIsDragging, containerRef, inputValue, parseCellReferencesFromFormula, setHighlightedCells, addSelectedRange, clearSelectedRanges]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = getCellFromEvent(e);
    if (!cell) return;
    moveToCell(cell.row, cell.col, true); // Edit mode
  }, [getCellFromEvent, moveToCell]);

  // Mouse drag selection
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const cell = getCellFromEvent(e);
      if (!cell) return;

      if (isFormulaMode) {
        // Get existing references from current formula
        const existingRefs = parseCellReferencesFromFormula(inputValue);
        const lastSel = existingRefs.length > 0 ? existingRefs[existingRefs.length - 1] : null;
        
        if (lastSel) {
          const newSel = { start: lastSel.start, end: cell };
          // Update formula with new reference
          updateFormulaWithReference(newSel);
          
          // Synchronously update highlightedCells: existing refs + navigating cell
          const allSelections = [...existingRefs, newSel];
          setHighlightedCells(allSelections);
        }
        return;
      }

      if (selection) {
        setSelection(prev => prev ? { start: prev.start, end: cell } : null);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isFormulaMode, setIsDragging, getCellFromEvent, setSelection, inputValue, setInputValue, parseCellReferencesFromFormula, setHighlightedCells]);

  return {
    handleMouseDown,
    handleCanvasDoubleClick,
  };
}
