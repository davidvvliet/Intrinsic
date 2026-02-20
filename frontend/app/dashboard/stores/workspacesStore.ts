import { create } from 'zustand';

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

interface WorkspacesState {
  workspaces: Workspace[];
  loading: boolean;
  error: string;
}

interface WorkspacesActions {
  setWorkspaces: (workspaces: Workspace[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  addWorkspace: (workspace: Workspace) => void;
  removeWorkspace: (id: string) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  getWorkspaceName: (id: string) => string | null;
  reset: () => void;
}

type WorkspacesStore = WorkspacesState & WorkspacesActions;

const initialState: WorkspacesState = {
  workspaces: [],
  loading: true,
  error: '',
};

export const useWorkspacesStore = create<WorkspacesStore>()((set, get) => ({
  ...initialState,

  setWorkspaces: (workspaces: Workspace[]) => {
    set({ workspaces, loading: false });
  },

  setLoading: (loading: boolean) => {
    set({ loading });
  },

  setError: (error: string) => {
    set({ error, loading: false });
  },

  addWorkspace: (workspace: Workspace) => {
    set(state => ({
      workspaces: [workspace, ...state.workspaces],
    }));
  },

  removeWorkspace: (id: string) => {
    set(state => ({
      workspaces: state.workspaces.filter(w => w.id !== id),
    }));
  },

  updateWorkspace: (id: string, updates: Partial<Workspace>) => {
    set(state => ({
      workspaces: state.workspaces.map(w =>
        w.id === id ? { ...w, ...updates } : w
      ),
    }));
  },

  getWorkspaceName: (id: string) => {
    const workspace = get().workspaces.find(w => w.id === id);
    return workspace?.name ?? null;
  },

  reset: () => {
    set(initialState);
  },
}));
