"use client";

import { useState } from 'react';
import DashboardNavbar from '../components/DashboardNavbar';
import TemplateGrid from './components/TemplateGrid';
import NoAccessModal from '../components/NoAccessModal';
import { useTemplates, Template, MAX_TEMPLATE_SIZE_BYTES } from './hooks/useTemplates';
import { useAuthFetch } from '../hooks/useAuthFetch';
import { useUserPlan } from '../../hooks/useUserPlan';
import styles from './page.module.css';

export default function TemplatesPage() {
  const { templates, loading, error, uploadTemplate, deleteTemplate } = useTemplates();
  const { fetchWithAuth } = useAuthFetch();
  const userPlan = useUserPlan();
  const [uploading, setUploading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isPro = userPlan?.plan === 'pro';

  const handleUse = async (template: Template) => {
    if (!isPro) {
      setShowUpgradeModal(true);
      return;
    }
    try {
      const res = await fetchWithAuth(`/api/templates/${template.id}/use`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to create workspace from template');
      }
      const { workspace_id } = await res.json();
      window.location.href = `/dashboard/workspace/${workspace_id}`;
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
      <NoAccessModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Pro feature"
        line1="Templates are only available on the Pro plan."
        line2="Upgrade to Pro to use and upload templates."
      />
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
          onUpgradeRequired={!isPro ? () => setShowUpgradeModal(true) : undefined}
        />
      )}
    </div>
  );
}
