import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useAuthFetch } from './useAuthFetch';
import { setPending } from '../utils/pendingWorkspaces';
import { useWorkspacesStore, Workspace } from '../stores/workspacesStore';

// Re-export types from store
export type { PreviewCellFormat, Workspace } from '../stores/workspacesStore';

export function useWorkspaces() {
  const { user, loading: authLoading } = useAuth();
  const { fetchWithAuth } = useAuthFetch();
  const hasLoadedRef = useRef(false);

  // Get state from store
  const workspaces = useWorkspacesStore(state => state.workspaces);
  const loading = useWorkspacesStore(state => state.loading);
  const error = useWorkspacesStore(state => state.error);
  const setWorkspaces = useWorkspacesStore(state => state.setWorkspaces);
  const setLoading = useWorkspacesStore(state => state.setLoading);
  const setError = useWorkspacesStore(state => state.setError);
  const addWorkspaceToStore = useWorkspacesStore(state => state.addWorkspace);
  const removeWorkspaceFromStore = useWorkspacesStore(state => state.removeWorkspace);
  const updateWorkspaceInStore = useWorkspacesStore(state => state.updateWorkspace);

  const loadWorkspaces = useCallback(async () => {
    try {
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
    }
  }, [fetchWithAuth, setWorkspaces, setLoading, setError]);

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
    addWorkspaceToStore(newWorkspace);

    // Sync to backend and register the pending promise
    const createPromise = fetchWithAuth('/api/workspaces', {
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

    setPending(id, createPromise);

    return newWorkspace;
  }, [fetchWithAuth, addWorkspaceToStore]);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    // Optimistic update
    removeWorkspaceFromStore(workspaceId);

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
  }, [fetchWithAuth, removeWorkspaceFromStore]);

  const renameWorkspace = useCallback(async (workspaceId: string, name: string) => {
    // Optimistic update
    updateWorkspaceInStore(workspaceId, { name });

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
  }, [fetchWithAuth, updateWorkspaceInStore]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setWorkspaces([]);
      setError('');
      hasLoadedRef.current = false;
      return;
    }

    if (!hasLoadedRef.current) {
      loadWorkspaces();
    }
  }, [user, authLoading, loadWorkspaces, setWorkspaces, setError]);

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
