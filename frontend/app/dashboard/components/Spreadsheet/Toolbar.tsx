import { useCallback, useRef } from 'react';
import { useSpreadsheetContext } from './SpreadsheetContext';
import { getCellKey } from './drawUtils';
import type { CellFormat } from './types';
import styles from './Toolbar.module.css';

export default function Toolbar() {
  const { selection, cellData, setCellData } = useSpreadsheetContext();
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Get current cell's format
  const getCurrentFormat = useCallback((): CellFormat => {
    if (!selection) return {};
    const key = getCellKey(selection.start.row, selection.start.col);
    return cellData.get(key)?.format || {};
  }, [selection, cellData]);

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
    const anchorFormat = cellData.get(anchorKey)?.format || {};
    const newValue = !anchorFormat[property];

    setCellData(prev => {
      const next = new Map(prev);
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const key = getCellKey(row, col);
          const existing = next.get(key);
          if (existing) {
            next.set(key, {
              ...existing,
              format: {
                ...existing.format,
                [property]: newValue || undefined,
              },
            });
          }
        }
      }
      return next;
    });
  }, [selection, cellData, setCellData]);

  // Set text color for all selected cells
  const setTextColor = useCallback((color: string) => {
    if (!selection) return;

    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    setCellData(prev => {
      const next = new Map(prev);
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const key = getCellKey(row, col);
          const existing = next.get(key);
          if (existing) {
            next.set(key, {
              ...existing,
              format: {
                ...existing.format,
                textColor: color,
              },
            });
          }
        }
      }
      return next;
    });
  }, [selection, setCellData]);

  const handleColorClick = useCallback(() => {
    colorInputRef.current?.click();
  }, []);

  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTextColor(e.target.value);
  }, [setTextColor]);

  return (
    <div className={styles.toolbar}>
      <button
        className={`${styles.formatButton} ${currentFormat.bold ? styles.active : ''}`}
        onClick={() => toggleFormat('bold')}
        disabled={!selection}
        title="Bold"
      >
        B
      </button>
      <button
        className={`${styles.formatButton} ${styles.italic} ${currentFormat.italic ? styles.active : ''}`}
        onClick={() => toggleFormat('italic')}
        disabled={!selection}
        title="Italic"
      >
        I
      </button>
      <button
        className={`${styles.formatButton} ${currentFormat.strikethrough ? styles.active : ''}`}
        onClick={() => toggleFormat('strikethrough')}
        disabled={!selection}
        title="Strikethrough"
      >
        <span className={styles.strikethrough}>S</span>
      </button>
      <div className={styles.separator} />
      <button
        className={styles.colorButton}
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
    </div>
  );
}
