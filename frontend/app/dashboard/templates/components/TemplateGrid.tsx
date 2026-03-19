import { Template } from '../hooks/useTemplates';
import TemplateCard from './TemplateCard';
import AddTemplateCard from './AddTemplateCard';
import styles from './TemplateGrid.module.css';

interface TemplateGridProps {
  templates: Template[];
  onUse: (template: Template) => void;
  onDelete: (template: Template) => void;
  onFileSelect: (file: File) => void;
  uploading?: boolean;
  onUpgradeRequired?: () => void;
}

export default function TemplateGrid({ templates, onUse, onDelete, onFileSelect, uploading, onUpgradeRequired }: TemplateGridProps) {
  return (
    <div className={styles.grid}>
      <AddTemplateCard onFileSelect={onFileSelect} uploading={uploading} onUpgradeRequired={onUpgradeRequired} />
      {templates.map(template => (
        <TemplateCard
          key={template.id}
          template={template}
          onUse={onUse}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
