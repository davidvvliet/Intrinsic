import styles from './AddWorkspaceCard.module.css';

interface AddWorkspaceCardProps {
  onAdd: () => void;
  creating?: boolean;
}

export default function AddWorkspaceCard({ onAdd, creating }: AddWorkspaceCardProps) {
  return (
    <div className={styles.card} onClick={creating ? undefined : onAdd}>
      {creating ? (
        <div className={styles.spinner} />
      ) : (
        <span className={styles.plus}>+</span>
      )}
      <span className={styles.label}>{creating ? 'Creating...' : 'New Workspace'}</span>
    </div>
  );
}
