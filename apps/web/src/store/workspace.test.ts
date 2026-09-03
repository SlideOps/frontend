import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activeRole, activeWorkspace, canWrite, useWorkspaceStore } from './workspace';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

const own = { id: 'ws_1', name: 'Personal', is_personal: true, role: 'owner' as const, active: true };
const shared = {
  id: 'ws_2',
  name: 'Client X',
  is_personal: false,
  role: 'viewer' as const,
  active: false,
};

beforeEach(() => {
  useWorkspaceStore.setState({ workspaces: [], loaded: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workspace store', () => {
  it('starts unloaded with only an implicit own workspace', () => {
    const state = useWorkspaceStore.getState();
    expect(state.loaded).toBe(false);
    expect(activeRole(state.workspaces)).toBe('owner');
  });

  it('loads every workspace the Operator can act in', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { workspaces: [own, shared] }),
    );

    await useWorkspaceStore.getState().refresh();

    const state = useWorkspaceStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.workspaces).toHaveLength(2);
    expect(activeWorkspace(state.workspaces)?.id).toBe('ws_1');
  });

  it('reports a Viewer as unable to write in the active workspace', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { workspaces: [{ ...own, active: false }, { ...shared, active: true }] }),
    );

    await useWorkspaceStore.getState().refresh();

    const state = useWorkspaceStore.getState();
    expect(activeRole(state.workspaces)).toBe('viewer');
    expect(canWrite(state.workspaces)).toBe(false);
  });

  it('reports loaded even when the read fails, defaulting to the own workspace', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

    await useWorkspaceStore.getState().refresh();

    const state = useWorkspaceStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.workspaces).toHaveLength(0);
    expect(canWrite(state.workspaces)).toBe(true);
  });

  it('switches the active workspace then re-reads the list', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(204, undefined))
      .mockResolvedValueOnce(
        jsonResponse(200, { workspaces: [{ ...own, active: false }, { ...shared, active: true }] }),
      );

    await useWorkspaceStore.getState().switchTo('ws_2');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const state = useWorkspaceStore.getState();
    expect(activeWorkspace(state.workspaces)?.id).toBe('ws_2');
  });

  it('resets to unloaded', () => {
    useWorkspaceStore.setState({ workspaces: [own], loaded: true });
    useWorkspaceStore.getState().reset();
    const state = useWorkspaceStore.getState();
    expect(state.loaded).toBe(false);
    expect(state.workspaces).toHaveLength(0);
  });
});
