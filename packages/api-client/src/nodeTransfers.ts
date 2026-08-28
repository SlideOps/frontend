import { apiRequest, unwrap } from './http';

/*
 * Node Transfer. An Owner or Admin can hand a Node, and everything scoped
 * beneath it (its Project if exclusive, every Service, installed Plugins,
 * history, credential), to a different Operator account entirely, in or out
 * of the sending Workspace. Nothing moves until the receiving Operator
 * accepts. Field names mirror the backend contract exactly.
 */

export type NodeTransferStatus = 'pending' | 'accepted' | 'declined' | 'canceled';

/** One transfer, read from the side that started it. Never carries the
 * token: that lives only in the emailed link and the public routes below. */
export interface NodeTransfer {
  id: string;
  node_id: string;
  to_email: string;
  status: NodeTransferStatus;
  message: string;
  created_at: string;
  decided_at?: string;
}

/** What a transfer link's landing page reads before anyone has signed in. */
export interface NodeTransferPreview {
  node_name: string;
  from_workspace_name: string;
  message: string;
}

/** One transfer still waiting for the signed in Operator's own email to
 * decide, with the node and sending Workspace's names resolved. */
export interface IncomingNodeTransfer {
  token: string;
  node_name: string;
  from_workspace_name: string;
  message: string;
  created_at: string;
}

/** Offer a Node, and everything scoped beneath it, to another Operator
 * account by email. Owner or Admin only. Refused with transfer_already_pending,
 * operation_in_progress, project_shared, or self_transfer. */
export function initiateNodeTransfer(
  nodeId: string,
  toEmail: string,
  message?: string,
): Promise<NodeTransfer> {
  return apiRequest<unknown>(`/nodes/${nodeId}/transfer`, {
    method: 'POST',
    body: { to_email: toEmail, message: message ?? '' },
  }).then((r) => unwrap<NodeTransfer>(r, 'transfer'));
}

/** The Node's outstanding transfer, if any. */
export function getPendingNodeTransfer(
  nodeId: string,
  signal?: AbortSignal,
): Promise<NodeTransfer> {
  return apiRequest<unknown>(`/nodes/${nodeId}/transfer`, { signal }).then((r) =>
    unwrap<NodeTransfer>(r, 'transfer'),
  );
}

/** Withdraw the Node's outstanding transfer. Owner or Admin only. */
export function cancelNodeTransfer(nodeId: string): Promise<void> {
  return apiRequest<void>(`/nodes/${nodeId}/transfer`, { method: 'DELETE' });
}

/** Read what a transfer offers. Public: needs no session, only the token. */
export function getNodeTransferPreview(
  token: string,
  signal?: AbortSignal,
): Promise<NodeTransferPreview> {
  return apiRequest<NodeTransferPreview>(`/node-transfers/${token}`, { signal });
}

/** Accept a transfer into the signed in Operator's account. workspaceId is
 * optional: omitted, it lands in their Personal workspace; given, it must
 * name a workspace they created themselves. Refused with email_mismatch,
 * not_workspace_owner, quota_exceeded, or already_decided. */
export function acceptNodeTransfer(token: string, workspaceId?: string): Promise<NodeTransfer> {
  return apiRequest<unknown>(`/node-transfers/${token}/accept`, {
    method: 'POST',
    body: { workspace_id: workspaceId ?? '' },
  }).then((r) => unwrap<NodeTransfer>(r, 'transfer'));
}

/** Decline a transfer on your own initiative. Refused with email_mismatch
 * when the account's email is not the one the transfer was sent to. */
export function declineNodeTransfer(token: string): Promise<void> {
  return apiRequest<void>(`/node-transfers/${token}/decline`, { method: 'POST' });
}

/** Every transfer still waiting for the signed in Operator's own email to
 * decide, across every Node and Workspace, so one is discoverable without the
 * emailed link. */
export function listIncomingNodeTransfers(signal?: AbortSignal): Promise<IncomingNodeTransfer[]> {
  return apiRequest<unknown>('/node-transfers/incoming', { signal }).then((r) =>
    unwrap<IncomingNodeTransfer[]>(r, 'transfers'),
  );
}
