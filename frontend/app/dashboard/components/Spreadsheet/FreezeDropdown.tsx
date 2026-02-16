import { useState, useRef, useEffect, useCallback } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { getColumnLabel } from './drawUtils';
import styles from './FormatDropdown.module.css';

type FreezeDropdownProps = {
  disabled?: boolean;
};

export default function FreezeDropdown({ disabled }: FreezeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const selection = useSpreadsheetStore(state => state.selection);
  const frozenRows = useSpreadsheetStore(state => state.frozenRows);
  const frozenColumns = useSpreadsheetStore(state => state.frozenColumns);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const updateFrozenRows = useSpreadsheetStore(state => state.updateFrozenRows);
  const updateFrozenColumns = useSpreadsheetStore(state => state.updateFrozenColumns);

  // Position the dropdown below the button
  useEffect(() => {
    if (!isOpen || !buttonRef.current || !dropdownRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const dropdownRect = dropdownRef.current.getBoundingClientRect();

    let top = buttonRect.bottom + 4;
    let left = buttonRect.left;

    // Adjust if would go off screen
    if (left + dropdownRect.width > window.innerWidth) {
      left = window.innerWidth - dropdownRect.width - 8;
    }
    if (top + dropdownRect.height > window.innerHeight) {
      top = buttonRect.top - dropdownRect.height - 4;
    }

    setPosition({ top, left });
  }, [isOpen]);

  // Close on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleButtonClick = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  }, [disabled, isOpen]);

  const handleFreezeRows = useCallback((rows: number) => {
    if (activeSheetId) {
      updateFrozenRows(activeSheetId, rows);
    }
    setIsOpen(false);
  }, [activeSheetId, updateFrozenRows]);

  const handleFreezeColumns = useCallback((cols: number) => {
    if (activeSheetId) {
      updateFrozenColumns(activeSheetId, cols);
    }
    setIsOpen(false);
  }, [activeSheetId, updateFrozenColumns]);

  // Prevent focus loss
  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const currentRow = selection?.start.row ?? 0;
  const currentCol = selection?.start.col ?? 0;

  return (
    <>
      <button
        ref={buttonRef}
        className={styles.button}
        onMouseDown={preventFocusLoss}
        onClick={handleButtonClick}
        disabled={disabled}
        title="Freeze rows and columns"
      >
        <span className={styles.label}>Freeze</span>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
          onMouseDown={preventFocusLoss}
        >
          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Rows</div>
            <button
              className={`${styles.option} ${frozenRows === 0 ? styles.selected : ''}`}
              onClick={() => handleFreezeRows(0)}
            >
              <span className={styles.optionLabel}>No rows</span>
            </button>
            <button
              className={`${styles.option} ${frozenRows === 1 ? styles.selected : ''}`}
              onClick={() => handleFreezeRows(1)}
            >
              <span className={styles.optionLabel}>1 row</span>
            </button>
            <button
              className={`${styles.option} ${frozenRows === 2 ? styles.selected : ''}`}
              onClick={() => handleFreezeRows(2)}
            >
              <span className={styles.optionLabel}>2 rows</span>
            </button>
            {selection && currentRow > 0 && (
              <button
                className={`${styles.option} ${frozenRows === currentRow + 1 ? styles.selected : ''}`}
                onClick={() => handleFreezeRows(currentRow + 1)}
              >
                <span className={styles.optionLabel}>Up to row {currentRow + 1}</span>
              </button>
            )}
          </div>

          <div className={styles.separator} />

          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Columns</div>
            <button
              className={`${styles.option} ${frozenColumns === 0 ? styles.selected : ''}`}
              onClick={() => handleFreezeColumns(0)}
            >
              <span className={styles.optionLabel}>No columns</span>
            </button>
            <button
              className={`${styles.option} ${frozenColumns === 1 ? styles.selected : ''}`}
              onClick={() => handleFreezeColumns(1)}
            >
              <span className={styles.optionLabel}>1 column</span>
            </button>
            <button
              className={`${styles.option} ${frozenColumns === 2 ? styles.selected : ''}`}
              onClick={() => handleFreezeColumns(2)}
            >
              <span className={styles.optionLabel}>2 columns</span>
            </button>
            {selection && currentCol > 0 && (
              <button
                className={`${styles.option} ${frozenColumns === currentCol + 1 ? styles.selected : ''}`}
                onClick={() => handleFreezeColumns(currentCol + 1)}
              >
                <span className={styles.optionLabel}>Up to column {getColumnLabel(currentCol)}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
