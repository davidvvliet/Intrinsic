"use client";

import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { NUM_ROWS, NUM_COLS, CELL_WIDTH, CELL_FONT_SIZE, CELL_TEXT_PADDING } from './config';
import type { CellData, CellFormat, CellFormatData, CellType, Selection, CopiedRange, ComputedData } from './types';
import { getCellKey, determineCellType, getColumnLabel } from './drawUtils';
import { useFormulaEngine } from './useFormulaEngine';

type SpreadsheetContextType = {
  // State
  cellData: CellData;
  cellFormat: CellFormatData;
  computedData: ComputedData;
  selection: Selection | null;
  highlightedCells: Selection[] | null;
  inputValue: string;
  isEditing: boolean;
  copiedRange: CopiedRange;
  animatingRanges: CopiedRange[];
  dirtyCells: Set<string>;
  hasUnsavedChanges: boolean;

  // Setters
  setCellData: React.Dispatch<React.SetStateAction<CellData>>;
  setCellFormat: React.Dispatch<React.SetStateAction<CellFormatData>>;
  setBaselineData: React.Dispatch<React.SetStateAction<CellData>>;
  setBaselineFormat: React.Dispatch<React.SetStateAction<CellFormatData>>;
  setDirtyCells: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelection: React.Dispatch<React.SetStateAction<Selection | null>>;
  setHighlightedCells: React.Dispatch<React.SetStateAction<Selection[] | null>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setCopiedRange: React.Dispatch<React.SetStateAction<CopiedRange>>;
  setAnimatingRanges: React.Dispatch<React.SetStateAction<CopiedRange[]>>;
  
  // Actions
  saveCurrentCell: () => void;
  moveToCell: (row: number, col: number, startEditing?: boolean) => void;
  updateCell: (key: string, value: { raw: string; type: CellType } | null) => void;
  updateCellFormat: (key: string, format: CellFormat | null) => void;
  updateCells: (newCellData: Map<string, { raw: string; type: CellType }>) => void;
  updateCellFormats: (newCellFormat: Map<string, CellFormat>) => void;
  markSaved: () => void;
  
  // Formula engine
  getDisplayValue: (key: string) => string;
  
  // Active sheet
  activeSheetId: string | null;
  setActiveSheetId: React.Dispatch<React.SetStateAction<string | null>>;
  
  // Sheets metadata
  sheets: Array<{
    sheetId: string;
    fetchId: string | null;
    name: string;
    createdAt: string;
  }>;
  setSheets: React.Dispatch<React.SetStateAction<Array<{
    sheetId: string;
    fetchId: string | null;
    name: string;
    createdAt: string;
  }>>>;
  
  // Column widths
  columnWidths: Map<number, number>;
  columnWidthsBySheet: Map<string, Map<number, number>>;
  setColumnWidthsBySheet: React.Dispatch<React.SetStateAction<Map<string, Map<number, number>>>>;
  getColumnX: (col: number) => number;
  autoResizeColumn: (col: number) => void;
  
  // Refs for Grid to use
  inputRef: React.RefObject<HTMLInputElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

const SpreadsheetContext = createContext<SpreadsheetContextType | null>(null);

export function SpreadsheetProvider({ children }: { children: React.ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Array<{
    sheetId: string;
    fetchId: string | null;
    name: string;
    createdAt: string;
  }>>([]);

  const [cellData, setCellData] = useState<CellData>(new Map());
  const [cellFormat, setCellFormat] = useState<CellFormatData>(new Map());
  const [baselineData, setBaselineData] = useState<CellData>(new Map());
  const [baselineFormat, setBaselineFormat] = useState<CellFormatData>(new Map());
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<Selection[] | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [copiedRange, setCopiedRange] = useState<CopiedRange>(null);
  const [animatingRanges, setAnimatingRanges] = useState<CopiedRange[]>([]);
  const [columnWidthsBySheet, setColumnWidthsBySheet] = useState<Map<string, Map<number, number>>>(new Map());

  // Formula engine (auto-detects changes and recalculates)
  const { computedData, getDisplayValue } = useFormulaEngine(cellData);

  // Compute current column widths from activeSheetId
  const columnWidths = useMemo(() => {
    return columnWidthsBySheet.get(activeSheetId || '') || new Map<number, number>();
  }, [columnWidthsBySheet, activeSheetId]);

  // Cached cumulative widths array for O(1) lookups
  const cumulativeWidths = useMemo(() => {
    const arr = new Array(NUM_COLS + 1);
    arr[0] = 0;
    for (let i = 0; i < NUM_COLS; i++) {
      arr[i + 1] = arr[i] + (columnWidths.get(i) || CELL_WIDTH);
    }
    return arr;
  }, [columnWidths]);

  // Get cumulative x position of a column (O(1) lookup)
  const getColumnX = useCallback((col: number): number => {
    return cumulativeWidths[col] || 0;
  }, [cumulativeWidths]);

  // Auto-resize column based on widest value
  const autoResizeColumn = useCallback((col: number) => {
    if (col < 0 || col >= NUM_COLS) return;

    let maxWidth = CELL_WIDTH; // Default minimum width

    // Measure visible rows + buffer (first 1000 rows for performance)
    const measureRows = Math.min(1000, NUM_ROWS);
    
    for (let row = 0; row < measureRows; row++) {
      const cellKey = getCellKey(row, col);
      const displayValue = getDisplayValue(cellKey);
      
      if (displayValue) {
        // Create a temporary canvas to measure text width
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

    // Also check header label width
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `bold ${CELL_FONT_SIZE}px Arial`;
      const headerLabel = getColumnLabel(col);
      const headerWidth = ctx.measureText(headerLabel).width + CELL_TEXT_PADDING * 2;
      maxWidth = Math.max(maxWidth, headerWidth);
    }

    if (!activeSheetId) return;

    setColumnWidthsBySheet(prev => {
      const next = new Map(prev);
      const sheetWidths = new Map(next.get(activeSheetId) || new Map());
      sheetWidths.set(col, maxWidth);
      next.set(activeSheetId, sheetWidths);
      return next;
    });
  }, [cellFormat, getDisplayValue, activeSheetId]);

  // Computed: has unsaved changes
  const hasUnsavedChanges = dirtyCells.size > 0;

  // Wrapper to update cell and mark dirty
  const updateCell = useCallback((key: string, value: { raw: string; type: CellType } | null) => {
    setCellData(prev => {
      const next = new Map(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      
      // Mark dirty if different from baseline
      const baselineValue = baselineData.get(key);
      const newRaw = value?.raw || '';
      const baselineRaw = baselineValue?.raw || '';
      
      if (newRaw !== baselineRaw) {
        setDirtyCells(prev => new Set(prev).add(key));
      } else {
        // If matches baseline, remove from dirty
        setDirtyCells(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
      
      return next;
    });
  }, [baselineData]);

  // Wrapper to update cell format and mark dirty
  const updateCellFormat = useCallback((key: string, format: CellFormat | null) => {
    setCellFormat(prev => {
      const next = new Map(prev);
      if (format) {
        next.set(key, format);
      } else {
        next.delete(key);
      }
      
      // Mark dirty if different from baseline
      const baselineFmt = baselineFormat.get(key);
      const formatStr = format ? JSON.stringify(format) : '';
      const baselineStr = baselineFmt ? JSON.stringify(baselineFmt) : '';
      
      if (formatStr !== baselineStr) {
        setDirtyCells(prev => new Set(prev).add(key));
      } else {
        setDirtyCells(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
      
      return next;
    });
  }, [baselineFormat]);

  // Bulk update cells with automatic dirty tracking
  const updateCells = useCallback((
    newCellData: Map<string, { raw: string; type: CellType }>
  ) => {
    setCellData(prev => {
      const next = new Map(newCellData);  // Use newCellData directly - deletions already handled
      
      // Track dirty for all affected keys
      const allKeys = new Set([...prev.keys(), ...newCellData.keys()]);
      allKeys.forEach(key => {
        const prevValue = prev.get(key);
        const nextValue = next.get(key);
        const baselineValue = baselineData.get(key);
        
        const prevRaw = prevValue?.raw || '';
        const nextRaw = nextValue?.raw || '';
        const baselineRaw = baselineValue?.raw || '';
        
        if (nextRaw !== baselineRaw) {
          setDirtyCells(dirty => new Set(dirty).add(key));
        } else {
          setDirtyCells(dirty => {
            const newDirty = new Set(dirty);
            newDirty.delete(key);
            return newDirty;
          });
        }
      });
      
      return next;
    });
  }, [baselineData]);

  // Bulk update cell formats with automatic dirty tracking
  const updateCellFormats = useCallback((
    newCellFormat: Map<string, CellFormat>
  ) => {
    setCellFormat(prev => {
      const next = new Map(newCellFormat);  // Use newCellFormat directly - deletions already handled
      
      // Track dirty for all affected keys
      const allKeys = new Set([...prev.keys(), ...newCellFormat.keys()]);
      allKeys.forEach(key => {
        const prevFormat = prev.get(key);
        const nextFormat = next.get(key);
        const baselineFmt = baselineFormat.get(key);
        
        const prevStr = prevFormat ? JSON.stringify(prevFormat) : '';
        const nextStr = nextFormat ? JSON.stringify(nextFormat) : '';
        const baselineStr = baselineFmt ? JSON.stringify(baselineFmt) : '';
        
        if (nextStr !== baselineStr) {
          setDirtyCells(dirty => new Set(dirty).add(key));
        } else {
          setDirtyCells(dirty => {
            const newDirty = new Set(dirty);
            newDirty.delete(key);
            return newDirty;
          });
        }
      });
      
      return next;
    });
  }, [baselineFormat]);

  // Mark all changes as saved (update baseline, clear dirty)
  const markSaved = useCallback(() => {
    setBaselineData(new Map(cellData));
    setBaselineFormat(new Map(cellFormat));
    setDirtyCells(new Set());
  }, [cellData, cellFormat]);

  const saveCurrentCell = useCallback(() => {
    if (selection) {
      const key = getCellKey(selection.start.row, selection.start.col);
      if (inputValue.trim()) {
        updateCell(key, {
          raw: inputValue,
          type: determineCellType(inputValue),
        });
      } else {
        updateCell(key, null);
      }
      // Clear highlighted cells when saving
      setHighlightedCells(null);
    }
  }, [selection, inputValue, updateCell]);

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
        highlightedCells,
        inputValue,
        isEditing,
        copiedRange,
        animatingRanges,
        dirtyCells,
        hasUnsavedChanges,
        setCellData,
        setCellFormat,
        setBaselineData,
        setBaselineFormat,
        setDirtyCells,
        setSelection,
        setHighlightedCells,
        setInputValue,
        setIsEditing,
        setCopiedRange,
        setAnimatingRanges,
        saveCurrentCell,
        moveToCell,
        updateCell,
        updateCellFormat,
        updateCells,
        updateCellFormats,
        markSaved,
        getDisplayValue,
        activeSheetId,
        setActiveSheetId,
        sheets,
        setSheets,
        columnWidths,
        columnWidthsBySheet,
        setColumnWidthsBySheet,
        getColumnX,
        autoResizeColumn,
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
