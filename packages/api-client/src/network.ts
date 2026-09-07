import { apiRequest } from './http';

/**
 * The Workspace private network: one logical network per Workspace, connecting
 * the Nodes that belong to it.
 *
 * It exists so that a Service on one Node can reach a database on another
 * without an Operator working out addresses, ports, and firewall rules for every
 * pair. Same Workspace means private connectivity; anything outside stays an
 * explicit decision.
 */

/** Where a Node stands on its Workspace's network. */
export type NetworkMemberState = 'pending' | 'joined' | 'failed' | 'disabled' | 'removed';

/**
 * One Node's membership.
 *
 * `reachable` is the platform's own answer to "can traffic actually flow to this
 * Node", and is not the same as having an address: a Node enrolled but not yet
 * configured has one and cannot answer on it.
 */
export interface NetworkMember {
  node_id: string;
  network_address: string;
  public_key?: string;
  endpoint?: string;
  state: NetworkMemberState;
  reachable: boolean;
  last_error?: string;
  last_verified_at?: string;
}

/**
 * A Workspace's private network. A Workspace that has never enabled one reads as
 * disabled with no members rather than as an error, since never having enabled it
 * is the ordinary case.
 */
export interface WorkspaceNetwork {
  enabled: boolean;
  address_space: string;
  backend: string;
  listen_port: number;
  members: NetworkMember[];
}

/** Read the Workspace's private network and its members. Any role may do this. */
export function getWorkspaceNetwork(): Promise<WorkspaceNetwork> {
  return apiRequest<WorkspaceNetwork>('/network');
}

/**
 * Turn the Workspace's private network on, creating it if this is the first
 * time. This reserves the address space and records the intent; it does not join
 * any Node on its own. Owner or Admin only.
 */
export function enableWorkspaceNetwork(): Promise<WorkspaceNetwork> {
  return apiRequest<WorkspaceNetwork>('/network/enable', { method: 'POST' });
}

/**
 * Turn it off without discarding membership. The addresses stay allocated, so
 * turning it back on restores the same topology rather than renumbering every
 * Node. Anything currently reaching another Node privately stops working.
 */
export function disableWorkspaceNetwork(): Promise<void> {
  return apiRequest<void>('/network/disable', { method: 'POST' }).then(() => undefined);
}

/**
 * Put a Node on the network. Answers before the Node is on it: the membership is
 * recorded and the work queued, and the Node is not reachable until the Operation
 * has configured and verified it.
 *
 * Safe to call repeatedly. Enrolment is idempotent and the configuration is
 * written from current membership, so a second call converges.
 */
export function joinWorkspaceNetwork(nodeId: string): Promise<NetworkMember> {
  return apiRequest<NetworkMember>('/network/join', {
    method: 'POST',
    body: { node_id: nodeId },
  });
}

/**
 * Repair the network: rewrite every joined Node's peers so each matches current
 * membership. This is the fix for drift, such as a Node restored from a snapshot.
 */
export function reconcileWorkspaceNetwork(): Promise<void> {
  return apiRequest<void>('/network/reconcile', { method: 'POST' }).then(() => undefined);
}
