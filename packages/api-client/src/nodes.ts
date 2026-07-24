import { apiRequest } from './http';
import type { DiscoveryResult, Node, NodeAuthKind } from './types';

/** The Nodes surface. A Node is one Linux machine reached over SSH. */

/** The credential for a new Node. The plaintext is sent once and stored encrypted. */
export interface NodeAuth {
  kind: NodeAuthKind;
  /** The password or the private key. Stored encrypted, never returned again. */
  secret: string;
}

export interface CreateNodeInput {
  name: string;
  hostname: string;
  address: string;
  port: number;
  ssh_username: string;
  project_id?: string;
  auth: NodeAuth;
}

/**
 * One account on the server, as read by GET /nodes/{id}/users. `access_level`
 * separates a full administrator from a limited account; `system` marks the
 * built-in accounts the platform never touches; `connection` marks the account
 * SlideOps itself signs in as, which is protected from removal.
 */
export interface ServerUser {
  username: string;
  access_level: 'admin' | 'limited';
  system: boolean;
  connection: boolean;
}

/**
 * A new connection credential to apply to a Node. The optional username lets an
 * Operator move the connection to a different account at the same time as the
 * secret. The backend verifies the credential can sign in before it switches, so
 * a bad credential changes nothing and returns credential_verification_failed.
 */
export interface RotateCredentialInput {
  username?: string;
  auth_kind: NodeAuthKind;
  secret: string;
}

/** List the Operator's Nodes. */
export function listNodes(signal?: AbortSignal): Promise<Node[]> {
  return apiRequest<{ nodes: Node[] }>('/nodes', { signal }).then((r) => r.nodes);
}

/** Register a Node. The response never includes the credential. */
export function createNode(input: CreateNodeInput): Promise<Node> {
  return apiRequest<{ node: Node }>('/nodes', { method: 'POST', body: input }).then((r) => r.node);
}

/** Read one Node. */
export function getNode(id: string, signal?: AbortSignal): Promise<Node> {
  return apiRequest<{ node: Node }>(`/nodes/${id}`, { signal }).then((r) => r.node);
}

/** Remove a Node. */
export function removeNode(id: string): Promise<void> {
  return apiRequest<void>(`/nodes/${id}`, { method: 'DELETE' });
}

/**
 * Discover a Node. This connects read-only and gathers Facts, then returns them
 * with a plain-language Assessment. Discovery never changes the Node.
 */
export function discoverNode(id: string, signal?: AbortSignal): Promise<DiscoveryResult> {
  return apiRequest<DiscoveryResult>(`/nodes/${id}/discover`, { method: 'POST', signal });
}

/**
 * Rotate the stored connection credential for a Node, optionally moving it to a
 * different account. The backend verifies the new credential can sign in before
 * it switches, so on failure nothing changes and it returns a 400 with the code
 * credential_verification_failed. The updated Node is returned on success.
 */
export function rotateNodeCredential(id: string, input: RotateCredentialInput): Promise<Node> {
  return apiRequest<{ node: Node }>(`/nodes/${id}/credential`, {
    method: 'POST',
    body: input,
  }).then((r) => r.node);
}

/** List the accounts on the server behind a Node. Read only. */
export function listNodeUsers(id: string, signal?: AbortSignal): Promise<ServerUser[]> {
  return apiRequest<{ users: ServerUser[] }>(`/nodes/${id}/users`, { signal }).then((r) => r.users);
}
