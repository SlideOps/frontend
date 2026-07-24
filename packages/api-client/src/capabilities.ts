import { apiRequest } from './http';
import type { Capability } from './types';

/** The Capability catalog. Capabilities are searchable by outcome, not technology. */

/** The context for a Capability listing: an optional Project and outcome query. */
export interface ListCapabilitiesParams {
  /**
   * The Project to list Capabilities for. With a Project the catalog is Core plus
   * that Project's installed Plugin Capabilities; without one it is Core only.
   */
  projectId?: string;
  /** Filter by a plain-language outcome query. */
  q?: string;
}

/**
 * List Capabilities. With no Project id the backend returns the Core security
 * Capabilities only; passing a Project id adds that Project's installed Plugin
 * Capabilities, each tagged with its plugin id.
 */
export function listCapabilities(
  params: ListCapabilitiesParams = {},
  signal?: AbortSignal,
): Promise<Capability[]> {
  return apiRequest<{ capabilities: Capability[] }>('/capabilities', {
    query: { project_id: params.projectId, q: params.q },
    signal,
  }).then((r) => r.capabilities);
}

/** Read one Capability by its key. */
export function getCapability(key: string, signal?: AbortSignal): Promise<Capability> {
  return apiRequest<{ capability: Capability }>(`/capabilities/${key}`, { signal }).then(
    (r) => r.capability,
  );
}

/** One row of the capability matrix: which platforms a Capability supports. */
export interface CapabilityMatrixRow {
  key: string;
  name: string;
  /** Platform id to whether the Capability supports it, for example { debian: true }. */
  support: Record<string, boolean>;
}

/**
 * The generated capability matrix: the platform columns and one row per
 * Capability. It is produced from the Provider registry, so it stays correct as
 * Providers change and is never hand-maintained.
 */
export interface CapabilityMatrix {
  platforms: string[];
  capabilities: CapabilityMatrixRow[];
}

/** Read the generated capability matrix of Capabilities by platform. */
export function getMatrix(signal?: AbortSignal): Promise<CapabilityMatrix> {
  return apiRequest<Partial<CapabilityMatrix>>('/capabilities/matrix', { signal }).then((r) => ({
    platforms: r.platforms ?? [],
    capabilities: r.capabilities ?? [],
  }));
}
