import { apiRequest } from './http';

/*
 * Node health. The metrics endpoint connects read only over SSH and returns the
 * current readings plus a recent history parsed from the monitoring log when the
 * enable-monitoring Capability has been run. It never mutates the Node. The
 * Operator session scopes it to the caller's own Nodes.
 */

/** A single snapshot of a Node's health. Fields stay optional so a partial reading still renders. */
export interface NodeMetricSample {
  /** Timestamp for a history point. Absent on the current reading. */
  at?: string;
  /** System load, typically the one-minute average. */
  cpu_load?: number;
  /** Memory in use, as a percentage from 0 to 100. */
  memory_used_percent?: number;
  /** Root disk in use, as a percentage from 0 to 100. */
  disk_used_percent?: number;
  /** Uptime in seconds. */
  uptime_seconds?: number;
  /** A human-readable uptime, when the backend provides one. */
  uptime?: string;
  /** The count of running services. */
  service_count?: number;
}

/** The result of GET /nodes/{id}/metrics. */
export interface NodeMetrics {
  current: NodeMetricSample;
  history: NodeMetricSample[];
  monitoring_enabled: boolean;
}

/** Read the current health of a Node, plus a recent history when monitoring is enabled. */
export function getNodeMetrics(nodeId: string, signal?: AbortSignal): Promise<NodeMetrics> {
  return apiRequest<{ metrics?: NodeMetrics } & Partial<NodeMetrics>>(`/nodes/${nodeId}/metrics`, {
    signal,
  }).then((r) => r.metrics ?? (r as NodeMetrics));
}
