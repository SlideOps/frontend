import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assignNodeToProject,
  createProject,
  listProjectNodes,
  listProjects,
  setProjectRouting,
  unassignNodeFromProject,
} from './projects';

/** Build a Response-like stub for the mocked fetch. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('projects requests', () => {
  it('lists Projects over the same origin with cookies included', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { projects: [{ id: 'pr_1', name: 'shop' }] }));

    const projects = await listProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe('shop');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/projects');
  });

  it('creates a Project and surfaces the tier quota error typed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(403, {
        error: { code: 'quota_exceeded', message: 'Your tier allows no more Projects.' },
      }),
    );

    await expect(createProject({ name: 'shop' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'quota_exceeded',
    });
  });

  it('lists the servers assigned to a Project, unwrapping the nodes array', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        nodes: [{ id: 'nd_1', name: 'web-1', project_id: 'pr_1' }],
      }),
    );

    const nodes = await listProjectNodes('pr_1');

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.id).toBe('nd_1');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/projects/pr_1/nodes');
  });

  it('assigns a server to a Project with POST and unwraps the returned Node', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        node: { id: 'nd_1', name: 'web-1', project_id: 'pr_1' },
      }),
    );

    const node = await assignNodeToProject('pr_1', 'nd_1');

    expect(node.project_id).toBe('pr_1');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/projects/pr_1/nodes/nd_1');
  });

  it('unassigns a server from a Project with DELETE and unwraps the returned Node', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        node: { id: 'nd_1', name: 'web-1', project_id: null },
      }),
    );

    const node = await unassignNodeFromProject('pr_1', 'nd_1');

    expect(node.project_id).toBeNull();
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/projects/pr_1/nodes/nd_1');
  });

  it('sets a Project domain with PUT and cookies, and unwraps the returned Project', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        project: { id: 'pr_1', name: 'shop', domain: 'app.example.com' },
      }),
    );

    const project = await setProjectRouting('pr_1', 'app.example.com');

    expect(project.domain).toBe('app.example.com');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('PUT');
    expect(init?.credentials).toBe('include');
    expect(JSON.parse(String(init?.body))).toEqual({ domain: 'app.example.com' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/projects/pr_1/routing');
  });

  it('clears a Project domain by sending an empty string', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { project: { id: 'pr_1', name: 'shop', domain: '' } }),
    );

    const project = await setProjectRouting('pr_1', '');

    expect(project.domain).toBe('');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({ domain: '' });
  });

  it('surfaces a typed invalid_domain error when the domain is rejected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(400, {
        error: { code: 'invalid_domain', message: 'That does not look like a domain.' },
      }),
    );

    await expect(setProjectRouting('pr_1', 'not a domain')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      code: 'invalid_domain',
    });
  });

  it('surfaces a typed ApiError when the Project or server is not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(404, { error: { code: 'not_found', message: 'That Project does not exist.' } }),
    );

    await expect(assignNodeToProject('missing', 'nd_1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
    });
  });
});
