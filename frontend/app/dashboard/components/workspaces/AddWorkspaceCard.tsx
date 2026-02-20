import styles from './AddWorkspaceCard.module.css';

interface AddWorkspaceCardProps {
  onAdd: () => void;
}

export default function AddWorkspaceCard({ onAdd }: AddWorkspaceCardProps) {
  return (
    <div className={styles.card} onClick={onAdd}>
      <span className={styles.plus}>+</span>
      <span className={styles.label}>New Workspace</span>
    </div>
  );
}
