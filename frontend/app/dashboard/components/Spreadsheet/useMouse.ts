import { useCallback, useEffect } from 'react';
import type { CellData, Selection, CellPosition } from './types';
import { getCellKey } from './drawUtils';

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
}) {
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = getCellFromEvent(e);
    if (!cell) return;

    if (e.shiftKey && selection) {
      // Shift+click: extend selection from anchor
      setSelection(prev => prev ? { start: prev.start, end: cell } : null);
    } else {
      // Normal click: new selection
      if (isEditing) saveCurrentCell();
      setSelection({ start: cell, end: cell });
      setInputValue(cellData.get(getCellKey(cell.row, cell.col)) || '');
      setIsEditing(false);
    }
    setIsDragging(true);
    containerRef.current?.focus();
  }, [getCellFromEvent, selection, isEditing, saveCurrentCell, cellData, setSelection, setInputValue, setIsEditing, setIsDragging, containerRef]);

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
      if (cell) {
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
  }, [isDragging, setIsDragging, getCellFromEvent, setSelection]);

  return {
    handleMouseDown,
    handleCanvasDoubleClick,
  };
}
