import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSampleApp } from './sample-app';

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

describe('sample app requests', () => {
  it('reads the preset over the same origin with cookies and unwraps the envelope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        sample_app: {
          name: 'hello-world',
          description: 'A tiny Hello World to confirm your setup works.',
          runtime: 'container',
          repository_url: 'https://github.com/slideops/hello-world.git',
          branch: 'main',
          container_port: 8080,
        },
      }),
    );

    const sample = await getSampleApp();

    expect(sample.name).toBe('hello-world');
    expect(sample.runtime).toBe('container');
    expect(sample.repository_url).toBe('https://github.com/slideops/hello-world.git');
    expect(sample.branch).toBe('main');
    expect(sample.container_port).toBe(8080);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/sample-app');
  });

  it('accepts an already bare shape without the envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        name: 'hello-world',
        description: 'A tiny Hello World.',
        runtime: 'container',
        repository_url: 'https://github.com/slideops/hello-world.git',
        branch: 'main',
        container_port: 8080,
      }),
    );

    const sample = await getSampleApp();

    expect(sample.container_port).toBe(8080);
  });

  it('surfaces a typed error when the preset cannot be read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(500, {
        error: { code: 'internal_error', message: 'The sample app is unavailable.' },
      }),
    );

    await expect(getSampleApp()).rejects.toMatchObject({ name: 'ApiError', status: 500 });
  });
});
