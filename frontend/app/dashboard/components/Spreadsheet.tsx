"use client";

import { useRef, useState, useCallback } from 'react';
import { useSpreadsheet } from '../hooks/useSpreadsheet';
import styles from './Spreadsheet.module.css';

const CELL_WIDTH = 80;
const CELL_HEIGHT = 25;
const NUM_ROWS = 200;
const NUM_COLS = 50;

type CellData = Map<string, string>;

function getCellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export default function Spreadsheet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [cellData, setCellData] = useState<CellData>(new Map());
  const [selection, setSelection] = useState<{
    start: { row: number; col: number };
    end: { row: number; col: number };
  } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [scrollPosition, setScrollPosition] = useState({ left: 0, top: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    // Effective dimensions with zoom
    const cellWidth = CELL_WIDTH * zoom;
    const cellHeight = CELL_HEIGHT * zoom;

    // Clear canvas
    ctx.fillStyle = '#ffffe3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate visible range
    const startCol = Math.floor(scrollLeft / cellWidth);
    const endCol = Math.min(startCol + Math.ceil(canvas.width / cellWidth) + 1, NUM_COLS);
    const startRow = Math.floor(scrollTop / cellHeight);
    const endRow = Math.min(startRow + Math.ceil(canvas.height / cellHeight) + 1, NUM_ROWS);

    // Calculate selection bounds
    let minRow = -1, maxRow = -1, minCol = -1, maxCol = -1;
    if (selection) {
      minRow = Math.min(selection.start.row, selection.end.row);
      maxRow = Math.max(selection.start.row, selection.end.row);
      minCol = Math.min(selection.start.col, selection.end.col);
      maxCol = Math.max(selection.start.col, selection.end.col);
    }

    // Draw cells
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.font = `${13 * zoom}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const x = col * cellWidth - scrollLeft;
        const y = row * cellHeight - scrollTop;

        // Draw cell border
        ctx.strokeRect(x, y, cellWidth, cellHeight);

        // Check if cell is in selection
        const inSelection = row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
        const isAnchor = selection && row === selection.start.row && col === selection.start.col;

        // Draw selection highlight
        if (inSelection) {
          ctx.fillStyle = 'rgba(0, 100, 200, 0.1)';
          ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
          ctx.fillStyle = '#000000';
        }

        // Draw anchor cell border (the "active" cell)
        if (isAnchor) {
          ctx.strokeStyle = '#0064c8';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cellWidth, cellHeight);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.lineWidth = 1;
        }

        // Draw cell content
        const key = getCellKey(row, col);
        const value = cellData.get(key);
        if (value) {
          ctx.fillText(value, x + 5 * zoom, y + cellHeight / 2, cellWidth - 10 * zoom);
        }
      }
    }
  }, [cellData, selection, zoom]);

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
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;

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

  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selection || isEditing) return;

    const { row, col } = selection.start;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        moveToCell(row - 1, col);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveToCell(row + 1, col);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveToCell(row, col - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveToCell(row, col + 1);
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
  }, [selection, isEditing, moveToCell, setCellData, setInputValue]);

  const handleInputBlur = useCallback(() => {
    saveCurrentCell();
    setIsEditing(false);
  }, [saveCurrentCell]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!selection) return;

    const { row, col } = selection.start;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        saveCurrentCell();
        moveToCell(row + 1, col, false);
        break;
      case 'Escape':
        e.preventDefault();
        // Discard changes, reload original value
        const key = getCellKey(row, col);
        setInputValue(cellData.get(key) || '');
        setIsEditing(false);
        setTimeout(() => containerRef.current?.focus(), 0);
        break;
      case 'Tab':
        e.preventDefault();
        saveCurrentCell();
        if (e.shiftKey) {
          moveToCell(row, col - 1, false);
        } else {
          moveToCell(row, col + 1, false);
        }
        break;
    }
  }, [selection, saveCurrentCell, moveToCell, cellData]);

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
          width: NUM_COLS * CELL_WIDTH * zoom, 
          height: NUM_ROWS * CELL_HEIGHT * zoom 
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
            left: selection.start.col * CELL_WIDTH * zoom - scrollPosition.left,
            top: selection.start.row * CELL_HEIGHT * zoom - scrollPosition.top,
            width: CELL_WIDTH * zoom,
            height: CELL_HEIGHT * zoom,
            fontSize: 13 * zoom,
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
