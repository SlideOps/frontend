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
