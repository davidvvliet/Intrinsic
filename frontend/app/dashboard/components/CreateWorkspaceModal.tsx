"use client";

import { useState, useRef } from 'react';
import styles from './CreateWorkspaceModal.module.css';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlank: (name: string) => void;
  onCreateWithFile: (name: string, file: File) => Promise<void>;
}

export default function CreateWorkspaceModal({ isOpen, onClose, onCreateBlank, onCreateWithFile }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setName('');
    setFile(null);
    setError('');
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    const workspaceName = name.trim() || 'Untitled';
    if (file) {
      setLoading(true);
      setError('');
      try {
        await onCreateWithFile(workspaceName, file);
        handleClose();
      } catch (err: any) {
        setError(err.message || 'Failed to create workspace');
      } finally {
        setLoading(false);
      }
    } else {
      onCreateBlank(workspaceName);
      handleClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose}>×</button>
        <h3 className={styles.title}>New Workspace</h3>

        <div className={styles.field}>
          <label className={styles.label}>Workspace name</label>
          <input
            className={styles.input}
            type="text"
            placeholder="Untitled"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Upload file (optional)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileChange}
            className={styles.hiddenInput}
          />
          <button className={styles.fileButton} onClick={() => fileInputRef.current?.click()}>
            {file ? file.name : 'Choose .xlsx or .csv'}
          </button>
          {file && (
            <button className={styles.clearFile} onClick={() => setFile(null)}>Remove</button>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={handleClose}>Cancel</button>
          <button className={styles.createButton} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
