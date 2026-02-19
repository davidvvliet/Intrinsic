import React from 'react';
import { Template } from '../hooks/useTemplates';
import styles from './TemplateCard.module.css';

interface TemplateCardProps {
  template: Template;
  onUse: (template: Template) => void;
  onDelete: (template: Template) => void;
}

export default function TemplateCard({ template, onUse, onDelete }: TemplateCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.thumbnail}>
        {template.thumbnail_url ? (
          <img src={template.thumbnail_url} alt={template.name} />
        ) : (
          <div className={styles.placeholder} />
        )}
      </div>
      <div className={styles.bar}>
        <div className={styles.info}>
          <span className={styles.name}>{template.name}</span>
          {template.sheet_count > 1 && (
            <span className={styles.sheetCount}>{template.sheet_count} sheets</span>
          )}
        </div>
        <div className={styles.buttons}>
          <button className={styles.useButton} onClick={() => onUse(template)}>
            Open
          </button>
          {!template.is_default && (
            <button className={styles.deleteButton} onClick={() => onDelete(template)}>
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
