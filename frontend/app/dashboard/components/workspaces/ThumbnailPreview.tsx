import styles from './ThumbnailPreview.module.css';

interface PreviewCellFormat {
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  fillColor?: string;
}

interface ThumbnailPreviewProps {
  previewData: Record<string, { raw: string; type: string; format?: PreviewCellFormat }> | null;
}

export default function ThumbnailPreview({ previewData }: ThumbnailPreviewProps) {
  // Build 10 rows x 6 cols grid
  const rows = [];
  for (let r = 0; r < 10; r++) {
    const cells = [];
    for (let c = 0; c < 6; c++) {
      const key = `${r},${c}`;
      const cellData = previewData?.[key];
      const value = cellData?.raw || '';
      const format = cellData?.format;

      const style: React.CSSProperties = {
        ...(format?.fillColor && { backgroundColor: format.fillColor }),
        ...(format?.textColor && { color: format.textColor }),
        ...(format?.bold && { fontWeight: 'bold' }),
        ...(format?.italic && { fontStyle: 'italic' }),
      };

      cells.push(
        <div key={key} className={styles.cell} style={style}>
          {value}
        </div>
      );
    }
    rows.push(
      <div key={r} className={styles.row}>
        {cells}
      </div>
    );
  }

  return <div className={styles.grid}>{rows}</div>;
}
