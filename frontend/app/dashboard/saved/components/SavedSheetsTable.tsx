"use client";

import styles from "./SavedSheetsTable.module.css";
import { SavedSheet } from "../hooks/useSavedSheets";
import { SavedList } from "../hooks/useSavedLists";

interface SavedSheetsTableProps {
  sheets: SavedSheet[];
  lists: SavedList[];
  onSheetClick: (sheet: SavedSheet) => void;
  onDelete: (sheetId: string) => void;
  onExport: (sheetId: string) => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default function SavedSheetsTable({ sheets, lists, onSheetClick, onDelete, onExport }: SavedSheetsTableProps) {
  if (sheets.length === 0) {
    return <div className={styles.emptyState}>No sheets found</div>;
  }

  const getListsForSheet = (listIds: number[]): SavedList[] => {
    return listIds.map(id => lists.find(l => l.id === id)).filter((l): l is SavedList => l !== undefined);
  };

  return (
    <table className={styles.table}>
      <thead>
        <tr className={styles.headerRow}>
          <th className={styles.headerCell}>Name</th>
          <th className={styles.headerCell}>List</th>
          <th className={styles.headerCell}>Modified</th>
          <th className={`${styles.headerCell} ${styles.exportHeader}`}>Export</th>
          <th className={`${styles.headerCell} ${styles.deleteHeader}`}></th>
        </tr>
      </thead>
      <tbody>
        {sheets.map((sheet) => {
          const sheetLists = getListsForSheet(sheet.list_ids);
          return (
            <tr
              key={sheet.id}
              className={styles.tableRow}
              onClick={() => onSheetClick(sheet)}
            >
              <td className={styles.sheetCell}>
                <div className={styles.sheetName}>
                  {sheet.name.length > 40 ? sheet.name.substring(0, 40) + "..." : sheet.name}
                </div>
              </td>
              <td className={styles.cell}>
                {sheetLists.length > 0 ? (
                  <div className={styles.listBadges}>
                    {sheetLists.map(list => (
                      <span
                        key={list.id}
                        className={styles.listBadge}
                        style={{
                          color: list.color,
                          borderColor: list.color
                        }}
                      >
                        {list.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className={styles.noList}>—</span>
                )}
              </td>
              <td className={`${styles.cell} ${styles.modifiedCell}`}>
                {formatRelativeTime(sheet.updated_at)}
              </td>
              <td className={`${styles.cell} ${styles.exportCell}`} onClick={(e) => e.stopPropagation()}>
                <button
                  className={styles.exportButton}
                  title="Export sheet"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport(sheet.id);
                  }}
                >
                  <img src="/export.svg" alt="Export" width="18" height="18" />
                </button>
              </td>
              <td className={`${styles.cell} ${styles.deleteCell}`} onClick={(e) => e.stopPropagation()}>
                <button
                  className={styles.deleteButton}
                  title="Delete sheet"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(sheet.id);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
