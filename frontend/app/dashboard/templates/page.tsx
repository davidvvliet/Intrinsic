"use client";

import { useState } from 'react';
import DashboardNavbar from '../components/DashboardNavbar';
import TemplateGrid from './components/TemplateGrid';
import { useTemplates, Template, MAX_TEMPLATE_SIZE_BYTES } from './hooks/useTemplates';
import { useAuthFetch } from '../hooks/useAuthFetch';
import styles from './page.module.css';

export default function TemplatesPage() {
  const { templates, loading, error, uploadTemplate, deleteTemplate } = useTemplates();
  const { fetchWithAuth } = useAuthFetch();
  const [uploading, setUploading] = useState(false);

  const handleUse = async (template: Template) => {
    try {
      const res = await fetchWithAuth(`/api/templates/${template.id}/use`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to create sheet from template');
      }
      const { id } = await res.json();
      window.open(`/dashboard?sheet=${id}`, '_blank');
    } catch (err) {
      console.error('Failed to use template:', err);
      alert('Failed to open template');
    }
  };

  const handleDelete = async (template: Template) => {
    if (!window.confirm(`Delete "${template.name}"?`)) return;
    try {
      await deleteTemplate(template.id);
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert('Failed to delete template');
    }
  };

  const handleFileSelect = async (file: File) => {
    if (file.size > MAX_TEMPLATE_SIZE_BYTES) {
      alert(`File too large. Maximum size is 1MB, got ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    setUploading(true);

    try {
      await uploadTemplate(file);
    } catch (err: any) {
      console.error('Failed to import template:', err);
      alert(err.message || 'Failed to import template');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.container}>
      <DashboardNavbar />
      <h1 className={styles.title}>Templates</h1>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : (
        <TemplateGrid
          templates={templates}
          onUse={handleUse}
          onDelete={handleDelete}
          onFileSelect={handleFileSelect}
          uploading={uploading}
        />
      )}
    </div>
  );
}
