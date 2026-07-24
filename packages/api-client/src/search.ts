import { apiRequest } from './http';
import type { OperationStatus } from './types';

/*
 * Workspace-wide search. One query runs across the Operator's Nodes, Projects,
 * and Operations, plus the global Capability catalog, and the response groups
 * the matches by kind so the command palette can render each group on its own.
 */

/** A Node match: enough to label it and open it. */
export interface SearchNode {
  id: string;
  name: string;
  hostname: string;
}

/** A Project match. */
export interface SearchProject {
  id: string;
  name: string;
}

/** A Capability match from the global catalog. */
export interface SearchCapability {
  key: string;
  name: string;
  category: string;
}

/** An Operation match, with enough to open its record. */
export interface SearchOperation {
  id: string;
  capability_key: string;
  status: OperationStatus;
  node_id: string;
}

/** The grouped result set, one array per kind. Any group may be empty. */
export interface SearchResults {
  nodes: SearchNode[];
  projects: SearchProject[];
  capabilities: SearchCapability[];
  operations: SearchOperation[];
}

/**
 * Search across the Operator's resources and the Capability catalog. The result
 * is always fully shaped: a missing group comes back as an empty array so
 * callers never branch on undefined.
 */
export function search(q: string, signal?: AbortSignal): Promise<SearchResults> {
  return apiRequest<Partial<SearchResults>>('/search', { query: { q }, signal }).then((r) => ({
    nodes: r.nodes ?? [],
    projects: r.projects ?? [],
    capabilities: r.capabilities ?? [],
    operations: r.operations ?? [],
  }));
}
