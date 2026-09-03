import { apiRequest } from './http';

/*
 * The SSH key library: a name and fingerprint an Operator can recognize
 * standing in for key material they would otherwise paste again at every Node
 * registration and rotation. The key itself is sealed the moment it arrives
 * and is never returned by any of these routes.
 */

/** One saved key. The key material is never included. */
export interface SSHKey {
  id: string;
  name: string;
  fingerprint: string;
  created_at: string;
  last_used_at?: string;
}

export interface ImportSSHKeyInput {
  name: string;
  private_key: string;
}

/** List every key in the Operator's library. */
export function listSSHKeys(signal?: AbortSignal): Promise<SSHKey[]> {
  return apiRequest<{ ssh_keys: SSHKey[] }>('/ssh-keys', { signal }).then((r) => r.ssh_keys);
}

/** Import a private key under a name. The material is never echoed back. */
export function importSSHKey(input: ImportSSHKeyInput): Promise<SSHKey> {
  return apiRequest<{ ssh_key: SSHKey }>('/ssh-keys', { method: 'POST', body: input }).then(
    (r) => r.ssh_key,
  );
}

/** Rename a saved key. */
export function renameSSHKey(id: string, name: string): Promise<SSHKey> {
  return apiRequest<{ ssh_key: SSHKey }>(`/ssh-keys/${id}`, {
    method: 'PATCH',
    body: { name },
  }).then((r) => r.ssh_key);
}

/**
 * Remove a saved key's name from the library. Every Node that recorded this
 * key keeps connecting exactly as before: only the name is gone.
 */
export function deleteSSHKey(id: string): Promise<void> {
  return apiRequest<void>(`/ssh-keys/${id}`, { method: 'DELETE' });
}

/** How many Nodes currently record this key as the one they use. */
export function sshKeyUsage(id: string, signal?: AbortSignal): Promise<number> {
  return apiRequest<{ nodes: number }>(`/ssh-keys/${id}/usage`, { signal }).then((r) => r.nodes);
}
