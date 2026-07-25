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
