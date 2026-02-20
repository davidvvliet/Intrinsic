import React, { useState, useRef } from 'react';
import { Workspace } from '../../hooks/useWorkspaces';
import ThumbnailPreview from './ThumbnailPreview';
import styles from './WorkspaceCard.module.css';

interface WorkspaceCardProps {
  workspace: Workspace;
  onOpen: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
  onRename: (workspace: Workspace, name: string) => void;
  onExport: (workspace: Workspace) => void;
}

export default function WorkspaceCard({ workspace, onOpen, onDelete, onRename, onExport }: WorkspaceCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(workspace);
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExport(workspace);
  };

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditingName(workspace.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = () => {
    const trimmed = editingName.trim() || 'Untitled';
    if (trimmed !== workspace.name) {
      onRename(workspace, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') setIsEditing(false);
  };

  return (
    <div className={styles.card} onClick={() => onOpen(workspace)}>
      <button className={styles.deleteButton} onClick={handleDelete}>
        ×
      </button>
      <div className={styles.thumbnail}>
        <ThumbnailPreview previewData={workspace.preview_data} />
      </div>
      <div className={styles.bar}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className={styles.renameInput}
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.name} onClick={handleNameClick}>{workspace.name}</span>
        )}
        <button className={styles.exportButton} onClick={handleExport} title="Export as XLSX">
          <img src="/export.svg" alt="Export" width="20" height="20" />
        </button>
      </div>
    </div>
  );
}
