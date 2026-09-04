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
   * The version the completing Operation actually ran with, when it recorded
   * one. Absent for a Capability with no version selection, and for one
   * installed before version selection existed: an Operation from before this
   * feature never stored a version, and none is invented for it here.
   */
  version?: string;
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

/**
 * The versions a Node's own currently configured package sources actually
 * offer for a Capability, read live. `supported` is false for a Capability
 * with no version discovery at all, in which case a version selector should
 * not be shown; true with an empty `versions` means this Node's sources
 * genuinely offer none right now, which is itself worth showing rather than
 * a selector with nothing real in it.
 */
export interface AvailableVersions {
  supported: boolean;
  versions: string[];
  latest?: string;
}

/**
 * Read the real versions a Node can actually install for a Capability right
 * now, live from the Node's own package sources, never a hardcoded or
 * assumed list. The session cookie authorizes it, like every other secured
 * call.
 */
export function getAvailableVersions(
  nodeId: string,
  capabilityKey: string,
  signal?: AbortSignal,
): Promise<AvailableVersions> {
  return apiRequest<{ available_versions: AvailableVersions }>(
    `/nodes/${encodeURIComponent(nodeId)}/capabilities/${encodeURIComponent(capabilityKey)}/versions`,
    { signal },
  ).then((r) => r.available_versions ?? { supported: false, versions: [] });
}

/** How to control an installed Capability's own service. */
export type CapabilityControlAction = 'start' | 'stop' | 'restart';

/**
 * Start, stop, or restart an already-installed Capability's own service,
 * live over SSH. Not a planned and approved Operation: nothing about the
 * Node's desired state changes, only whether it is currently running, the
 * same reasoning a Service's own Start/Stop/Restart already stays outside
 * the Operations engine for. Only the database Capabilities with a known
 * service are controllable this way; anything else rejects with a plain
 * error rather than guessing at a service to act on.
 */
export function controlCapability(
  nodeId: string,
  capabilityKey: string,
  action: CapabilityControlAction,
): Promise<void> {
  return apiRequest<void>(
    `/nodes/${encodeURIComponent(nodeId)}/capabilities/${encodeURIComponent(capabilityKey)}/control`,
    { method: 'POST', body: { action } },
  );
}

/*
 * Server readiness: what a secure, usable server has, against what this one
 * already has.
 */

/** How much a missing measure matters. A measure in place carries "none". */
export type ReadinessSeverity = 'critical' | 'high' | 'medium' | 'low' | 'none';

/** What is known about one measure. `detected` counts as much as `done`. */
export type ReadinessState = 'done' | 'detected' | 'missing' | 'unknown';

/** One thing a ready server has, and where this server stands on it. */
export interface ReadinessMeasure {
  capability_key: string;
  title: string;
  /** What its absence exposes you to, in plain terms. */
  why: string;
  category: 'security' | 'ready' | 'resilience';
  essential: boolean;
  state: ReadinessState;
  /**
   * Severity belongs to the gap, not the measure: it is `none` once satisfied,
   * because there is nothing left to act on.
   */
  severity: ReadinessSeverity;
  /** How it was decided, so the claim can be checked rather than believed. */
  evidence?: string;
  /** True while this measure has a real, unmet prerequisite -- the same
   *  Dependencies the backend's own hard gate would refuse a request over.
   *  Always false once satisfied. */
  blocked?: boolean;
  /** The prerequisite Capability keys still missing, when blocked. */
  blocked_by?: string[];
}

export interface Readiness {
  /** False until Discovery has run, in which case nothing can honestly be said. */
  discovered: boolean;
  summary: string;
  essentials_missing: number;
  satisfied: ReadinessMeasure[];
  missing: ReadinessMeasure[];
}

/**
 * Read whether a server is ready and what is missing.
 *
 * Connecting a Node creates an account, hardens SSH and moves the connection.
 * That is the right place to start and not the whole job: this covers the rest,
 * including the things servers are actually lost to.
 */
export function getReadiness(nodeId: string, signal?: AbortSignal): Promise<Readiness> {
  return apiRequest<{ readiness?: Readiness } & Partial<Readiness>>(
    `/nodes/${encodeURIComponent(nodeId)}/readiness`,
    { signal },
  ).then((r) => r.readiness ?? (r as Readiness));
}
