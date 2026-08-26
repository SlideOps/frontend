import { apiRequest, unwrap } from './http';

/*
 * Team collaboration. An Operator's own account is always a Workspace of one;
 * accepting an invitation adds another Workspace to switch into, acting there
 * with the role the invitation named. Field names mirror the backend contract
 * exactly so the wire shape and the type never drift.
 */

/** A role a member holds inside a Workspace. Owner is never invited, it is
 * the Workspace's own account and is reported for completeness only. */
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

/** One Workspace an Operator can act in: their own, or one they are an
 * active member of. */
export interface Workspace {
  owner_operator_id: string;
  owner_email: string;
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
  workspace_email: string;
  role: WorkspaceRole;
}

/** Every Workspace the signed in Operator can act in. */
export function listWorkspaces(signal?: AbortSignal): Promise<Workspace[]> {
  return apiRequest<unknown>('/workspaces', { signal }).then((r) =>
    unwrap<Workspace[]>(r, 'workspaces'),
  );
}

/** Switch the active Workspace. Pass the Operator's own id, or an empty
 * string, to switch back to their own Workspace. */
export function switchWorkspace(ownerOperatorId: string): Promise<void> {
  return apiRequest<void>('/workspaces/switch', {
    method: 'POST',
    body: { owner_operator_id: ownerOperatorId },
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
