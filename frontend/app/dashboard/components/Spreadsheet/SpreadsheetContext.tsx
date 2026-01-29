"use client";

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { NUM_ROWS, NUM_COLS } from './config';
import type { CellData, CellFormat, CellFormatData, Selection, CopiedRange, ComputedData } from './types';
import { getCellKey, determineCellType } from './drawUtils';
import { useFormulaEngine } from './useFormulaEngine';

type SpreadsheetContextType = {
  // State
  cellData: CellData;
  cellFormat: CellFormatData;
  computedData: ComputedData;
  selection: Selection | null;
  pointingSelection: Selection[] | null;
  inputValue: string;
  isEditing: boolean;
  copiedRange: CopiedRange;
  
  // Setters
  setCellData: React.Dispatch<React.SetStateAction<CellData>>;
  setCellFormat: React.Dispatch<React.SetStateAction<CellFormatData>>;
  setSelection: React.Dispatch<React.SetStateAction<Selection | null>>;
  setPointingSelection: React.Dispatch<React.SetStateAction<Selection[] | null>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setCopiedRange: React.Dispatch<React.SetStateAction<CopiedRange>>;
  
  // Actions
  saveCurrentCell: () => void;
  moveToCell: (row: number, col: number, startEditing?: boolean) => void;
  
  // Formula engine
  getDisplayValue: (key: string) => string;
  
  // Refs for Grid to use
  inputRef: React.RefObject<HTMLInputElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

const SpreadsheetContext = createContext<SpreadsheetContextType | null>(null);

export function SpreadsheetProvider({ children }: { children: React.ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [cellData, setCellData] = useState<CellData>(new Map());
  const [cellFormat, setCellFormat] = useState<CellFormatData>(new Map());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [pointingSelection, setPointingSelection] = useState<Selection[] | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [copiedRange, setCopiedRange] = useState<CopiedRange>(null);

  // Formula engine (auto-detects changes and recalculates)
  const { computedData, getDisplayValue } = useFormulaEngine(cellData);

  const saveCurrentCell = useCallback(() => {
    if (selection) {
      const key = getCellKey(selection.start.row, selection.start.col);
      setCellData(prev => {
        const next = new Map(prev);
        if (inputValue.trim()) {
          next.set(key, {
            raw: inputValue,
            type: determineCellType(inputValue),
          });
        } else {
          next.delete(key);
        }
        return next;
      });
      // Clear pointing selection when saving
      setPointingSelection(null);
    }
  }, [selection, inputValue]);

  const moveToCell = useCallback((row: number, col: number, startEditing = false) => {
    // Clamp to valid range
    const newRow = Math.max(0, Math.min(NUM_ROWS - 1, row));
    const newCol = Math.max(0, Math.min(NUM_COLS - 1, col));

    // Save current cell if editing
    if (isEditing) {
      saveCurrentCell();
    }

    // Set new selection (single cell)
    setSelection({ start: { row: newRow, col: newCol }, end: { row: newRow, col: newCol } });
    const key = getCellKey(newRow, newCol);
    setCellData(prev => {
      setInputValue(prev.get(key)?.raw || '');
      return prev;
    });
    setIsEditing(startEditing);

    // Focus appropriately
    if (startEditing) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setTimeout(() => containerRef.current?.focus(), 0);
    }
  }, [isEditing, saveCurrentCell]);

  return (
    <SpreadsheetContext.Provider
      value={{
        cellData,
        cellFormat,
        computedData,
        selection,
        pointingSelection,
        inputValue,
        isEditing,
        copiedRange,
        setCellData,
        setCellFormat,
        setSelection,
        setPointingSelection,
        setInputValue,
        setIsEditing,
        setCopiedRange,
        saveCurrentCell,
        moveToCell,
        getDisplayValue,
        inputRef,
        containerRef,
      }}
    >
      {children}
    </SpreadsheetContext.Provider>
  );
}

export function useSpreadsheetContext() {
  const context = useContext(SpreadsheetContext);
  if (!context) {
    throw new Error('useSpreadsheetContext must be used within SpreadsheetProvider');
  }
  return context;
}
