import { apiRequest } from './http';

/** Whether a Capability's outcome is already in place on a Node, and how it got there. */

/**
 * How a Capability's outcome came to be in place. `done` means SlideOps carried
 * it out and History holds the record. `detected` means it was already in place
 * when SlideOps looked, whether from a previous account, another tool, or the
 * Operator's own hands.
 */
export type CapabilityStateStatus = 'done' | 'detected';

/**
 * Where a state came from: an Operation SlideOps ran, or the server as it
 * already was.
 */
export type CapabilityStateSource = 'slideops' | 'existing';

/**
 * The state record for one Capability on a Node. A record exists only when the
 * outcome is already in place, so its presence in the map is the signal not to
 * deliver it again.
 */
export interface CapabilityState {
  status: CapabilityStateStatus;
  source: CapabilityStateSource;
  /** The id of the last completed Operation. Present only for a `done` state. */
  last_operation_id?: string;
  /** When that Operation completed, as an RFC 3339 timestamp. */
  last_completed_at?: string;
  /**
   * Why a `detected` state was reported, in plain language, for example
   * "Docker is already installed on this server and is running".
   */
  evidence?: string;
  /** Whether the detected thing is currently active. Meaningful when detected. */
  running?: boolean;
  /** When the Discovery that saw it ran, as an RFC 3339 timestamp. */
  detected_at?: string;
}

/**
 * Read which Capabilities are already in place on a Node, keyed by Capability
 * key, so a screen can mark them and keep an Operator from delivering the same
 * outcome twice. A key is present when SlideOps carried the Capability out there
 * (`done`) or when its outcome was already on the server when SlideOps looked
 * (`detected`): a server set up before the Operator found SlideOps, or from a
 * different account, reads as already set up rather than as a blank slate. An
 * absent key means the Capability is still available and renders exactly as it
 * does untouched. With a Project id the map also carries that Project's Plugin
 * Capability completions alongside the Node's server level Core Capabilities;
 * without one it is the Core Capabilities only. The session cookie authorizes it,
 * like every other secured call.
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
