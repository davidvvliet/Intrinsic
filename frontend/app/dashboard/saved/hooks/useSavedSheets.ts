import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useAuthFetch } from '../../hooks/useAuthFetch';

export interface SavedSheet {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  list_ids: number[];
  thumbnail: string | null;
}

export function useSavedSheets() {
  const { user, loading: authLoading } = useAuth();
  const { fetchWithAuth } = useAuthFetch();
  const [sheets, setSheets] = useState<SavedSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  const loadSheets = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/sheets');

      if (!response.ok) {
        throw new Error('Failed to load sheets');
      }

      const data: SavedSheet[] = await response.json();
      setSheets(data);
      hasLoadedRef.current = true;
    } catch (err: any) {
      console.error('Error loading sheets:', err);
      setError(err.message || 'Failed to load sheets');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  const deleteSheet = useCallback(async (sheetId: string) => {
    try {
      const response = await fetchWithAuth(`/api/sheets/${sheetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete sheet');
      }

      setSheets(prev => prev.filter(s => s.id !== sheetId));
    } catch (err: any) {
      throw err;
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setSheets([]);
      setError('');
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    if (!hasLoadedRef.current) {
      loadSheets();
    }
  }, [user, authLoading, loadSheets]);

  return { sheets, loading, error, reload: loadSheets, deleteSheet };
}
