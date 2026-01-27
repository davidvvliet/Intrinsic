"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
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
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [scrollPosition, setScrollPosition] = useState({ left: 0, top: 0 });

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

        // Draw selection highlight
        if (activeCell && activeCell.row === row && activeCell.col === col) {
          ctx.strokeStyle = '#0064c8';
          ctx.lineWidth = 1;
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
  }, [cellData, activeCell, zoom]);

  // Initialize canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      
      drawGrid();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawGrid]);

  // Redraw on state changes
  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      setScrollPosition({ left: container.scrollLeft, top: container.scrollTop });
    }
    drawGrid();
  }, [drawGrid]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;

    const cellWidth = CELL_WIDTH * zoom;
    const cellHeight = CELL_HEIGHT * zoom;

    const col = Math.floor(x / cellWidth);
    const row = Math.floor(y / cellHeight);

    if (col >= 0 && col < NUM_COLS && row >= 0 && row < NUM_ROWS) {
      // Save previous cell if editing
      if (activeCell) {
        const key = getCellKey(activeCell.row, activeCell.col);
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

      setActiveCell({ row, col });
      const key = getCellKey(row, col);
      setInputValue(cellData.get(key) || '');

      // Focus input
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [activeCell, inputValue, cellData, zoom]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleInputBlur = useCallback(() => {
    if (activeCell) {
      const key = getCellKey(activeCell.row, activeCell.col);
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
    setActiveCell(null);
    setInputValue('');
  }, [activeCell, inputValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setActiveCell(null);
      setInputValue('');
    }
  }, [handleInputBlur]);

  // Zoom with Ctrl/Cmd + wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => Math.min(4, Math.max(0.25, prev + delta)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={styles.container}
      onScroll={handleScroll}
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
        onClick={handleCanvasClick}
      />
      {activeCell && (
        <input
          ref={inputRef}
          className={styles.cellInput}
          style={{
            left: activeCell.col * CELL_WIDTH * zoom - scrollPosition.left,
            top: activeCell.row * CELL_HEIGHT * zoom - scrollPosition.top,
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
