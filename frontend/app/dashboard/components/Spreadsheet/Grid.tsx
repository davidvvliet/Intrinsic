"use client";

import { useRef, useState, useCallback } from 'react';
import { useSpreadsheet } from '../../hooks/useSpreadsheet';
import { useSpreadsheetContext } from './SpreadsheetContext';
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
import type { ScrollPosition, Selection } from './types';
import { drawGrid as drawGridUtil } from './drawUtils';
import { parseCellRef } from './formulaEngine/cellRef';

export default function Grid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Get shared state from context
  const {
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
    inputRef,
    containerRef,
  } = useSpreadsheetContext();

  // Grid-specific state
  const [zoom, setZoom] = useState(1.0);
  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({ left: 0, top: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dashOffset, setDashOffset] = useState(0);

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
      pointingSelection,
      copiedRange,
      dashOffset,
      zoom,
      isEditing,
    });
  }, [cellData, cellFormat, computedData, selection, pointingSelection, zoom, copiedRange, dashOffset, isEditing, containerRef]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      setScrollPosition({ left: container.scrollLeft, top: container.scrollTop });
    }
    drawGrid();
  }, [drawGrid, containerRef]);

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

    const col = Math.floor(x / (CELL_WIDTH * zoom));
    const row = Math.floor(y / (CELL_HEIGHT * zoom));

    if (col >= 0 && col < NUM_COLS && row >= 0 && row < NUM_ROWS) {
      return { row, col };
    }
    return null;
  }, [zoom, containerRef]);

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
    pointingSelection,
    setPointingSelection,
    inputRef,
  });

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

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Parse and highlight cell references while typing in formula mode
    if (isEditing && newValue.startsWith('=')) {
      // Find the last cell reference in the formula (before cursor or at end)
      // Match cell references: A1, $A$1, A1:B5, etc.
      const cellRefPattern = /(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)/g;
      const matches = Array.from(newValue.matchAll(cellRefPattern));
      
      if (matches.length > 0) {
        // Get the last match (most recently typed)
        const lastMatch = matches[matches.length - 1];
        const ref = lastMatch[1];
        const selection = parseCellReferenceToSelection(ref);
        if (selection) {
          setPointingSelection(selection);
        } else {
          setPointingSelection(null);
        }
      } else {
        setPointingSelection(null);
      }
    }
  }, [setInputValue, isEditing, setPointingSelection, parseCellReferenceToSelection]);

  const handleInputBlur = useCallback(() => {
    saveCurrentCell();
    setIsEditing(false);
  }, [saveCurrentCell, setIsEditing]);

  const { handleContainerKeyDown, handleKeyDown } = useKeyboard({
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
  });

  // Use spreadsheet effects hook
  useSpreadsheet({
    canvasRef,
    containerRef,
    zoom,
    setZoom,
    drawGrid,
    copiedRange,
    setDashOffset,
    selection,
  });

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
          width: HEADER_WIDTH * zoom + NUM_COLS * CELL_WIDTH * zoom, 
          height: HEADER_HEIGHT * zoom + NUM_ROWS * CELL_HEIGHT * zoom 
        }}
      />
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleCanvasDoubleClick}
      />
      {selection && isEditing && (
        <input
          ref={inputRef}
          className={styles.cellInput}
          style={{
            left: HEADER_WIDTH * zoom + selection.start.col * CELL_WIDTH * zoom - scrollPosition.left,
            top: HEADER_HEIGHT * zoom + selection.start.row * CELL_HEIGHT * zoom - scrollPosition.top,
            width: CELL_WIDTH * zoom,
            height: CELL_HEIGHT * zoom,
            fontSize: CELL_FONT_SIZE * zoom,
          }}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
        />
      )}
    </div>
  );
}
