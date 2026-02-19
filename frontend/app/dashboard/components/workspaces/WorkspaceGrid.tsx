import React from 'react';
import { Workspace } from '../../hooks/useWorkspaces';
import WorkspaceCard from './WorkspaceCard';
import AddWorkspaceCard from './AddWorkspaceCard';
import styles from './WorkspaceGrid.module.css';

interface WorkspaceGridProps {
  workspaces: Workspace[];
  onOpen: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
  onAdd: () => void;
  creating?: boolean;
}

export default function WorkspaceGrid({ workspaces, onOpen, onDelete, onAdd, creating }: WorkspaceGridProps) {
  return (
    <div className={styles.grid}>
      <AddWorkspaceCard onAdd={onAdd} creating={creating} />
      {workspaces.map(workspace => (
        <WorkspaceCard
          key={workspace.id}
          workspace={workspace}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
