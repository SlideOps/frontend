/*
 * A small typed surface for now. Once the backend publishes its openapi
 * contract, these shapes are replaced by generated types. They use the
 * ubiquitous language: Operator, Workspace, Project, Node, Capability,
 * Operation, Verification.
 */

export type OperationStatus =
  | 'planned'
  | 'awaiting_approval'
  | 'executing'
  | 'verifying'
  | 'verified'
  | 'failed';

export interface Operator {
  id: string;
  email: string;
  displayName: string;
}

export interface Node {
  id: string;
  projectId: string;
  name: string;
  reachable: boolean;
}

export interface Capability {
  id: string;
  /** Outcome-focused name, never a tool name. */
  outcome: string;
  summary: string;
}

export interface Operation {
  id: string;
  capabilityId: string;
  nodeId: string;
  status: OperationStatus;
  startedAt: string;
}

export interface Verification {
  operationId: string;
  passed: boolean;
  evidence: string;
}
