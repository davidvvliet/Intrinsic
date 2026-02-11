"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useSpreadsheet } from '../../hooks/useSpreadsheet';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { useRefContext } from './RefContext';
import { useSpreadsheetActions } from './useSpreadsheetActions';
import { useKeyboard } from './useKeyboard';
import { useMouse } from './useMouse';
import styles from './Grid.module.css';
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  NUM_ROWS,
  NUM_COLS,
  HEADER_WIDTH,
  HEADER_HEIGHT,
  CELL_FONT_SIZE,
} from './config';
import type { Selection } from './types';
import { drawGrid as drawGridUtil, getFormulaSegments } from './drawUtils';
import { FORMULA_REFERENCE_COLORS } from './config';
import { parseCellRef, adjustCellRef, formatCellRef } from './formulaEngine/cellRef';
import { EXCEL_FUNCTION_SIGNATURES } from './formulaEngine/excelfunctions';
import { getCellKey, parseInputValue } from './drawUtils';

const FUNCTION_NAMES = Object.keys(EXCEL_FUNCTION_SIGNATURES).sort();

export default function Grid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Get state from store
  const cellData = useSpreadsheetStore(state => state.cellData);
  const cellFormat = useSpreadsheetStore(state => state.cellFormat);
  const computedData = useSpreadsheetStore(state => state.computedData);
  const selection = useSpreadsheetStore(state => state.selection);
  const highlightedCells = useSpreadsheetStore(state => state.highlightedCells);
  const inputValue = useSpreadsheetStore(state => state.inputValue);
  const isEditing = useSpreadsheetStore(state => state.isEditing);
  const copiedRange = useSpreadsheetStore(state => state.copiedRange);
  const animatingRanges = useSpreadsheetStore(state => state.animatingRanges);
  const columnWidths = useSpreadsheetStore(state => state.columnWidths);
  const canUndo = useSpreadsheetStore(state => state.canUndo);
  const canRedo = useSpreadsheetStore(state => state.canRedo);

  // Get actions from store
  const updateCells = useSpreadsheetStore(state => state.updateCells);
  const updateCellFormats = useSpreadsheetStore(state => state.updateCellFormats);
  const setSelection = useSpreadsheetStore(state => state.setSelection);
  const setHighlightedCells = useSpreadsheetStore(state => state.setHighlightedCells);
  const setInputValue = useSpreadsheetStore(state => state.setInputValue);
  const setIsEditing = useSpreadsheetStore(state => state.setIsEditing);
  const setCopiedRange = useSpreadsheetStore(state => state.setCopiedRange);
  const undo = useSpreadsheetStore(state => state.undo);
  const redo = useSpreadsheetStore(state => state.redo);

  // Get refs and actions that need refs
  const { inputRef, containerRef } = useRefContext();
  const { saveCurrentCell, moveToCell, getColumnX, autoResizeColumn } = useSpreadsheetActions();

  // Grid-specific state
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dashOffset, setDashOffset] = useState(0);
  const [showFunctionDropdown, setShowFunctionDropdown] = useState(false);
  const [filteredFunctions, setFilteredFunctions] = useState<string[]>([]);
  const [selectedFunctionIndex, setSelectedFunctionIndex] = useState(0);
  const [hoveredColumnBorder, setHoveredColumnBorder] = useState<number | null>(null);

  // Fill handle drag state
  const [isFillDragging, setIsFillDragging] = useState(false);
  const [fillDragStart, setFillDragStart] = useState<{ row: number; col: number } | null>(null);
  const [fillDragEnd, setFillDragEnd] = useState<{ row: number; col: number } | null>(null);

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawGridUtil({
      ctx,
      canvas,
      container,
      cellData,
      cellFormat,
      computedData,
      selection,
      highlightedCells,
      copiedRange,
      animatingRanges,
      dashOffset,
      zoom,
      isEditing,
      columnWidths,
      getColumnX,
    });
  }, [cellData, cellFormat, computedData, selection, highlightedCells, zoom, copiedRange, animatingRanges, dashOffset, isEditing, containerRef, columnWidths, getColumnX]);

  const handleScroll = useCallback(() => {
    drawGrid();
  }, [drawGrid]);

  // Helper to get column width
  const getColumnWidth = useCallback((col: number): number => {
    return (columnWidths.get(col) || CELL_WIDTH) * zoom;
  }, [columnWidths, zoom]);

  // Helper to find which column border is at a given x position
  const findColumnBorderAtX = useCallback((x: number): number | null => {
    let cumulativeX = 0;
    for (let col = 0; col < NUM_COLS; col++) {
      const width = getColumnWidth(col);
      const borderX = cumulativeX + width;
      
      // Check if x is near the right border of this column (within 5px tolerance)
      if (Math.abs(x - borderX) < 5 * zoom) {
        return col;
      }
      cumulativeX += width;
    }
    return null;
  }, [getColumnWidth, zoom]);

  const getCellFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return null;

    const rect = canvas.getBoundingClientRect();
    const headerWidth = HEADER_WIDTH * zoom;
    const headerHeight = HEADER_HEIGHT * zoom;
    
    // Get position relative to canvas
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // Ignore clicks on headers
    if (canvasX < headerWidth || canvasY < headerHeight) {
      return null;
    }

    // Calculate cell position (subtract header offset, add scroll)
    const x = canvasX - headerWidth + container.scrollLeft;
    const y = canvasY - headerHeight + container.scrollTop;

    // Use getColumnX to find column with variable widths
    let cumulativeX = 0;
    let col = -1;
    for (let i = 0; i < NUM_COLS; i++) {
      const width = getColumnWidth(i);
      if (x >= cumulativeX && x < cumulativeX + width) {
        col = i;
        break;
      }
      cumulativeX += width;
    }
    const row = Math.floor(y / (CELL_HEIGHT * zoom));

    if (col >= 0 && col < NUM_COLS && row >= 0 && row < NUM_ROWS) {
      return { row, col };
    }
    return null;
  }, [zoom, containerRef, getColumnWidth]);

  // Detect hover over column border
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const headerWidth = HEADER_WIDTH * zoom;
    const headerHeight = HEADER_HEIGHT * zoom;
    
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // Only check if mouse is in the header row area
    if (canvasY >= 0 && canvasY < headerHeight && canvasX >= headerWidth) {
      const x = canvasX - headerWidth + container.scrollLeft;
      const borderCol = findColumnBorderAtX(x);
      
      if (borderCol !== null) {
        setHoveredColumnBorder(borderCol);
        canvas.style.cursor = 'col-resize';
      } else {
        setHoveredColumnBorder(null);
        canvas.style.cursor = 'default';
      }
    } else {
      setHoveredColumnBorder(null);
      canvas.style.cursor = 'default';
    }
  }, [zoom, containerRef, findColumnBorderAtX]);

  const handleMouseLeave = useCallback(() => {
    setHoveredColumnBorder(null);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  }, []);

  // Detect double-click on column border
  const handleHeaderDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const headerWidth = HEADER_WIDTH * zoom;
    const headerHeight = HEADER_HEIGHT * zoom;
    
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    // Only handle clicks in the header row area
    if (canvasY >= 0 && canvasY < headerHeight && canvasX >= headerWidth) {
      const x = canvasX - headerWidth + container.scrollLeft;
      const borderCol = findColumnBorderAtX(x);
      
      if (borderCol !== null) {
        autoResizeColumn(borderCol);
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, [zoom, containerRef, findColumnBorderAtX, autoResizeColumn]);

  const parseCellReferenceToSelection = useCallback((ref: string): Selection | null => {
    // Handle range like "A1:B5"
    if (ref.includes(':')) {
      const [startStr, endStr] = ref.split(':');
      const start = parseCellRef(startStr);
      const end = parseCellRef(endStr);
      if (start && end) {
        return {
          start: { row: start.row, col: start.col },
          end: { row: end.row, col: end.col },
        };
      }
      return null;
    }
    
    // Handle single cell like "A1"
    const cellRef = parseCellRef(ref);
    if (cellRef) {
      return {
        start: { row: cellRef.row, col: cellRef.col },
        end: { row: cellRef.row, col: cellRef.col },
      };
    }
    return null;
  }, []);

  // Synchronously parse cell references from formula value (returns array, doesn't set state)
  const parseCellReferencesFromFormula = useCallback((value: string): Selection[] => {
    if (!isEditing || !value.startsWith('=')) {
      return [];
    }

    // Find all cell references in the formula
    // Match cell references: A1, $A$1, A1:B5, etc.
    const cellRefPattern = /(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)/g;
    const matches = Array.from(value.matchAll(cellRefPattern));
    
    const selections: Selection[] = [];
    for (const match of matches) {
      const ref = match[1];
      const selection = parseCellReferenceToSelection(ref);
      if (selection) {
        selections.push(selection);
      }
    }
    return selections;
  }, [isEditing, parseCellReferenceToSelection]);

  // Update highlightedCells when inputValue or isEditing changes (synchronously)
  useEffect(() => {
    const selections = parseCellReferencesFromFormula(inputValue);
    if (selections.length > 0) {
      setHighlightedCells(selections);
    } else {
      setHighlightedCells(null);
    }
  }, [inputValue, isEditing, parseCellReferencesFromFormula, setHighlightedCells]);

  const { handleMouseDown, handleCanvasDoubleClick } = useMouse({
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
  });

  // Filter functions based on input
  useEffect(() => {
    if (!isEditing || !inputValue.startsWith('=')) {
      setShowFunctionDropdown(false);
      return;
    }

    const afterEquals = inputValue.slice(1);
    // Match letters that come after operators (+, -, *, /, (, ,) or at the start, and are at the end
    // This allows matching "S" in "=A1+B2+ S" instead of just "A1"
    const match = afterEquals.match(/(?:^|[\+\-\*\/\(,\s]+)([A-Za-z]+)$/);
    
    if (match) {
      const typed = match[1];
      // Don't show dropdown if function name is already followed by '(' (function already selected)
      // Check what comes after the matched letters in the full afterEquals string
      const typedIndex = afterEquals.lastIndexOf(typed);
      const afterTyped = afterEquals.slice(typedIndex + typed.length);
      if (afterTyped.startsWith('(')) {
        setShowFunctionDropdown(false);
        return;
      }
      // Don't show dropdown if letters are followed by a digit (cell reference like F8, A1, etc.)
      if (/^\d/.test(afterTyped)) {
        setShowFunctionDropdown(false);
        return;
      }
      
      const typedUpper = typed.toUpperCase();
      const filtered = FUNCTION_NAMES.filter(fn => fn.startsWith(typedUpper));
      if (filtered.length > 0) {
        setFilteredFunctions(filtered);
        setShowFunctionDropdown(true);
        setSelectedFunctionIndex(0);
      } else {
        setShowFunctionDropdown(false);
      }
    } else {
      setShowFunctionDropdown(false);
    }
  }, [inputValue, isEditing]);

  const insertFunction = useCallback((functionName: string) => {
    if (!inputValue.startsWith('=')) return;
    
    const afterEquals = inputValue.slice(1);
    // Match letters that come after operators (+, -, *, /, (, ,) or at the start, and are at the end
    const match = afterEquals.match(/(?:^|[\+\-\*\/\(,\s]+)([A-Za-z]+)$/);
    if (match) {
      const typed = match[1];
      // Find the position of the typed letters in the string
      const typedIndex = afterEquals.lastIndexOf(typed);
      // Strip any auto-paired () that might exist
      const remaining = afterEquals.slice(typedIndex + typed.length).replace(/^\(\)/, '');
      const beforeTyped = afterEquals.slice(0, typedIndex);
      const newValue = '=' + beforeTyped + functionName + '()' + remaining;
      setInputValue(newValue);
      setShowFunctionDropdown(false);
      setTimeout(() => {
        const input = inputRef.current;
        if (input) {
          const cursorPos = '='.length + beforeTyped.length + functionName.length + '('.length;
          input.setSelectionRange(cursorPos, cursorPos);
          input.focus();
        }
      }, 0);
    }
  }, [inputValue, setInputValue]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    // parseAndHighlightCellReferences will be called by the useEffect watching inputValue
  }, [setInputValue]);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Don't close if clicking on dropdown
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('[data-formula-dropdown]')) {
      return;
    }
    setShowFunctionDropdown(false);
    saveCurrentCell();
    setIsEditing(false);
  }, [saveCurrentCell, setIsEditing]);

  // Fill handle mouse down
  const handleFillHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selection) return;

    saveCurrentCell();

    setIsFillDragging(true);
    setFillDragStart({ row: selection.start.row, col: selection.start.col });
    setFillDragEnd({ row: selection.start.row, col: selection.start.col });
  }, [selection, saveCurrentCell]);

  // Adjust formula references by row/col delta
  const adjustFormulaReferences = useCallback((formula: string, rowDelta: number, colDelta: number): string => {
    if (!formula.startsWith('=')) return formula;

    const cellRefPattern = /\$?[A-Za-z]+\$?\d+/g;

    return formula.replace(cellRefPattern, (match) => {
      const ref = parseCellRef(match);
      if (!ref) return match;

      const adjusted = adjustCellRef(ref, rowDelta, colDelta);
      if (adjusted.row < 0 || adjusted.col < 0) return match;

      return formatCellRef(adjusted);
    });
  }, []);

  // Execute fill operation
  const executeFill = useCallback(() => {
    if (!fillDragStart || !fillDragEnd) return;

    const sourceRow = fillDragStart.row;
    const sourceCol = fillDragStart.col;
    const sourceKey = getCellKey(sourceRow, sourceCol);
    const sourceCell = cellData.get(sourceKey);

    if (!sourceCell) return;

    const minRow = Math.min(fillDragStart.row, fillDragEnd.row);
    const maxRow = Math.max(fillDragStart.row, fillDragEnd.row);
    const minCol = Math.min(fillDragStart.col, fillDragEnd.col);
    const maxCol = Math.max(fillDragStart.col, fillDragEnd.col);

    // Start with existing data and add updates
    const cellUpdates = new Map(cellData);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (row === sourceRow && col === sourceCol) continue;

        const rowDelta = row - sourceRow;
        const colDelta = col - sourceCol;

        let newValue: string;
        if (sourceCell.type === 'formula') {
          newValue = adjustFormulaReferences(sourceCell.raw, rowDelta, colDelta);
        } else {
          newValue = sourceCell.raw;
        }

        const key = getCellKey(row, col);
        const parsed = parseInputValue(newValue);
        cellUpdates.set(key, {
          raw: parsed.value,
          type: parsed.type,
        });
      }
    }

    updateCells(cellUpdates);
  }, [fillDragStart, fillDragEnd, cellData, adjustFormulaReferences, updateCells]);

  // Document-level mouse events for fill drag
  useEffect(() => {
    if (!isFillDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const cell = getCellFromEvent(e);
      if (cell) {
        setFillDragEnd(cell);
      }
    };

    const handleMouseUp = () => {
      executeFill();
      setIsFillDragging(false);
      setFillDragStart(null);
      setFillDragEnd(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isFillDragging, getCellFromEvent, executeFill]);

  const { handleContainerKeyDown, handleKeyDown } = useKeyboard({
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
  });

  // Use spreadsheet effects hook
  useSpreadsheet({
    canvasRef,
    containerRef,
    zoom,
    setZoom,
    drawGrid,
    copiedRange,
    animatingRanges,
    setDashOffset,
    selection,
    highlightedCells,
  });

  const cellIsFormula = inputValue.startsWith('=');
  const cellSegments = useMemo(() => getFormulaSegments(inputValue), [inputValue]);

  return (
    <div 
      ref={containerRef}
      className={styles.container}
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={handleContainerKeyDown}
    >
      <div 
        className={styles.scrollArea}
        style={{ 
          width: HEADER_WIDTH * zoom + (() => {
            let totalWidth = 0;
            for (let col = 0; col < NUM_COLS; col++) {
              totalWidth += getColumnWidth(col);
            }
            return totalWidth;
          })(), 
          height: HEADER_HEIGHT * zoom + NUM_ROWS * CELL_HEIGHT * zoom 
        }}
      />
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={(e) => {
          // Try header double-click first (column resize)
          handleHeaderDoubleClick(e);
          // If not handled, try cell double-click
          if (!e.defaultPrevented) {
            handleCanvasDoubleClick(e);
          }
        }}
      />
      {selection && isEditing && (
        <>
          <input
            ref={inputRef}
            className={`${styles.cellInput} ${cellIsFormula ? styles.cellInputTransparent : ''}`}
            style={{
              left: HEADER_WIDTH * zoom + getColumnX(selection.start.col) * zoom,
              top: HEADER_HEIGHT * zoom + selection.start.row * CELL_HEIGHT * zoom,
              width: getColumnWidth(selection.start.col) * zoom,
              height: CELL_HEIGHT * zoom,
              fontSize: CELL_FONT_SIZE * zoom,
            }}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
          />
          {cellIsFormula && (
            <div
              className={styles.cellOverlay}
              style={{
                left: HEADER_WIDTH * zoom + getColumnX(selection.start.col) * zoom,
                top: HEADER_HEIGHT * zoom + selection.start.row * CELL_HEIGHT * zoom,
                width: getColumnWidth(selection.start.col) * zoom,
                height: CELL_HEIGHT * zoom,
                fontSize: CELL_FONT_SIZE * zoom,
                lineHeight: `${CELL_HEIGHT * zoom}px`,
              }}
              aria-hidden
            >
              {cellSegments.map((seg, i) => (
                <span
                  key={i}
                  style={seg.colorIndex !== null ? { color: FORMULA_REFERENCE_COLORS[seg.colorIndex % FORMULA_REFERENCE_COLORS.length].border } : undefined}
                >
                  {seg.text}
                </span>
              ))}
            </div>
          )}
          {inputValue && (
            <>
              {/* Fill handles at corners */}
              {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => {
                const handleSize = 6 * zoom;
                const cellLeft = HEADER_WIDTH * zoom + getColumnX(selection.start.col) * zoom;
                const cellTop = HEADER_HEIGHT * zoom + selection.start.row * CELL_HEIGHT * zoom;
                const cellW = getColumnWidth(selection.start.col) * zoom;
                const cellH = CELL_HEIGHT * zoom;
                const positions = {
                  tl: { left: cellLeft - handleSize / 2, top: cellTop - handleSize / 2 },
                  tr: { left: cellLeft + cellW - handleSize / 2, top: cellTop - handleSize / 2 },
                  bl: { left: cellLeft - handleSize / 2, top: cellTop + cellH - handleSize / 2 },
                  br: { left: cellLeft + cellW - handleSize / 2, top: cellTop + cellH - handleSize / 2 },
                };
                return (
                  <div
                    key={corner}
                    className={styles.fillHandle}
                    onMouseDown={handleFillHandleMouseDown}
                    style={{
                      left: positions[corner].left,
                      top: positions[corner].top,
                      width: handleSize,
                      height: handleSize,
                    }}
                  />
                );
              })}
            </>
          )}
          {/* Fill drag highlight */}
          {isFillDragging && fillDragStart && fillDragEnd && (
            (() => {
              const minRow = Math.min(fillDragStart.row, fillDragEnd.row);
              const maxRow = Math.max(fillDragStart.row, fillDragEnd.row);
              const minCol = Math.min(fillDragStart.col, fillDragEnd.col);
              const maxCol = Math.max(fillDragStart.col, fillDragEnd.col);

              let rangeWidth = 0;
              for (let c = minCol; c <= maxCol; c++) {
                rangeWidth += getColumnWidth(c);
              }

              return (
                <div
                  className={styles.fillDragHighlight}
                  style={{
                    left: HEADER_WIDTH * zoom + getColumnX(minCol) * zoom,
                    top: HEADER_HEIGHT * zoom + minRow * CELL_HEIGHT * zoom,
                    width: rangeWidth,
                    height: (maxRow - minRow + 1) * CELL_HEIGHT * zoom,
                  }}
                />
              );
            })()
          )}
          {showFunctionDropdown && filteredFunctions.length > 0 && (
            <div
              data-formula-dropdown
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: 'absolute',
                left: HEADER_WIDTH * zoom + getColumnX(selection.start.col) * zoom,
                top: HEADER_HEIGHT * zoom + selection.start.row * CELL_HEIGHT * zoom + CELL_HEIGHT * zoom,
                width: getColumnWidth(selection.start.col) * 2,
                backgroundColor: 'white',
                border: '1px solid #ccc',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {filteredFunctions.map((fn, idx) => (
                <div
                  key={fn}
                  onClick={() => insertFunction(fn)}
                  style={{
                    padding: '4px 8px',
                    cursor: 'pointer',
                    backgroundColor: idx === selectedFunctionIndex ? '#e3f2fd' : 'white',
                  }}
                  onMouseEnter={() => setSelectedFunctionIndex(idx)}
                >
                  {fn}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
