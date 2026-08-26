import { listWorkspaces, switchWorkspace, type Workspace, type WorkspaceRole } from '@slideops/api-client';
import { create } from 'zustand';

interface WorkspaceState {
  workspaces: Workspace[];
  /** Whether the first read has completed, so a caller can tell "not loaded
   * yet" apart from "loaded and it's just my own workspace". */
  loaded: boolean;
  /** Read every workspace the signed in Operator can act in. Never throws:
   * an Operator with only their own workspace is a perfectly normal result. */
  refresh: () => Promise<void>;
  /** Switch the active workspace, then re-read the list so `active` moves. */
  switchTo: (ownerOperatorId: string) => Promise<void>;
  /** Drop the loaded state, for sign out. */
  reset: () => void;
}

/**
 * Which workspace is active, and at what role, for the whole app to read.
 * The active workspace decides what "New", "Deploy", "Install", "Remove", and
 * every other write control may do, since the backend refuses them for a
 * Viewer's active workspace regardless of whose data they are looking at.
 */
export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  loaded: false,
  async refresh() {
    try {
      const workspaces = await listWorkspaces();
      set({ workspaces, loaded: true });
    } catch {
      // A read failure leaves the Operator acting in their own workspace as
      // far as the UI can tell; the backend is still the source of truth and
      // will refuse anything it should refuse regardless.
      set({ workspaces: [], loaded: true });
    }
  },
  async switchTo(ownerOperatorId) {
    await switchWorkspace(ownerOperatorId);
    await get().refresh();
  },
  reset() {
    set({ workspaces: [], loaded: false });
  },
}));

/** The active workspace, or null before the first read completes. */
export function activeWorkspace(workspaces: Workspace[]): Workspace | null {
  return workspaces.find((workspace) => workspace.active) ?? null;
}

/** The Operator's role in the active workspace. Owner until the first read
 * completes, since that is what every account starts as. */
export function activeRole(workspaces: Workspace[]): WorkspaceRole {
  return activeWorkspace(workspaces)?.role ?? 'owner';
}

/** Whether the active workspace's role may perform a write. Only a Viewer
 * cannot; Owner, Admin, and Member all can. */
export function canWrite(workspaces: Workspace[]): boolean {
  return activeRole(workspaces) !== 'viewer';
}

/**
 * Whether the signed in Operator may write in the active workspace, read
 * directly off the store. Every write control in the app (Approve, deploy,
 * install, remove, edit) hides itself when this is false, rather than
 * rendering and letting the backend's 403 be the first the Operator hears of
 * it: a Viewer's role is not a secret, so a control they cannot use should
 * not be offered.
 */
export function useCanWrite(): boolean {
  return useWorkspaceStore((state) => canWrite(state.workspaces));
}
