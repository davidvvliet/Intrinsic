import styles from './AddWorkspaceCard.module.css';

interface AddWorkspaceCardProps {
  onAdd: () => void;
  disabled?: boolean;
}

export default function AddWorkspaceCard({ onAdd, disabled }: AddWorkspaceCardProps) {
  return (
    <div className={styles.card} onClick={disabled ? undefined : onAdd} style={disabled ? { cursor: 'default', opacity: 0.5 } : undefined}>
      {disabled ? <div className={styles.spinner} /> : <span className={styles.plus}>+</span>}
      <span className={styles.label}>New Workspace</span>
    </div>
  );
}
