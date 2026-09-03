import { apiRequest, unwrap } from './http';

/*
 * Workspaces. An Operator's own account can hold many independently named
 * Workspaces, each a self contained scope with its own Nodes, Projects,
 * Services, and team: a Personal one every Operator always has, plus as many
 * more as they create, each with a team invited into it individually. Field
 * names mirror the backend contract exactly so the wire shape and the type
 * never drift.
 */

/** A role a member holds inside a Workspace. Owner is never invited: it is
 * whoever created the Workspace, reported for completeness. */
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

/** One Workspace an Operator can act in: one they created, or one they are
 * an active member of. */
export interface Workspace {
  id: string;
  name: string;
  is_personal: boolean;
  role: WorkspaceRole;
  active: boolean;
}

/** One active member or pending invitation of the active Workspace. */
export interface Member {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: 'pending' | 'active';
  invited_at: string;
  accepted_at?: string;
}

/** What an invitation link offers, read before anyone has signed in. */
export interface Invitation {
  workspace_name: string;
  role: WorkspaceRole;
}

/** One invitation still waiting for the signed in Operator's own email to
 * accept, discoverable without the emailed link. */
export interface PendingInvitation {
  token: string;
  workspace_name: string;
  role: WorkspaceRole;
  invited_at: string;
}

/** Every Workspace the signed in Operator can act in: every one they created,
 * plus every one they hold an active membership in. */
export function listWorkspaces(signal?: AbortSignal): Promise<Workspace[]> {
  return apiRequest<unknown>('/workspaces', { signal }).then((r) =>
    unwrap<Workspace[]>(r, 'workspaces'),
  );
}

/** Create a new, empty Workspace: no Node or Project until one is added. The
 * creator becomes its Owner. It does not become active until switched into. */
export function createWorkspace(name: string): Promise<Workspace> {
  return apiRequest<unknown>('/workspaces', { method: 'POST', body: { name } }).then((r) =>
    unwrap<Workspace>(r, 'workspace'),
  );
}

/** Rename a Workspace. Admin or Owner only. */
export function renameWorkspace(id: string, name: string): Promise<Workspace> {
  return apiRequest<unknown>(`/workspaces/${id}`, { method: 'PATCH', body: { name } }).then((r) =>
    unwrap<Workspace>(r, 'workspace'),
  );
}

/** Delete a Workspace. Refused for the Personal workspace every Operator
 * always has, and refused while it still owns a Node or a Project. Owner only. */
export function deleteWorkspace(id: string): Promise<void> {
  return apiRequest<void>(`/workspaces/${id}`, { method: 'DELETE' });
}

/** Switch the active Workspace to one the Operator created or is an active
 * member of. */
export function switchWorkspace(workspaceId: string): Promise<void> {
  return apiRequest<void>('/workspaces/switch', {
    method: 'POST',
    body: { workspace_id: workspaceId },
  });
}

/** The active Workspace's members and pending invitations. */
export function listTeam(signal?: AbortSignal): Promise<Member[]> {
  return apiRequest<unknown>('/team', { signal }).then((r) => unwrap<Member[]>(r, 'team'));
}

/** Invite an email into the active Workspace at a role. Admin or Owner only. */
export function inviteTeamMember(email: string, role: WorkspaceRole): Promise<Member> {
  return apiRequest<unknown>('/team/invite', { method: 'POST', body: { email, role } }).then((r) =>
    unwrap<Member>(r, 'member'),
  );
}

/** Change an accepted member's role. Admin or Owner only. */
export function updateTeamMemberRole(id: string, role: WorkspaceRole): Promise<Member> {
  return apiRequest<unknown>(`/team/${id}`, { method: 'PATCH', body: { role } }).then((r) =>
    unwrap<Member>(r, 'member'),
  );
}

/** Remove an active member or withdraw a pending invitation. Admin or Owner
 * only. */
export function removeTeamMember(id: string): Promise<void> {
  return apiRequest<void>(`/team/${id}`, { method: 'DELETE' });
}

/** Read what an invitation offers. Public: needs no session, only the token. */
export function getInvitation(token: string, signal?: AbortSignal): Promise<Invitation> {
  return apiRequest<Invitation>(`/invitations/${token}`, { signal });
}

/** Accept an invitation into the signed in Operator's account. Refused with
 * email_mismatch when the account's email is not the one invited. */
export function acceptInvitation(token: string): Promise<Member> {
  return apiRequest<unknown>(`/invitations/${token}/accept`, { method: 'POST' }).then((r) =>
    unwrap<Member>(r, 'member'),
  );
}

/** Decline an invitation on your own initiative. Refused with email_mismatch
 * when the account's email is not the one invited. */
export function declineInvitation(token: string): Promise<void> {
  return apiRequest<void>(`/invitations/${token}/decline`, { method: 'POST' });
}

/** Every invitation still waiting for the signed in Operator's own email to
 * accept, across every Workspace: what surfaces one without the emailed link. */
export function listMyInvitations(signal?: AbortSignal): Promise<PendingInvitation[]> {
  return apiRequest<unknown>('/invitations', { signal }).then((r) =>
    unwrap<PendingInvitation[]>(r, 'invitations'),
  );
}
