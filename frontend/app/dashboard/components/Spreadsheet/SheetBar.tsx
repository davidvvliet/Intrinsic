import { useState, useRef } from 'react';
import { useSheetRouter } from '../../hooks/useSheetRouter';
import styles from './SheetBar.module.css';

export default function SheetBar() {
  const {
    activeSheetId,
    sheets,
    setActiveSheet,
    createSheet,
    deleteSheet,
    renameSheet,
  } = useSheetRouter();

  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartRename = (sheetId: string, name: string) => {
    setEditingSheetId(sheetId);
    setEditingName(name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSaveRename = () => {
    if (editingSheetId) {
      renameSheet(editingSheetId, editingName);
      setEditingSheetId(null);
    }
  };

  const handleCancelRename = () => {
    setEditingSheetId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveRename();
    else if (e.key === 'Escape') handleCancelRename();
  };

  return (
    <div className={styles.sheetBar}>
      <button
        className={styles.addButton}
        onClick={() => createSheet()}
        title="Add new sheet"
      >
        +
      </button>
      <div className={styles.tabs}>
        {sheets.map((sheet) => (
          <div
            key={sheet.sheetId}
            className={`${styles.tabContainer} ${activeSheetId === sheet.sheetId ? styles.active : ''}`}
          >
            {editingSheetId === sheet.sheetId ? (
              <input
                ref={inputRef}
                type="text"
                className={styles.renameInput}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleSaveRename}
              />
            ) : (
              <button
                className={styles.tab}
                onClick={() => {
                  if (activeSheetId === sheet.sheetId) {
                    handleStartRename(sheet.sheetId, sheet.name);
                  } else {
                    setActiveSheet(sheet.sheetId);
                  }
                }}
              >
                {sheet.name}
              </button>
            )}
            <div className={styles.deleteButtonWrapper}>
              <button
                className={styles.deleteButton}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete "${sheet.name}"?`)) {
                    deleteSheet(sheet.sheetId);
                  }
                }}
                title="Delete sheet"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
