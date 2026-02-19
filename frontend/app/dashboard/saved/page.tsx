"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import DashboardNavbar from '../components/DashboardNavbar';
import CreateListModal from './components/CreateListModal';
import SavedSheetsTable, { ExportFormat } from './components/SavedSheetsTable';
import { useSavedLists } from './hooks/useSavedLists';
import { useSavedSheets, SavedSheet } from './hooks/useSavedSheets';
import { useAuthFetch } from '../hooks/useAuthFetch';
import styles from './page.module.css';

export default function SavedPage() {
  const router = useRouter();
  const { fetchWithAuth } = useAuthFetch();
  const { lists, loading: listsLoading, createList, deleteList } = useSavedLists();
  const { sheets, loading: sheetsLoading, deleteSheet } = useSavedSheets();
  const [selectedListId, setSelectedListId] = useState<number | 'all'>('all');

  // Create list modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('#3b82f6');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const loading = listsLoading || sheetsLoading;

  // Only show sheets that have been saved to a list
  const savedSheets = sheets.filter(s => s.list_ids.length > 0);

  const filteredSheets = selectedListId === 'all'
    ? savedSheets
    : savedSheets.filter(s => s.list_ids.includes(selectedListId));

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreateLoading(true);
    setCreateError('');
    try {
      await createList(newListName.trim(), newListColor);
      setNewListName('');
      setNewListColor('#3b82f6');
      setShowCreateModal(false);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create list');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteList = async (listId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const list = lists.find(l => l.id === listId);

    if (!window.confirm(`Are you sure you want to delete "${list?.name}"?`)) return;

    try {
      await deleteList(listId);
      if (selectedListId === listId) {
        setSelectedListId('all');
      }
    } catch (err) {
      console.error('Failed to delete list:', err);
      alert('Failed to delete list. Please try again.');
    }
  };

  const handleSheetClick = (sheet: SavedSheet) => {
    router.push(`/dashboard?sheet=${sheet.id}`);
  };

  const handleDeleteSheet = async (sheetId: string) => {
    const sheet = sheets.find(s => s.id === sheetId);

    if (!window.confirm(`Are you sure you want to delete "${sheet?.name}"?`)) return;

    try {
      await deleteSheet(sheetId);
    } catch (err) {
      console.error('Failed to delete sheet:', err);
      alert('Failed to delete sheet. Please try again.');
    }
  };

  const handleExportSheet = async (sheetId: string, format: ExportFormat) => {
    const sheet = sheets.find(s => s.id === sheetId);

    try {
      // Fetch full sheet data
      const response = await fetchWithAuth(`/api/sheets/${sheetId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sheet data');
      }

      const sheetData = await response.json();
      const cells = sheetData.data?.cells || {};

      // Find dimensions
      let maxRow = 0;
      let maxCol = 0;
      Object.keys(cells).forEach(key => {
        const [rowStr, colStr] = key.split(',');
        const row = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);
        if (row > maxRow) maxRow = row;
        if (col > maxCol) maxCol = col;
      });

      if (format === 'csv') {
        // CSV export
        const lines: string[] = [];
        for (let r = 0; r <= maxRow; r++) {
          const row: string[] = [];
          for (let c = 0; c <= maxCol; c++) {
            const cellData = cells[`${r},${c}`];
            let value = cellData?.raw || '';
            // Escape quotes and wrap if contains comma/quote/newline
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              value = `"${value.replace(/"/g, '""')}"`;
            }
            row.push(value);
          }
          lines.push(row.join(','));
        }
        const csvContent = lines.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sheet?.name || 'export'}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // XLSX export
        const ws: XLSX.WorkSheet = {};

        Object.entries(cells).forEach(([key, cellData]: [string, any]) => {
          const [rowStr, colStr] = key.split(',');
          const row = parseInt(rowStr, 10);
          const col = parseInt(colStr, 10);

          const colLetter = col < 26
            ? String.fromCharCode(65 + col)
            : String.fromCharCode(65 + Math.floor(col / 26) - 1) + String.fromCharCode(65 + (col % 26));

          const cellRef = `${colLetter}${row + 1}`;

          const rawValue = cellData.raw;
          if (cellData.type === 'formula') {
            const formula = rawValue.startsWith('=') ? rawValue.substring(1) : rawValue;
            ws[cellRef] = { f: formula };
          } else if (cellData.type === 'number' && !isNaN(parseFloat(rawValue))) {
            ws[cellRef] = { v: parseFloat(rawValue), t: 'n' };
          } else {
            ws[cellRef] = { v: rawValue, t: 's' };
          }
        });

        const endCol = maxCol < 26
          ? String.fromCharCode(65 + maxCol)
          : String.fromCharCode(65 + Math.floor(maxCol / 26) - 1) + String.fromCharCode(65 + (maxCol % 26));
        ws['!ref'] = `A1:${endCol}${maxRow + 1}`;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

        XLSX.writeFile(wb, `${sheet?.name || 'export'}.xlsx`);
      }
    } catch (err) {
      console.error('Failed to export sheet:', err);
      alert('Failed to export sheet. Please try again.');
    }
  };

  return (
    <div className={styles.container}>
      <DashboardNavbar />
      <h1 className={styles.title}>Saved sheets</h1>

      {/* Lists Bar */}
      <div className={styles.listsBar}>
        <button
          className={`${styles.allButton} ${selectedListId === 'all' ? styles.allButtonSelected : ''}`}
          onClick={() => setSelectedListId('all')}
        >
          All
        </button>

        {lists.map(list => (
          <div key={list.id} className={styles.listButtonWrapper}>
            <button
              className={`${styles.listButton} ${selectedListId === list.id ? styles.listButtonSelected : ''}`}
              style={{
                borderColor: list.color,
                color: selectedListId === list.id ? '#ffffff' : list.color,
                backgroundColor: selectedListId === list.id ? list.color : 'transparent',
              }}
              onClick={() => setSelectedListId(list.id)}
            >
              {list.name}
            </button>
            <button
              className={styles.deleteListButton}
              onClick={(e) => handleDeleteList(list.id, e)}
            >
              ×
            </button>
          </div>
        ))}

        <button
          className={styles.createListButton}
          onClick={() => setShowCreateModal(true)}
        >
          + Create list
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <SavedSheetsTable
          sheets={filteredSheets}
          lists={lists}
          onSheetClick={handleSheetClick}
          onDelete={handleDeleteSheet}
          onExport={handleExportSheet}
        />
      )}

      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateError('');
        }}
        name={newListName}
        onNameChange={setNewListName}
        color={newListColor}
        onColorChange={setNewListColor}
        onCreate={handleCreateList}
        loading={createLoading}
        error={createError}
      />
    </div>
  );
}
