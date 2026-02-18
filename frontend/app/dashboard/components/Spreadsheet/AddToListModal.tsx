"use client";

import { useState, useEffect } from 'react';
import { useAuthFetch } from '../../hooks/useAuthFetch';
import styles from './AddToListModal.module.css';

interface SavedList {
  id: number;
  name: string;
  color: string;
  count: number;
}

interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetId: string | null;
  sheetName: string;
  onSave: (listId: number) => void;
}

const COLOR_OPTIONS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#eab308', '#64748b'];

export default function AddToListModal({
  isOpen,
  onClose,
  sheetId,
  sheetName,
  onSave,
}: AddToListModalProps) {
  const { fetchWithAuth } = useAuthFetch();
  const [lists, setLists] = useState<SavedList[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentListIds, setCurrentListIds] = useState<number[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Create list form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('#3b82f6');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, sheetId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [listsResponse, sheetResponse] = await Promise.all([
        fetchWithAuth('/api/lists'),
        sheetId ? fetchWithAuth(`/api/sheets/${sheetId}`) : null,
      ]);

      if (listsResponse.ok) {
        const data = await listsResponse.json();
        setLists(data);
      }

      if (sheetResponse?.ok) {
        const sheetData = await sheetResponse.json();
        setCurrentListIds(sheetData.list_ids || []);
        setSelectedListId(null);
      } else {
        setCurrentListIds([]);
        setSelectedListId(null);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      const response = await fetchWithAuth('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim(), color: newListColor }),
      });

      if (response.ok) {
        const newList = await response.json();
        setLists(prev => [...prev, { ...newList, count: 0 }]);
        setSelectedListId(newList.id);
        setShowCreateForm(false);
        setNewListName('');
        setNewListColor('#3b82f6');
      } else {
        alert('Failed to create list. Please try again.');
      }
    } catch (err) {
      console.error('Failed to create list:', err);
      alert('Failed to create list. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedListId || !sheetId) return;
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/sheets/${sheetId}/list`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_id: selectedListId }),
      });

      if (response.ok) {
        const listName = lists.find(l => l.id === selectedListId)?.name || 'list';
        alert(`Sheet saved to "${listName}" successfully.`);
        onSave(selectedListId);
        onClose();
      } else if (response.status === 409) {
        alert('This sheet is already in this list.');
      } else {
        alert('Failed to save to list. Please try again.');
      }
    } catch (err) {
      console.error('Failed to save to list:', err);
      alert('Failed to save to list. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedList = lists.find(l => l.id === selectedListId);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
        <h3 className={styles.title}>Add to List</h3>
        <p className={styles.subtitle}>Save "{sheetName}" to a list</p>

        {loading ? (
          <div className={styles.loading}>Loading lists...</div>
        ) : (
          <>
            <div className={styles.listContainer}>
              {lists.length === 0 ? (
                <p className={styles.emptyText}>No lists yet. Create one below.</p>
              ) : (
                lists.map((list) => {
                  const isCurrentList = currentListIds.includes(list.id);
                  return (
                    <label
                      key={list.id}
                      className={`${styles.listOption} ${selectedListId === list.id ? styles.listOptionSelected : ''} ${isCurrentList ? styles.listOptionDisabled : ''}`}
                      style={{
                        borderColor: selectedListId === list.id ? list.color : 'rgba(0, 0, 0, 0.15)',
                        backgroundColor: selectedListId === list.id ? `${list.color}15` : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name="list"
                        value={list.id}
                        checked={selectedListId === list.id}
                        onChange={() => !isCurrentList && setSelectedListId(list.id)}
                        disabled={isCurrentList}
                        className={styles.radioInput}
                      />
                      <span className={styles.listName} style={{ color: list.color }}>
                        {list.name}
                      </span>
                      {isCurrentList ? (
                        <span className={styles.alreadyInList}>Already in this list</span>
                      ) : (
                        <span className={styles.listCount}>{list.count} {list.count === 1 ? 'sheet' : 'sheets'}</span>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            <div className={styles.createSection}>
              {!showCreateForm ? (
                <button
                  className={styles.createListButton}
                  onClick={() => setShowCreateForm(true)}
                >
                  + Create New List
                </button>
              ) : (
                <div className={styles.createForm}>
                  <input
                    type="text"
                    placeholder="List name"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className={styles.input}
                  />

                  <div className={styles.colorPicker}>
                    <span className={styles.colorLabel}>Color:</span>
                    <div className={styles.colorOptions}>
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          className={`${styles.colorButton} ${newListColor === color ? styles.colorButtonSelected : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewListColor(color)}
                          disabled={creating}
                        />
                      ))}
                    </div>
                  </div>

                  <div className={styles.createFormButtons}>
                    <button
                      className={styles.cancelButton}
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewListName('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className={styles.createButton}
                      onClick={handleCreateList}
                      disabled={!newListName.trim() || creating}
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.footer}>
              <button
                className={styles.saveButton}
                onClick={handleSave}
                disabled={!selectedListId || saving || currentListIds.includes(selectedListId)}
              >
                {saving ? 'Saving...' : `Save to ${selectedList?.name || 'List'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
