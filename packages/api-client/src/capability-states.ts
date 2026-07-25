import { apiRequest } from './http';

/** The completion of a Capability on a Node, read to steer away from repeats. */

/**
 * The completion record for one Capability on a Node. A record exists only when
 * the Capability has at least one completed Operation there, so its presence in
 * the map is the signal that the outcome is already in place. `status` is the
 * completion state, currently always the string `"done"`.
 */
export interface CapabilityState {
  status: string;
  /** The id of the last completed Operation that delivered this Capability. */
  last_operation_id: string;
  /** When that Operation completed, as an RFC 3339 timestamp. */
  last_completed_at: string;
}

/**
 * Read which Capabilities have already been carried out on a Node, keyed by
 * Capability key, so a screen can mark the done ones and keep an Operator from
 * running one again by mistake. A key is present only when its Capability has a
 * completed Operation on the Node; an absent key means the Capability is still
 * available and renders exactly as it does untouched. With a Project id the map
 * also carries that Project's Plugin Capability completions alongside the Node's
 * server level Core Capabilities; without one it is the Core Capabilities only.
 * The session cookie authorizes it, like every other secured call.
 */
export function getCapabilityStates(
  nodeId: string,
  projectId?: string,
  signal?: AbortSignal,
): Promise<Record<string, CapabilityState>> {
  return apiRequest<{ states: Record<string, CapabilityState> }>(
    `/nodes/${encodeURIComponent(nodeId)}/capability-states`,
    { query: { project_id: projectId }, signal },
  ).then((r) => r.states ?? {});
}
