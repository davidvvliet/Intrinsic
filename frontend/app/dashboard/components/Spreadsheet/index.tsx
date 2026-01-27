"use client";

import { useRef, useState, useCallback } from 'react';
import { useSpreadsheet } from '../../hooks/useSpreadsheet';
import { useKeyboard } from './useKeyboard';
import styles from './Spreadsheet.module.css';
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  NUM_ROWS,
  NUM_COLS,
  HEADER_WIDTH,
  HEADER_HEIGHT,
  CELL_FONT_SIZE,
} from './config';
import type {
  CellData,
  Selection,
  ScrollPosition,
  CopiedRange,
} from './types';
import { getCellKey, drawGrid as drawGridUtil } from './drawUtils';

export default function Spreadsheet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [cellData, setCellData] = useState<CellData>(new Map());
  const [selection, setSelection] = useState<Selection>(null);
  const [inputValue, setInputValue] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({ left: 0, top: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedRange, setCopiedRange] = useState<CopiedRange>(null);
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
      selection,
      copiedRange,
      dashOffset,
      zoom,
      isEditing,
    });
  }, [cellData, selection, zoom, copiedRange, dashOffset, isEditing]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      setScrollPosition({ left: container.scrollLeft, top: container.scrollTop });
    }
    drawGrid();
  }, [drawGrid]);

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
  }, [zoom]);

  const saveCurrentCell = useCallback(() => {
    if (selection) {
      const key = getCellKey(selection.start.row, selection.start.col);
      setCellData(prev => {
        const next = new Map(prev);
        if (inputValue.trim()) {
          next.set(key, inputValue);
        } else {
          next.delete(key);
        }
        return next;
      });
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
    setInputValue(cellData.get(key) || '');
    setIsEditing(startEditing);

    // Focus appropriately
    if (startEditing) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setTimeout(() => containerRef.current?.focus(), 0);
    }
  }, [isEditing, saveCurrentCell, cellData]);

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
  }, [getCellFromEvent, selection, isEditing, saveCurrentCell, cellData]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = getCellFromEvent(e);
    if (!cell) return;
    moveToCell(cell.row, cell.col, true); // Edit mode
  }, [getCellFromEvent, moveToCell]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleInputBlur = useCallback(() => {
    saveCurrentCell();
    setIsEditing(false);
  }, [saveCurrentCell]);

  const { handleContainerKeyDown, handleKeyDown } = useKeyboard({
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
  });

  // Use spreadsheet effects hook
  useSpreadsheet({
    canvasRef,
    containerRef,
    zoom,
    setZoom,
    isDragging,
    setIsDragging,
    setSelection,
    getCellFromEvent,
    drawGrid,
    copiedRange,
    setDashOffset,
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
