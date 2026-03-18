import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useAuthFetch } from '../../hooks/useAuthFetch';

export interface SavedList {
  id: number;
  name: string;
  color: string;
  created_at: string;
  count: number;
}

export function useSavedLists() {
  const { user, loading: authLoading } = useAuth();
  const { fetchWithAuth } = useAuthFetch();
  const [lists, setLists] = useState<SavedList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  const loadLists = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/lists');

      if (!response.ok) {
        throw new Error('Failed to load lists');
      }

      const data: SavedList[] = await response.json();
      setLists(data);
      hasLoadedRef.current = true;
    } catch (err: any) {
      console.error('Error loading lists:', err);
      setError(err.message || 'Failed to load lists');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const createList = useCallback(async (name: string, color?: string) => {
    try {
      const response = await fetchWithAuth('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create list');
      }

      const newList = await response.json();
      setLists(prev => [...prev, { ...newList, count: 0 }]);
      return newList;
    } catch (err: any) {
      throw err;
    }
  }, [fetchWithAuth]);

  const deleteList = useCallback(async (listId: number) => {
    try {
      const response = await fetchWithAuth(`/api/lists/${listId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete list');
      }

      setLists(prev => prev.filter(l => l.id !== listId));
    } catch (err: any) {
      throw err;
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLists([]);
      setError('');
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    if (!hasLoadedRef.current) {
      loadLists();
    }
  }, [user, authLoading, loadLists]);

  return { lists, loading, error, reload: loadLists, createList, deleteList };
}
