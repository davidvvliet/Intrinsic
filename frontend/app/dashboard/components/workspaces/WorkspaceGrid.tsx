import { Workspace } from '../../hooks/useWorkspaces';
import WorkspaceCard from './WorkspaceCard';
import AddWorkspaceCard from './AddWorkspaceCard';
import styles from './WorkspaceGrid.module.css';

interface WorkspaceGridProps {
  workspaces: Workspace[];
  onOpen: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
  onRename: (workspace: Workspace, name: string) => void;
  onExport: (workspace: Workspace) => void;
  onAdd: () => void;
  addDisabled?: boolean;
}

export default function WorkspaceGrid({ workspaces, onOpen, onDelete, onRename, onExport, onAdd, addDisabled }: WorkspaceGridProps) {
  return (
    <div className={styles.grid}>
      <AddWorkspaceCard onAdd={onAdd} disabled={addDisabled} />
      {workspaces.map(workspace => (
        <WorkspaceCard
          key={workspace.id}
          workspace={workspace}
          onOpen={onOpen}
          onDelete={onDelete}
          onRename={onRename}
          onExport={onExport}
        />
      ))}
    </div>
  );
}
