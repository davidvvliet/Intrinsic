import { useState, useRef, useEffect, useCallback } from 'react';
import type { NumberFormatType, NumberFormatSettings } from './types';
import { FORMAT_LABELS, FORMAT_EXAMPLES } from './formatUtils';
import styles from './FormatDropdown.module.css';

const FORMAT_TYPES: NumberFormatType[] = [
  'automatic',
  'text',
  'number',
  'percent',
  'scientific',
  'accounting',
  'financial',
  'currency',
  'currencyRounded',
  'date',
  'time',
  'datetime',
  'duration',
];

// Group separators for visual organization
const GROUP_BREAKS: NumberFormatType[] = ['text', 'scientific', 'currencyRounded', 'duration'];

type FormatDropdownProps = {
  currentFormat?: NumberFormatSettings;
  onSelectFormat: (format: NumberFormatSettings | null) => void;
  disabled?: boolean;
};

export default function FormatDropdown({ currentFormat, onSelectFormat, disabled }: FormatDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

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

  const handleFormatSelect = useCallback((formatType: NumberFormatType) => {
    if (formatType === 'automatic') {
      onSelectFormat(null);
    } else {
      onSelectFormat({ type: formatType });
    }
    setIsOpen(false);
  }, [onSelectFormat]);

  // Prevent focus loss
  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const currentType = currentFormat?.type || 'automatic';
  const displayLabel = FORMAT_LABELS[currentType];

  return (
    <>
      <button
        ref={buttonRef}
        className={styles.button}
        onMouseDown={preventFocusLoss}
        onClick={handleButtonClick}
        disabled={disabled}
        title="Number format"
      >
        <span className={styles.label}>123</span>
        <span className={styles.arrow}>&#9662;</span>
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
          onMouseDown={preventFocusLoss}
        >
          {FORMAT_TYPES.map((formatType, index) => (
            <div key={formatType}>
              <button
                className={`${styles.option} ${formatType === currentType ? styles.selected : ''}`}
                onClick={() => handleFormatSelect(formatType)}
              >
                <span className={styles.checkmark}>
                  {formatType === currentType ? '✓' : ''}
                </span>
                <span className={styles.optionLabel}>{FORMAT_LABELS[formatType]}</span>
                <span className={styles.optionExample}>{FORMAT_EXAMPLES[formatType]}</span>
              </button>
              {GROUP_BREAKS.includes(formatType) && index < FORMAT_TYPES.length - 1 && (
                <div className={styles.separator} />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
