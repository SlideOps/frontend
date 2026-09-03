import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acceptInvitation,
  createWorkspace,
  deleteWorkspace,
  getInvitation,
  inviteTeamMember,
  listTeam,
  listWorkspaces,
  removeTeamMember,
  renameWorkspace,
  switchWorkspace,
  updateTeamMemberRole,
} from './workspaces';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workspaces requests', () => {
  it('lists every Workspace the Operator can act in', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        workspaces: [
          { id: 'ws_1', name: 'Personal', is_personal: true, role: 'owner', active: true },
          { id: 'ws_2', name: 'Client X', is_personal: false, role: 'member', active: false },
        ],
      }),
    );

    const workspaces = await listWorkspaces();

    expect(workspaces).toHaveLength(2);
    expect(workspaces[0]?.active).toBe(true);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/workspaces');
  });

  it('creates a Workspace by name', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, {
        workspace: { id: 'ws_3', name: 'Client Y', is_personal: false, role: 'owner', active: false },
      }),
    );

    const workspace = await createWorkspace('Client Y');

    expect(workspace.id).toBe('ws_3');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const sent = JSON.parse(String(init?.body)) as { name: string };
    expect(sent.name).toBe('Client Y');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/workspaces');
  });

  it('renames a Workspace', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        workspace: { id: 'ws_2', name: 'Client Z', is_personal: false, role: 'owner', active: false },
      }),
    );

    const workspace = await renameWorkspace('ws_2', 'Client Z');

    expect(workspace.name).toBe('Client Z');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('PATCH');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/workspaces/ws_2');
  });

  it('deletes a Workspace', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));

    await deleteWorkspace('ws_2');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/workspaces/ws_2');
  });

  it('switches the active Workspace', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));

    await switchWorkspace('ws_2');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const sent = JSON.parse(String(init?.body)) as { workspace_id: string };
    expect(sent.workspace_id).toBe('ws_2');
  });

  it('lists the active Workspace team', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        team: [
          {
            id: 'wm_1',
            email: 'friend@example.com',
            role: 'admin',
            status: 'pending',
            invited_at: '2026-08-01T00:00:00Z',
          },
        ],
      }),
    );

    const team = await listTeam();
    expect(team[0]?.status).toBe('pending');
  });

  it('invites a team member with an email and a role', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, {
        member: {
          id: 'wm_2',
          email: 'new@example.com',
          role: 'viewer',
          status: 'pending',
          invited_at: '2026-08-01T00:00:00Z',
        },
      }),
    );

    const member = await inviteTeamMember('new@example.com', 'viewer');

    expect(member.id).toBe('wm_2');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const sent = JSON.parse(String(init?.body)) as { email: string; role: string };
    expect(sent.email).toBe('new@example.com');
    expect(sent.role).toBe('viewer');
  });

  it('changes a member role', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        member: {
          id: 'wm_2',
          email: 'new@example.com',
          role: 'admin',
          status: 'active',
          invited_at: '2026-08-01T00:00:00Z',
        },
      }),
    );

    const member = await updateTeamMemberRole('wm_2', 'admin');

    expect(member.role).toBe('admin');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('PATCH');
  });

  it('removes a team member', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));

    await removeTeamMember('wm_2');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/team/wm_2');
  });

  it('reads what an invitation offers without a session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { workspace_name: 'Client X', role: 'member' }),
    );

    const invitation = await getInvitation('tok_abc');
    expect(invitation.workspace_name).toBe('Client X');
  });

  it('accepts an invitation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        member: {
          id: 'wm_3',
          email: 'me@example.com',
          role: 'member',
          status: 'active',
          invited_at: '2026-08-01T00:00:00Z',
          accepted_at: '2026-08-02T00:00:00Z',
        },
      }),
    );

    const member = await acceptInvitation('tok_abc');

    expect(member.status).toBe('active');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/invitations/tok_abc/accept');
  });
});
