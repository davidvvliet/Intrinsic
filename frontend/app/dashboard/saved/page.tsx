"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardNavbar from '../components/DashboardNavbar';
import CreateListModal from './components/CreateListModal';
import SavedSheetsTable from './components/SavedSheetsTable';
import { useSavedLists } from './hooks/useSavedLists';
import { useSavedSheets, SavedSheet } from './hooks/useSavedSheets';
import styles from './page.module.css';

export default function SavedPage() {
  const router = useRouter();
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
