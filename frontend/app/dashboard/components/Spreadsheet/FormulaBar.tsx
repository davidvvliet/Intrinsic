import { useMemo, useCallback } from 'react';
import { useSpreadsheetContext } from './SpreadsheetContext';
import { getColumnLabel, getCellKey, getFormulaSegments } from './drawUtils';
import { FORMULA_REFERENCE_COLORS } from './config';
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
    const input = e.currentTarget;

    // Auto-pair parentheses
    if (e.key === '(' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const cursorPos = input.selectionStart || 0;
      const newValue = input.value.slice(0, cursorPos) + '()' + input.value.slice(cursorPos);
      input.value = newValue;
      input.setSelectionRange(cursorPos + 1, cursorPos + 1);
      setInputValue(newValue);
      return;
    }

    // Materialize closing parenthesis if user types ')' over auto-inserted one
    if (e.key === ')' && !e.ctrlKey && !e.metaKey) {
      const cursorPos = input.selectionStart || 0;
      const value = input.value;
      
      // Check if next character is already ')'
      if (value[cursorPos] === ')') {
        e.preventDefault();
        // Just move cursor forward, don't insert new ')'
        input.setSelectionRange(cursorPos + 1, cursorPos + 1);
        return;
      }
    }

    // Smart backspace for empty parentheses
    if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey) {
      const cursorPos = input.selectionStart || 0;
      const value = input.value;
      
      // Check if cursor is right after '(' and next char is ')'
      if (cursorPos > 0 && value[cursorPos - 1] === '(' && value[cursorPos] === ')') {
        e.preventDefault();
        // Delete both parentheses
        const newValue = value.slice(0, cursorPos - 1) + value.slice(cursorPos + 1);
        input.value = newValue;
        input.setSelectionRange(cursorPos - 1, cursorPos - 1);
        setInputValue(newValue);
        return;
      }
    }

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

  const isFormula = inputValue.startsWith('=');
  const segments = useMemo(() => getFormulaSegments(inputValue), [inputValue]);

  return (
    <div className={styles.formulaBar}>
      <div className={styles.formulaBarLabel}>{cellRef}</div>
      <div className={styles.formulaBarInput}>
        <span className={styles.fxLabel}>
          <span className={styles.fxF}>f</span>x
        </span>
        <div className={styles.formulaInputWrapper}>
          <input
            className={`${styles.formulaInput} ${isFormula ? styles.formulaInputTransparent : ''}`}
            value={inputValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={!selection}
          />
          {isFormula && (
            <div className={styles.formulaOverlay} aria-hidden>
              {segments.map((seg, i) => (
                <span
                  key={i}
                  style={seg.colorIndex !== null ? { color: FORMULA_REFERENCE_COLORS[seg.colorIndex % FORMULA_REFERENCE_COLORS.length].border } : undefined}
                >
                  {seg.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
