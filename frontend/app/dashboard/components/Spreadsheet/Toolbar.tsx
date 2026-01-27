import { useCallback, useRef } from 'react';
import { useSpreadsheetContext } from './SpreadsheetContext';
import { getCellKey } from './drawUtils';
import type { CellFormat } from './types';
import styles from './Toolbar.module.css';

export default function Toolbar() {
  const { selection, cellFormat, setCellFormat } = useSpreadsheetContext();
  const colorInputRef = useRef<HTMLInputElement>(null);
  const fillInputRef = useRef<HTMLInputElement>(null);

  // Get current cell's format
  const getCurrentFormat = useCallback((): CellFormat => {
    if (!selection) return {};
    const key = getCellKey(selection.start.row, selection.start.col);
    return cellFormat.get(key) || {};
  }, [selection, cellFormat]);

  const currentFormat = getCurrentFormat();

  // Toggle a format property for all selected cells
  const toggleFormat = useCallback((property: keyof CellFormat) => {
    if (!selection) return;

    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    // Check current state of anchor cell to determine toggle direction
    const anchorKey = getCellKey(selection.start.row, selection.start.col);
    const anchorFormat = cellFormat.get(anchorKey) || {};
    const newValue = !anchorFormat[property];

    setCellFormat(prev => {
      const next = new Map(prev);
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const key = getCellKey(row, col);
          const existing = next.get(key) || {};
          next.set(key, {
            ...existing,
            [property]: newValue || undefined,
          });
        }
      }
      return next;
    });
  }, [selection, cellFormat, setCellFormat]);

  // Set text color for all selected cells
  const setTextColor = useCallback((color: string) => {
    if (!selection) return;

    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    setCellFormat(prev => {
      const next = new Map(prev);
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const key = getCellKey(row, col);
          const existing = next.get(key) || {};
          next.set(key, {
            ...existing,
            textColor: color,
          });
        }
      }
      return next;
    });
  }, [selection, setCellFormat]);

  // Set fill color for all selected cells
  const setFillColor = useCallback((color: string) => {
    if (!selection) return;

    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    setCellFormat(prev => {
      const next = new Map(prev);
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const key = getCellKey(row, col);
          const existing = next.get(key) || {};
          next.set(key, {
            ...existing,
            fillColor: color,
          });
        }
      }
      return next;
    });
  }, [selection, setCellFormat]);

  const handleColorClick = useCallback(() => {
    colorInputRef.current?.click();
  }, []);

  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTextColor(e.target.value);
  }, [setTextColor]);

  const handleFillClick = useCallback(() => {
    fillInputRef.current?.click();
  }, []);

  const handleFillChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFillColor(e.target.value);
  }, [setFillColor]);

  // Prevent focus loss when clicking toolbar buttons
  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className={styles.toolbar}>
      <button
        className={`${styles.formatButton} ${currentFormat.bold ? styles.active : ''}`}
        onMouseDown={preventFocusLoss}
        onClick={() => toggleFormat('bold')}
        disabled={!selection}
        title="Bold"
      >
        B
      </button>
      <button
        className={`${styles.formatButton} ${styles.italic} ${currentFormat.italic ? styles.active : ''}`}
        onMouseDown={preventFocusLoss}
        onClick={() => toggleFormat('italic')}
        disabled={!selection}
        title="Italic"
      >
        I
      </button>
      <button
        className={`${styles.formatButton} ${currentFormat.strikethrough ? styles.active : ''}`}
        onMouseDown={preventFocusLoss}
        onClick={() => toggleFormat('strikethrough')}
        disabled={!selection}
        title="Strikethrough"
      >
        <span className={styles.strikethrough}>S</span>
      </button>
      <div className={styles.separator} />
      <button
        className={styles.colorButton}
        onMouseDown={preventFocusLoss}
        onClick={handleColorClick}
        disabled={!selection}
        title="Text Color"
      >
        <span className={styles.colorIcon}>A</span>
        <span 
          className={styles.colorBar} 
          style={{ backgroundColor: currentFormat.textColor || '#000000' }}
        />
        <input
          ref={colorInputRef}
          type="color"
          className={styles.colorInput}
          value={currentFormat.textColor || '#000000'}
          onChange={handleColorChange}
        />
      </button>
      <button
        className={styles.fillButton}
        onMouseDown={preventFocusLoss}
        onClick={handleFillClick}
        disabled={!selection}
        title="Fill Color"
      >
        <span 
          className={styles.fillIcon} 
          style={{ backgroundColor: currentFormat.fillColor || '#ffffff' }}
        />
        <input
          ref={fillInputRef}
          type="color"
          className={styles.colorInput}
          value={currentFormat.fillColor || '#ffffff'}
          onChange={handleFillChange}
        />
      </button>
    </div>
  );
}
