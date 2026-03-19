import { useRef } from 'react';
import styles from './AddTemplateCard.module.css';

interface AddTemplateCardProps {
  onFileSelect: (file: File) => void;
  uploading?: boolean;
  onUpgradeRequired?: () => void;
}

export default function AddTemplateCard({ onFileSelect, uploading, onUpgradeRequired }: AddTemplateCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (uploading) return;
    if (onUpgradeRequired) {
      onUpgradeRequired();
      return;
    }
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      e.target.value = '';
    }
  };

  return (
    <div className={styles.card} onClick={handleClick}>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleChange}
        className={styles.input}
      />
      {uploading ? (
        <div className={styles.spinner} />
      ) : (
        <span className={styles.plus}>+</span>
      )}
      <span className={styles.label}>{uploading ? 'Uploading...' : 'Add Template'}</span>
    </div>
  );
}
