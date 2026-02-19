import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import { useAuthFetch } from '../../hooks/useAuthFetch';

export interface TemplateData {
  cells: Record<string, any>;
  dimensions?: { rows: number; cols: number };
  settings?: Record<string, any>;
  formatting?: Record<string, any>;
}

export interface Template {
  id: number;
  name: string;
  thumbnail_url: string | null;
  is_default: boolean;
  created_at: string | null;
  data?: TemplateData;
}

export const MAX_TEMPLATE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

export function useTemplates() {
  const { user, loading: authLoading } = useAuth();
  const { fetchWithAuth, getAccessToken } = useAuthFetch();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  const loadTemplates = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetchWithAuth('/api/templates');

      if (!response.ok) {
        throw new Error('Failed to load templates');
      }

      const data: Template[] = await response.json();
      setTemplates(data);
      hasLoadedRef.current = true;
    } catch (err: any) {
      console.error('Error loading templates:', err);
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, getAccessToken]);

  const getTemplate = useCallback(async (templateId: number): Promise<Template> => {
    const response = await fetchWithAuth(`/api/templates/${templateId}`);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.detail || 'Failed to load template');
    }

    return response.json();
  }, [fetchWithAuth]);

  const uploadTemplate = useCallback(async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetchWithAuth('/api/templates/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.detail || 'Failed to upload template');
      }

      const newTemplate = await response.json();
      await loadTemplates();
      return newTemplate;
    } catch (err: any) {
      throw err;
    }
  }, [fetchWithAuth, loadTemplates]);

  const deleteTemplate = useCallback(async (templateId: number) => {
    try {
      const response = await fetchWithAuth(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to delete template');
      }

      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (err: any) {
      throw err;
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setTemplates([]);
      setError('');
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    if (!hasLoadedRef.current) {
      loadTemplates();
    }
  }, [user, authLoading, loadTemplates]);

  return { templates, loading, error, reload: loadTemplates, getTemplate, uploadTemplate, deleteTemplate };
}
