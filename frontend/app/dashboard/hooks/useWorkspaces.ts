import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useAuthFetch } from './useAuthFetch';

export interface Workspace {
  id: string;
  name: string;
  thumbnail_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useWorkspaces() {
  const { user, loading: authLoading } = useAuth();
  const { fetchWithAuth, getAccessToken } = useAuthFetch();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  const loadWorkspaces = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetchWithAuth('/api/workspaces');

      if (!response.ok) {
        throw new Error('Failed to load workspaces');
      }

      const data: Workspace[] = await response.json();
      setWorkspaces(data);
      hasLoadedRef.current = true;
    } catch (err: any) {
      console.error('Error loading workspaces:', err);
      setError(err.message || 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, getAccessToken]);

  const createWorkspace = useCallback(async (name?: string): Promise<Workspace> => {
    const response = await fetchWithAuth('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || 'Untitled' }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || 'Failed to create workspace');
    }

    const newWorkspace = await response.json();
    await loadWorkspaces();
    return newWorkspace;
  }, [fetchWithAuth, loadWorkspaces]);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    const response = await fetchWithAuth(`/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || 'Failed to delete workspace');
    }

    setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
  }, [fetchWithAuth]);

  const renameWorkspace = useCallback(async (workspaceId: string, name: string) => {
    const response = await fetchWithAuth(`/api/workspaces/${workspaceId}/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || 'Failed to rename workspace');
    }

    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId ? { ...w, name } : w
    ));
  }, [fetchWithAuth]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setWorkspaces([]);
      setError('');
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    if (!hasLoadedRef.current) {
      loadWorkspaces();
    }
  }, [user, authLoading, loadWorkspaces]);

  return {
    workspaces,
    loading,
    error,
    reload: loadWorkspaces,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
  };
}
