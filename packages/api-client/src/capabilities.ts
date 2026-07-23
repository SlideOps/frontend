import { apiRequest } from './http';
import type { Capability } from './types';

/** The Capability catalog. Capabilities are searchable by outcome, not technology. */

/** List Capabilities, optionally filtered by an outcome query. */
export function listCapabilities(q?: string, signal?: AbortSignal): Promise<Capability[]> {
  return apiRequest<{ capabilities: Capability[] }>('/capabilities', { query: { q }, signal }).then(
    (r) => r.capabilities,
  );
}

/** Read one Capability by its key. */
export function getCapability(key: string, signal?: AbortSignal): Promise<Capability> {
  return apiRequest<{ capability: Capability }>(`/capabilities/${key}`, { signal }).then(
    (r) => r.capability,
  );
}
