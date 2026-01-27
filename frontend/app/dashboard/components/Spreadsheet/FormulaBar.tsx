import { useCallback } from 'react';
import { useSpreadsheetContext } from './SpreadsheetContext';
import { getColumnLabel, getCellKey } from './drawUtils';
import styles from './FormulaBar.module.css';

export default function FormulaBar() {
  const {
    selection,
    inputValue,
    setInputValue,
    isEditing,
    setIsEditing,
    saveCurrentCell,
    moveToCell,
    cellData,
    containerRef,
  } = useSpreadsheetContext();

  // Format cell reference (e.g., "A1", "B5")
  const cellRef = selection
    ? `${getColumnLabel(selection.start.col)}${selection.start.row + 1}`
    : '';

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, [setInputValue]);

  const handleFocus = useCallback(() => {
    if (selection) {
      setIsEditing(true);
    }
  }, [selection, setIsEditing]);

  const handleBlur = useCallback(() => {
    saveCurrentCell();
    setIsEditing(false);
  }, [saveCurrentCell, setIsEditing]);

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
        setInputValue(cellData.get(key)?.raw || '');
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
  }, [selection, saveCurrentCell, moveToCell, cellData, setInputValue, setIsEditing, containerRef]);

  return (
    <div className={styles.formulaBar}>
      <div className={styles.formulaBarLabel}>{cellRef}</div>
      <div className={styles.formulaBarInput}>
        <span className={styles.fxLabel}>
          <span className={styles.fxF}>f</span>x
        </span>
        <input
          className={styles.formulaInput}
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={!selection}
        />
      </div>
    </div>
  );
}
