"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import DashboardNavbar from './components/DashboardNavbar';
import WorkspaceGrid from './components/workspaces/WorkspaceGrid';
import NoAccessModal from './components/NoAccessModal';
import { useWorkspaces, Workspace } from './hooks/useWorkspaces';
import { useAuthFetch } from './hooks/useAuthFetch';
import { useUserPlan } from '../hooks/useUserPlan';
import styles from './page.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.firstName;
  const { workspaces, loading, error, createWorkspace, deleteWorkspace, renameWorkspace } = useWorkspaces();
  const { fetchWithAuth } = useAuthFetch();
  const userPlan = useUserPlan();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleOpen = (workspace: Workspace) => {
    router.push(`/dashboard/workspace/${workspace.id}`);
  };

  const handleDelete = (workspace: Workspace) => {
    if (!window.confirm(`Delete "${workspace.name}"? This will also delete all sheets in this workspace.`)) {
      return;
    }
    deleteWorkspace(workspace.id);
  };

  const handleRename = (workspace: Workspace, name: string) => {
    renameWorkspace(workspace.id, name);
  };

  const handleExport = async (workspace: Workspace) => {
    try {
      const response = await fetchWithAuth(`/api/workspaces/${workspace.id}/export`);
      if (!response.ok) {
        throw new Error('Failed to export workspace');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${workspace.name}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export workspace:', err);
      alert('Failed to export workspace');
    }
  };

  const handleAdd = () => {
    if (userPlan?.plan !== 'pro' && workspaces.length >= 1) {
      setShowUpgradeModal(true);
      return;
    }
    const workspace = createWorkspace();
    router.push(`/dashboard/workspace/${workspace.id}`);
  };

  return (
    <div className={styles.container}>
      <NoAccessModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Workspace limit reached"
        line1="The free plan only allows 1 workspace."
        line2="Upgrade to Pro for unlimited workspaces."
      />
      <DashboardNavbar />
      <h1 className={styles.title}>
        {firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'}
      </h1>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : (
        <WorkspaceGrid
          workspaces={workspaces}
          onOpen={handleOpen}
          onDelete={handleDelete}
          onRename={handleRename}
          onExport={handleExport}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}
