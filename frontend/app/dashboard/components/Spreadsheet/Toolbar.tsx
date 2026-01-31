import { useCallback } from 'react';
import { useSpreadsheetContext } from './SpreadsheetContext';
import { getCellKey } from './drawUtils';
import type { CellFormat, NumberFormatSettings } from './types';
import ColorButton from './ColorButton';
import FormatDropdown from './FormatDropdown';
import styles from './Toolbar.module.css';

export default function Toolbar() {
  const { selection, cellFormat, updateCellFormats } = useSpreadsheetContext();

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

    const newCellFormat = new Map(cellFormat);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = getCellKey(row, col);
        const existing = cellFormat.get(key) || {};
        newCellFormat.set(key, {
          ...existing,
          [property]: newValue || undefined,
        });
      }
    }
    updateCellFormats(newCellFormat);
  }, [selection, cellFormat, updateCellFormats]);

  // Set text color for all selected cells
  const handleTextColor = useCallback((color: string | null) => {
    if (!selection) return;

    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    const newCellFormat = new Map(cellFormat);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = getCellKey(row, col);
        const existing = cellFormat.get(key) || {};
        if (color) {
          newCellFormat.set(key, { ...existing, textColor: color });
        } else {
          const { textColor, ...rest } = existing;
          if (Object.keys(rest).length > 0) {
            newCellFormat.set(key, rest);
          } else {
            newCellFormat.delete(key);
          }
        }
      }
    }
    updateCellFormats(newCellFormat);
  }, [selection, cellFormat, updateCellFormats]);

  // Set fill color for all selected cells
  const handleFillColor = useCallback((color: string | null) => {
    if (!selection) return;

    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    const newCellFormat = new Map(cellFormat);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = getCellKey(row, col);
        const existing = cellFormat.get(key) || {};
        if (color) {
          newCellFormat.set(key, { ...existing, fillColor: color });
        } else {
          const { fillColor, ...rest } = existing;
          if (Object.keys(rest).length > 0) {
            newCellFormat.set(key, rest);
          } else {
            newCellFormat.delete(key);
          }
        }
      }
    }
    updateCellFormats(newCellFormat);
  }, [selection, cellFormat, updateCellFormats]);

  // Set number format for all selected cells
  const handleNumberFormat = useCallback((format: NumberFormatSettings | null) => {
    if (!selection) return;

    const minRow = Math.min(selection.start.row, selection.end.row);
    const maxRow = Math.max(selection.start.row, selection.end.row);
    const minCol = Math.min(selection.start.col, selection.end.col);
    const maxCol = Math.max(selection.start.col, selection.end.col);

    const newCellFormat = new Map(cellFormat);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const key = getCellKey(row, col);
        const existing = cellFormat.get(key) || {};
        if (format) {
          newCellFormat.set(key, { ...existing, numberFormat: format });
        } else {
          const { numberFormat, ...rest } = existing;
          if (Object.keys(rest).length > 0) {
            newCellFormat.set(key, rest);
          } else {
            newCellFormat.delete(key);
          }
        }
      }
    }
    updateCellFormats(newCellFormat);
  }, [selection, cellFormat, updateCellFormats]);

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
      <ColorButton
        icon="text"
        currentColor={currentFormat.textColor}
        onSelectColor={handleTextColor}
        disabled={!selection}
      />
      <ColorButton
        icon="fill"
        currentColor={currentFormat.fillColor}
        onSelectColor={handleFillColor}
        disabled={!selection}
      />
      <div className={styles.separator} />
      <FormatDropdown
        currentFormat={currentFormat.numberFormat}
        onSelectFormat={handleNumberFormat}
        disabled={!selection}
      />
      <button
        className={`${styles.formatButton} ${currentFormat.numberFormat?.type === 'percent' ? styles.active : ''}`}
        onMouseDown={preventFocusLoss}
        onClick={() => handleNumberFormat({ type: 'percent' })}
        disabled={!selection}
        title="Percent"
      >
        %
      </button>
      <button
        className={`${styles.formatButton} ${currentFormat.numberFormat?.type === 'currency' ? styles.active : ''}`}
        onMouseDown={preventFocusLoss}
        onClick={() => handleNumberFormat({ type: 'currency' })}
        disabled={!selection}
        title="Currency"
      >
        $
      </button>
    </div>
  );
}
