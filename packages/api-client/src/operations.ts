import { apiRequest } from './http';
import type { Operation, OperationStatus } from './types';

/** The Operations surface. An Operation is one run of a Capability on a Node. */

export interface CreateOperationInput {
  node_id: string;
  capability_key: string;
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
