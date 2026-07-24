import { apiRequest } from './http';
import type { Node, Project } from './types';

/** The Projects surface. Projects group related Nodes and carry no secrets. */

/** List the Operator's Projects. */
export function listProjects(signal?: AbortSignal): Promise<Project[]> {
  return apiRequest<{ projects: Project[] }>('/projects', { signal }).then((r) => r.projects);
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

/** Create a Project. */
export function createProject(input: CreateProjectInput): Promise<Project> {
  return apiRequest<{ project: Project }>('/projects', { method: 'POST', body: input }).then(
    (r) => r.project,
  );
}

/** Read one Project. */
export function getProject(id: string, signal?: AbortSignal): Promise<Project> {
  return apiRequest<{ project: Project }>(`/projects/${id}`, { signal }).then((r) => r.project);
}

/** Remove a Project. */
export function removeProject(id: string): Promise<void> {
  return apiRequest<void>(`/projects/${id}`, { method: 'DELETE' });
}

/** List the servers assigned to a Project, unwrapping the nodes array. */
export function listProjectNodes(projectId: string, signal?: AbortSignal): Promise<Node[]> {
  return apiRequest<{ nodes: Node[] }>(`/projects/${projectId}/nodes`, { signal }).then(
    (r) => r.nodes,
  );
}

/**
 * Assign a server the Operator owns to a Project. The server is connected and
 * secured at the server level first, then assigned here; the updated Node is
 * returned carrying its new project_id.
 */
export function assignNodeToProject(projectId: string, nodeId: string): Promise<Node> {
  return apiRequest<{ node: Node }>(`/projects/${projectId}/nodes/${nodeId}`, {
    method: 'POST',
  }).then((r) => r.node);
}

/**
 * Unassign a server from a Project, returning it to the server level. The updated
 * Node is returned with its project_id cleared.
 */
export function unassignNodeFromProject(projectId: string, nodeId: string): Promise<Node> {
  return apiRequest<{ node: Node }>(`/projects/${projectId}/nodes/${nodeId}`, {
    method: 'DELETE',
  }).then((r) => r.node);
}
