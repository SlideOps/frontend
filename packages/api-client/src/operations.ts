import { apiRequest } from './http';
import type { Operation, OperationStatus } from './types';

/** The Operations surface. An Operation is one run of a Capability on a Node. */

export interface CreateOperationInput {
  node_id: string;
  capability_key: string;
  /**
   * The Project this Operation runs in. A Plugin Capability requires it; a Core
   * Capability needs none, so it is omitted for Core.
   */
  project_id?: string;
  /** The values for the Capability's parameters, keyed by parameter key. */
  parameters?: Record<string, unknown>;
}

/**
 * Create an Operation. The server runs discover, assess, and plan so the
 * Operation returns already at awaiting_approval with a Plan attached.
 */
export function createOperation(input: CreateOperationInput): Promise<Operation> {
  return apiRequest<{ operation: Operation }>('/operations', { method: 'POST', body: input }).then(
    (r) => r.operation,
  );
}

export interface OperationFilter {
  node_id?: string;
  status?: OperationStatus;
}

/** List the Operator's Operations, newest first. This is History. */
export function listOperations(
  filter: OperationFilter = {},
  signal?: AbortSignal,
): Promise<Operation[]> {
  return apiRequest<{ operations: Operation[] }>('/operations', {
    query: { node_id: filter.node_id, status: filter.status },
    signal,
  }).then((r) => r.operations);
}

/** Read the full Operation record, including its plan, events, and verification. */
export function getOperation(id: string, signal?: AbortSignal): Promise<Operation> {
  return apiRequest<{ operation: Operation }>(`/operations/${id}`, { signal }).then(
    (r) => r.operation,
  );
}

/** Approve an Operation, which enqueues it for execution. */
export function approveOperation(id: string): Promise<void> {
  return apiRequest<void>(`/operations/${id}/approve`, { method: 'POST' });
}

/** Cancel an Operation. Cancellation is cooperative and checked between steps. */
export function cancelOperation(id: string): Promise<void> {
  return apiRequest<void>(`/operations/${id}/cancel`, { method: 'POST' });
}

/** One revealed secret parameter: its key and its plaintext value. */
export interface RevealedSecret {
  parameter: string;
  value: string;
}

/**
 * Reveal the plaintext of one secret parameter for the Operation's owner. A
 * parameter is secret exactly when its value in `operation.parameters` is the
 * literal `"[stored securely]"`; the plaintext lives only behind this call and
 * never in the Operation record. The session cookie authorizes it, like every
 * secured call. Fails with a not_found or secret_not_found ApiError.
 */
export function revealOperationSecret(
  operationId: string,
  paramKey: string,
  signal?: AbortSignal,
): Promise<RevealedSecret> {
  return apiRequest<RevealedSecret>(
    `/operations/${encodeURIComponent(operationId)}/secrets/${encodeURIComponent(paramKey)}/reveal`,
    { method: 'POST', signal },
  );
}

/**
 * Delete one finished Operation from your History, so a failed experiment or a
 * cancelled run does not clutter the record you rely on.
 *
 * Only a finished Operation may go. One still planning, awaiting approval, or
 * executing is refused with `409 operation_running`: cancel it first.
 *
 * This removes SlideOps' record of the run. It does **not** undo whatever the
 * Operation already did to your server: deleting the receipt does not undo the
 * purchase. The deletion itself is written to the audit trail.
 */
export function deleteOperation(id: string): Promise<void> {
  return apiRequest<void>(`/operations/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * Clear every finished Operation at the given statuses in one go, and get back
 * how many went.
 *
 * With no statuses the whole finished History is cleared, so pass them
 * deliberately. Work that has not finished is always left alone, whatever you
 * ask for, so a bulk clear can never sweep up something mid-flight.
 */
export function clearOperations(statuses: OperationStatus[] = []): Promise<number> {
  const query = statuses.map((status) => `status=${encodeURIComponent(status)}`).join('&');
  return apiRequest<{ deleted: number }>(`/operations${query ? `?${query}` : ''}`, {
    method: 'DELETE',
  }).then((r) => r.deleted ?? 0);
}
