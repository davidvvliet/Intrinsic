import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ColorButton.module.css';

// Standard color palette (48 colors, transposed: 8 columns x 6 rows)
// Each column flows vertically: white/gray → yellow → red → green → blue → purple
const COLOR_PALETTE = [
  // Column 1
  '#ffffff', '#fff2cc', '#f4cccc', '#d9ead3', '#cfe2f3', '#d9d2e9',
  // Column 2
  '#f2f2f2', '#ffe699', '#ea9999', '#b6d7a8', '#9fc5e8', '#b4a7d6',
  // Column 3
  '#d9d9d9', '#ffd966', '#e06666', '#93c47d', '#6fa8dc', '#8e7cc3',
  // Column 4
  '#bfbfbf', '#ffc000', '#cc0000', '#6aa84f', '#3d85c6', '#674ea7',
  // Column 5
  '#a6a6a6', '#ff9900', '#990000', '#38761d', '#0b5394', '#351c75',
  // Column 6
  '#808080', '#e69138', '#7f0000', '#274e13', '#073763', '#20124d',
];

type ColorButtonProps = {
  icon: 'text' | 'fill';
  currentColor?: string;
  onSelectColor: (color: string | null) => void;
  disabled?: boolean;
};

export default function ColorButton({ icon, currentColor, onSelectColor, disabled }: ColorButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Position the picker below the button
  useEffect(() => {
    if (!isOpen || !buttonRef.current || !pickerRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const pickerRect = pickerRef.current.getBoundingClientRect();
    
    let top = buttonRect.bottom + 4;
    let left = buttonRect.left;

    // Adjust if would go off screen
    if (left + pickerRect.width > window.innerWidth) {
      left = window.innerWidth - pickerRect.width - 8;
    }
    if (top + pickerRect.height > window.innerHeight) {
      top = buttonRect.top - pickerRect.height - 4;
    }

    setPosition({ top, left });
  }, [isOpen]);

  // Close on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
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

  const handleColorSelect = useCallback((color: string) => {
    onSelectColor(color);
    setIsOpen(false);
  }, [onSelectColor]);

  const handleClear = useCallback(() => {
    onSelectColor(null);
    setIsOpen(false);
  }, [onSelectColor]);

  // Prevent focus loss
  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const defaultColor = icon === 'text' ? '#000000' : '#ffffff';
  const displayColor = currentColor || defaultColor;

  return (
    <>
      <button
        ref={buttonRef}
        className={styles.button}
        onMouseDown={preventFocusLoss}
        onClick={handleButtonClick}
        disabled={disabled}
        title={icon === 'text' ? 'Text Color' : 'Fill Color'}
      >
        {icon === 'text' ? (
          <>
            <span className={styles.textIcon}>A</span>
            <span className={styles.colorBar} style={{ backgroundColor: displayColor }} />
          </>
        ) : (
          <span className={styles.fillIcon} style={{ backgroundColor: displayColor }} />
        )}
      </button>
      {isOpen && (
        <div
          ref={pickerRef}
          className={styles.picker}
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
          onMouseDown={preventFocusLoss}
        >
          <div className={styles.colorGrid}>
            {COLOR_PALETTE.map((color, index) => (
              <button
                key={index}
                className={styles.colorSwatch}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                title={color}
              />
            ))}
          </div>
          <button className={styles.clearButton} onClick={handleClear}>
            <span className={styles.slash}>/</span>
            Clear
          </button>
        </div>
      )}
    </>
  );
}
