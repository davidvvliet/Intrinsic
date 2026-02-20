import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useAuthFetch } from './useAuthFetch';

export interface PreviewCellFormat {
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  fillColor?: string;
}

export interface Workspace {
  id: string;
  name: string;
  thumbnail_url: string | null;
  preview_data: Record<string, { raw: string; type: string; format?: PreviewCellFormat }> | null;
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

  const createWorkspace = useCallback((name?: string): Workspace => {
    // Generate ID client-side for immediate navigation
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const id = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const workspaceName = name || 'Untitled';
    const now = new Date().toISOString();

    const newWorkspace: Workspace = {
      id,
      name: workspaceName,
      thumbnail_url: null,
      preview_data: null,
      created_at: now,
      updated_at: now,
    };

    // Optimistic update
    setWorkspaces(prev => [newWorkspace, ...prev]);

    // Sync to backend
    fetchWithAuth('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: workspaceName }),
    }).then(response => {
      if (!response.ok) {
        console.error('Failed to create workspace on backend');
      }
    }).catch(err => {
      console.error('Failed to create workspace:', err);
    });

    return newWorkspace;
  }, [fetchWithAuth]);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    // Optimistic update
    setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));

    // Sync to backend
    try {
      const response = await fetchWithAuth(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        console.error('Failed to delete workspace on backend');
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  }, [fetchWithAuth]);

  const renameWorkspace = useCallback(async (workspaceId: string, name: string) => {
    // Optimistic update
    setWorkspaces(prev => prev.map(w =>
      w.id === workspaceId ? { ...w, name } : w
    ));

    // Sync to backend
    try {
      const response = await fetchWithAuth(`/api/workspaces/${workspaceId}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        console.error('Failed to rename workspace on backend');
      }
    } catch (err) {
      console.error('Failed to rename workspace:', err);
    }
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
