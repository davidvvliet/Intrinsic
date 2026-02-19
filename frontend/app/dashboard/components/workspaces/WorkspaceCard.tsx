import React from 'react';
import { Workspace } from '../../hooks/useWorkspaces';
import styles from './WorkspaceCard.module.css';

interface WorkspaceCardProps {
  workspace: Workspace;
  onOpen: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
}

export default function WorkspaceCard({ workspace, onOpen, onDelete }: WorkspaceCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(workspace);
  };

  return (
    <div className={styles.card} onClick={() => onOpen(workspace)}>
      <div className={styles.thumbnail}>
        {workspace.thumbnail_url ? (
          <img src={workspace.thumbnail_url} alt={workspace.name} />
        ) : (
          <div className={styles.placeholder} />
        )}
      </div>
      <div className={styles.bar}>
        <span className={styles.name}>{workspace.name}</span>
        <button className={styles.deleteButton} onClick={handleDelete}>
          ×
        </button>
      </div>
    </div>
  );
}
