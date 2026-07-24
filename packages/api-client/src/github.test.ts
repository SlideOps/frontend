import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  disconnectGitHub,
  getGitHubStatus,
  githubAuthorizeUrl,
  listGitHubRepos,
} from './github';

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

describe('github requests', () => {
  it('reads status over the same origin with cookies, accepting a bare shape', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { configured: true, connected: true, login: 'octocat' }));

    const status = await getGitHubStatus();

    expect(status.configured).toBe(true);
    expect(status.connected).toBe(true);
    expect(status.login).toBe('octocat');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/github/status');
  });

  it('builds the authorize URL against the API base', () => {
    expect(githubAuthorizeUrl()).toContain('/api/v1/github/authorize');
  });

  it('disconnects with a DELETE', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));
    await disconnectGitHub();
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/github');
  });

  it('lists repositories and unwraps the envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        repos: [
          {
            full_name: 'octocat/app',
            private: true,
            default_branch: 'main',
            html_url: 'https://github.com/octocat/app',
            clone_url: 'https://github.com/octocat/app.git',
          },
        ],
      }),
    );

    const repos = await listGitHubRepos();

    expect(repos).toHaveLength(1);
    expect(repos[0]?.full_name).toBe('octocat/app');
    expect(repos[0]?.default_branch).toBe('main');
  });

  it('surfaces a typed error when GitHub is not configured', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(404, {
        error: { code: 'github_unconfigured', message: 'GitHub is not configured.' },
      }),
    );

    await expect(listGitHubRepos()).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'github_unconfigured',
    });
  });
});
