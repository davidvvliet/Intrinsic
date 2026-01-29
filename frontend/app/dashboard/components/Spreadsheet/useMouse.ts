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
  pointingSelection,
  setPointingSelection,
  inputRef,
}: {
  getCellFromEvent: (e: MouseEvent | React.MouseEvent) => CellPosition;
  selection: Selection;
  isEditing: boolean;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  cellData: CellData;
  setSelection: React.Dispatch<React.SetStateAction<Selection>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  saveCurrentCell: () => void;
  moveToCell: (row: number, col: number, startEditing?: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputValue: string;
  pointingSelection: Selection;
  setPointingSelection: React.Dispatch<React.SetStateAction<Selection>>;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const isFormulaMode = isEditing && inputValue.startsWith('=');

  const selectionToRef = (sel: Selection): string => {
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
      const newSel = e.shiftKey && pointingSelection
        ? { start: pointingSelection.start, end: cell }
        : { start: cell, end: cell };
      setPointingSelection(newSel);
      updateFormulaWithReference(newSel);
      setIsDragging(true);
      return;
    }

    if (e.shiftKey && selection) {
      // Shift+click: extend selection from anchor
      setSelection(prev => prev ? { start: prev.start, end: cell } : null);
    } else {
      // Normal click: new selection
      if (isEditing) saveCurrentCell();
      setSelection({ start: cell, end: cell });
      setInputValue(cellData.get(getCellKey(cell.row, cell.col))?.raw || '');
      setIsEditing(false);
    }
    setIsDragging(true);
    containerRef.current?.focus();
  }, [getCellFromEvent, selection, isEditing, isFormulaMode, pointingSelection, saveCurrentCell, cellData, setSelection, setPointingSelection, setInputValue, setIsEditing, setIsDragging, containerRef, inputValue]);

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

      if (isFormulaMode && pointingSelection) {
        const newSel = { start: pointingSelection.start, end: cell };
        setPointingSelection(newSel);
        updateFormulaWithReference(newSel);
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
  }, [isDragging, isFormulaMode, setIsDragging, getCellFromEvent, setSelection, pointingSelection, setPointingSelection, inputValue, setInputValue]);

  return {
    handleMouseDown,
    handleCanvasDoubleClick,
  };
}
