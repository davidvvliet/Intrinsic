"use client";

import styles from "./CreateListModal.module.css";

interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  color: string;
  onColorChange: (value: string) => void;
  onCreate: () => void;
  loading?: boolean;
  error?: string;
}

const COLOR_OPTIONS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#eab308', '#64748b'];

export default function CreateListModal({
  isOpen,
  onClose,
  name,
  onNameChange,
  color,
  onColorChange,
  onCreate,
  loading = false,
  error
}: CreateListModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
        <h3 className={styles.title}>Create New List</h3>

        <div className={styles.content}>
          <div className={styles.formGroup}>
            <label className={styles.label}>List Name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Enter list name..."
              className={styles.input}
              maxLength={50}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Color:</label>
            <div className={styles.colorPicker}>
              {COLOR_OPTIONS.map((colorOption) => (
                <button
                  key={colorOption}
                  onClick={() => onColorChange(colorOption)}
                  disabled={loading}
                  className={`${styles.colorButton} ${color === colorOption ? styles.colorButtonSelected : ''}`}
                  style={{ backgroundColor: colorOption }}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}
        </div>

        <div className={styles.buttonGroup}>
          <button
            onClick={onCreate}
            disabled={!name.trim() || loading}
            className={styles.createButton}
          >
            {loading ? 'Creating...' : 'Create List'}
          </button>
        </div>
      </div>
    </div>
  );
}
