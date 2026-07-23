import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNode, discoverNode, listNodes } from './nodes';

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

describe('nodes requests', () => {
  it('lists Nodes over the same origin with cookies included', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { nodes: [{ id: 'nd_1', name: 'web-1' }] }));

    const nodes = await listNodes();

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.name).toBe('web-1');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/nodes');
  });

  it('sends the credential under the auth envelope when registering a Node', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, {
        node: {
          id: 'nd_2',
          name: 'db-1',
          auth_kind: 'private_key',
        },
      }),
    );

    const node = await createNode({
      name: 'db-1',
      hostname: 'db-1.internal',
      address: '10.0.0.5',
      port: 22,
      ssh_username: 'deploy',
      auth: { kind: 'private_key', secret: 'PRIVATE-KEY-MATERIAL' },
    });

    expect(node.id).toBe('nd_2');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const sent = JSON.parse(String(init?.body)) as {
      auth: { kind: string; secret: string };
      port: number;
    };
    expect(sent.auth).toEqual({ kind: 'private_key', secret: 'PRIVATE-KEY-MATERIAL' });
    expect(sent.port).toBe(22);
  });

  it('returns the facts and assessment from a discovery', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        facts: { os: { id: 'debian', version: '12' } },
        assessment: {
          summary: 'Password sign in is enabled.',
          findings: [],
          recommendations: [{ capability_key: 'secure-ssh', reason: 'Harden SSH access.' }],
        },
      }),
    );

    const result = await discoverNode('nd_1');

    expect(result.facts.os?.id).toBe('debian');
    expect(result.assessment.recommendations[0]?.capability_key).toBe('secure-ssh');
  });

  it('throws a typed ApiError carrying the backend message on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(404, { error: { code: 'not_found', message: 'That Node does not exist.' } }),
    );

    await expect(discoverNode('missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
    });
  });
});
