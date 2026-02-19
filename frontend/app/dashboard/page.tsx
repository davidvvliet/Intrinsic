"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@workos-inc/authkit-nextjs/components';
import DashboardNavbar from './components/DashboardNavbar';
import WorkspaceGrid from './components/workspaces/WorkspaceGrid';
import { useWorkspaces, Workspace } from './hooks/useWorkspaces';
import styles from './page.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.firstName;
  const { workspaces, loading, error, createWorkspace, deleteWorkspace } = useWorkspaces();
  const [creating, setCreating] = useState(false);

  const handleOpen = (workspace: Workspace) => {
    router.push(`/dashboard/workspace/${workspace.id}`);
  };

  const handleDelete = async (workspace: Workspace) => {
    if (!window.confirm(`Delete "${workspace.name}"? This will also delete all sheets in this workspace.`)) {
      return;
    }
    try {
      await deleteWorkspace(workspace.id);
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      alert('Failed to delete workspace');
    }
  };

  const handleAdd = async () => {
    setCreating(true);
    try {
      const workspace = await createWorkspace();
      router.push(`/dashboard/workspace/${workspace.id}`);
    } catch (err) {
      console.error('Failed to create workspace:', err);
      alert('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.container}>
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
          onAdd={handleAdd}
          creating={creating}
        />
      )}
    </div>
  );
}
