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
  const [inputPosition, setInputPosition] = useState({ x: 0, y: 0 });

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    // Clear canvas
    ctx.fillStyle = '#ffffe3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate visible range
    const startCol = Math.floor(scrollLeft / CELL_WIDTH);
    const endCol = Math.min(startCol + Math.ceil(canvas.width / CELL_WIDTH) + 1, NUM_COLS);
    const startRow = Math.floor(scrollTop / CELL_HEIGHT);
    const endRow = Math.min(startRow + Math.ceil(canvas.height / CELL_HEIGHT) + 1, NUM_ROWS);

    // Draw cells
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.font = '13px Arial';
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const x = col * CELL_WIDTH - scrollLeft;
        const y = row * CELL_HEIGHT - scrollTop;

        // Draw cell border
        ctx.strokeRect(x, y, CELL_WIDTH, CELL_HEIGHT);

        // Draw selection highlight
        if (activeCell && activeCell.row === row && activeCell.col === col) {
          ctx.strokeStyle = '#0064c8';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, CELL_WIDTH, CELL_HEIGHT);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.lineWidth = 1;
        }

        // Draw cell content
        const key = getCellKey(row, col);
        const value = cellData.get(key);
        if (value) {
          ctx.fillText(value, x + 5, y + CELL_HEIGHT / 2, CELL_WIDTH - 10);
        }
      }
    }
  }, [cellData, activeCell]);

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
    drawGrid();
    // Hide input when scrolling
    if (activeCell && inputRef.current) {
      const container = containerRef.current;
      if (!container) return;
      const x = activeCell.col * CELL_WIDTH - container.scrollLeft;
      const y = activeCell.row * CELL_HEIGHT - container.scrollTop;
      setInputPosition({ x, y });
    }
  }, [drawGrid, activeCell]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;

    const col = Math.floor(x / CELL_WIDTH);
    const row = Math.floor(y / CELL_HEIGHT);

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
      
      // Position input over cell
      const inputX = col * CELL_WIDTH - container.scrollLeft;
      const inputY = row * CELL_HEIGHT - container.scrollTop;
      setInputPosition({ x: inputX, y: inputY });

      // Focus input
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [activeCell, inputValue, cellData]);

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

  return (
    <div 
      ref={containerRef}
      className={styles.container}
      onScroll={handleScroll}
    >
      <div 
        className={styles.scrollArea}
        style={{ 
          width: NUM_COLS * CELL_WIDTH, 
          height: NUM_ROWS * CELL_HEIGHT 
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
            left: inputPosition.x,
            top: inputPosition.y,
            width: CELL_WIDTH,
            height: CELL_HEIGHT,
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
