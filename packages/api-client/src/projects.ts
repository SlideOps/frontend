import { apiRequest } from './http';
import type { Project } from './types';

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
