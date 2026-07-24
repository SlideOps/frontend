import { apiRequest } from './http';
import type { TierName } from './tier';
import type { OperationStatus, OperatorRole } from './types';

/*
 * The Admin control-plane surface. Every path sits under /api/v1/admin and rides
 * the single Operator session cookie, which the shared request helper already
 * sends. The backend requires the admin role for these routes and returns 403
 * for a plain Operator. It reads across every tenant for oversight only, and
 * audits every
 * mutation. Single resources come wrapped in a named envelope and lists in a
 * named array, matching the rest of the client; each function unwraps tolerantly
 * so a bare value is accepted when the envelope key is absent.
 */

/** The platform headline shown on the Admin overview. */
export interface Overview {
  operators_total: number;
  nodes_total: number;
  operations_total: number;
  operations_by_status: Record<string, number>;
  active_operations: number;
  failures_last_24h: number;
  executions_paused: boolean;
  operators_suspended: number;
}

/** The lifecycle state of an Operator account on the platform. */
export type OperatorStatus = 'active' | 'suspended';

/** One Operator row in the cross-tenant Operators table. */
export interface AdminOperator {
  id: string;
  email: string;
  role: OperatorRole;
  created_at: string;
  status: OperatorStatus;
  /** The tier this Operator sits on, when the backend includes it. */
  tier?: TierName;
  node_count: number;
  operation_count: number;
  last_active: string | null;
}

/** One cross-tenant Operation, enriched with the Operator email where cheap. */
export interface AdminOperation {
  id: string;
  operator_id: string;
  operator_email: string;
  node_id: string;
  /** The Node name, included by the list view when the backend enriches it. */
  node_name?: string;
  capability_key: string;
  /** The Capability name, included by the list view when the backend enriches it. */
  capability_name?: string;
  status: OperationStatus;
  created_at: string;
}

/** An Operator detail, the row plus their most recent Operations. */
export interface AdminOperatorDetail extends AdminOperator {
  recent_operations: AdminOperation[];
}

/** One point on the operations-over-time series. */
export interface OperationsOverTimePoint {
  date: string;
  count: number;
}

/** One bar in the capability-usage breakdown. */
export interface CapabilityUsage {
  capability_key: string;
  count: number;
}

/** The aggregates that back the Admin analytics charts. */
export interface Analytics {
  operations_over_time: OperationsOverTimePoint[];
  success_rate: number;
  capability_usage: CapabilityUsage[];
  operations_by_status: Record<string, number>;
}

/** One entry in the immutable audit trail. */
export interface AuditEntry {
  id: string;
  actor_type: string;
  actor_id: string;
  action: string;
  target: string;
  metadata: Record<string, unknown>;
  ip: string;
  created_at: string;
}

/** The current state of the platform-wide execution pause. */
export interface EmergencyStatus {
  executions_paused: boolean;
}

/** Read the platform headline. */
export function getOverview(signal?: AbortSignal): Promise<Overview> {
  return apiRequest<{ overview?: Overview } & Partial<Overview>>('/admin/overview', { signal }).then(
    (r) => r.overview ?? (r as Overview),
  );
}

/** List every Operator on the platform, for oversight. */
export function listOperators(signal?: AbortSignal): Promise<AdminOperator[]> {
  return apiRequest<{ operators?: AdminOperator[] } | AdminOperator[]>('/admin/operators', {
    signal,
  }).then((r) => (Array.isArray(r) ? r : (r.operators ?? [])));
}

/** Read one Operator, with their recent Operations. */
export function getOperator(id: string, signal?: AbortSignal): Promise<AdminOperatorDetail> {
  return apiRequest<{ operator?: AdminOperatorDetail } & Partial<AdminOperatorDetail>>(
    `/admin/operators/${id}`,
    { signal },
  ).then((r) => r.operator ?? (r as AdminOperatorDetail));
}

/** Suspend an Operator. Audited. A suspended Operator cannot approve or execute. */
export function suspendOperator(id: string): Promise<void> {
  return apiRequest<void>(`/admin/operators/${id}/suspend`, { method: 'POST' });
}

/** Lift a suspension and restore an Operator to normal. Audited. */
export function unsuspendOperator(id: string): Promise<void> {
  return apiRequest<void>(`/admin/operators/${id}/unsuspend`, { method: 'POST' });
}

/** Grant or revoke the admin role on an Operator. Admin only, audited. */
export function setOperatorRole(id: string, role: OperatorRole): Promise<void> {
  return apiRequest<void>(`/admin/operators/${id}/role`, { method: 'POST', body: { role } });
}

export interface AdminOperationFilter {
  status?: OperationStatus;
  operator_id?: string;
}

/** List cross-tenant Operations, newest first, filterable by status and Operator. */
export function listAdminOperations(
  filter: AdminOperationFilter = {},
  signal?: AbortSignal,
): Promise<AdminOperation[]> {
  return apiRequest<{ operations?: AdminOperation[] } | AdminOperation[]>('/admin/operations', {
    query: { status: filter.status, operator_id: filter.operator_id },
    signal,
  }).then((r) => (Array.isArray(r) ? r : (r.operations ?? [])));
}

/** Read the analytics aggregates that back the charts. */
export function getAnalytics(signal?: AbortSignal): Promise<Analytics> {
  return apiRequest<{ analytics?: Analytics } & Partial<Analytics>>('/admin/analytics', {
    signal,
  }).then((r) => r.analytics ?? (r as Analytics));
}

export interface AuditFilter {
  limit?: number;
  offset?: number;
}

/** Read a page of the audit trail, newest first. */
export function listAudit(filter: AuditFilter = {}, signal?: AbortSignal): Promise<AuditEntry[]> {
  return apiRequest<{ entries?: AuditEntry[]; audit?: AuditEntry[] } | AuditEntry[]>('/admin/audit', {
    query: { limit: filter.limit, offset: filter.offset },
    signal,
  }).then((r) => (Array.isArray(r) ? r : (r.entries ?? r.audit ?? [])));
}

/** Pause every execution platform wide. Queued Operations wait, nothing is lost. Audited. */
export function pauseExecutions(): Promise<EmergencyStatus> {
  return apiRequest<{ status?: EmergencyStatus } & Partial<EmergencyStatus>>(
    '/admin/emergency/pause-executions',
    { method: 'POST' },
  ).then((r) => r.status ?? (r as EmergencyStatus));
}

/** Resume executions. Held Operations run again. Audited. */
export function resumeExecutions(): Promise<EmergencyStatus> {
  return apiRequest<{ status?: EmergencyStatus } & Partial<EmergencyStatus>>(
    '/admin/emergency/resume-executions',
    { method: 'POST' },
  ).then((r) => r.status ?? (r as EmergencyStatus));
}

/** Read whether executions are currently paused platform wide. */
export function getEmergencyStatus(signal?: AbortSignal): Promise<EmergencyStatus> {
  return apiRequest<{ status?: EmergencyStatus } & Partial<EmergencyStatus>>(
    '/admin/emergency/status',
    { signal },
  ).then((r) => r.status ?? (r as EmergencyStatus));
}
