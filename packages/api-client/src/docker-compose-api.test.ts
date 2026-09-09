import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import {
  CONFIRMATION_REQUIRED_CODE,
  FORBIDDEN_MOUNT_CODE,
  PRIVILEGED_REFUSED_CODE,
  applyDockerComposeFile,
  createDockerContainer,
  diffDockerComposeFile,
  downDockerComposeProject,
  getDockerComposeFile,
  getDockerComposeProject,
  isConfirmationRequired,
  isForbiddenMount,
  isPrivilegedRefused,
  listDockerComposeProjects,
  refusalExplanation,
  runDockerComposeAction,
  validateDockerComposeFile,
  type DockerComposeAction,
} from './docker-compose-api';

/*
 * The Compose and run-a-container surface.
 *
 * Two things matter more than the routing here. First, that nothing carrying a
 * secret goes anywhere near a URL: a Compose file and a container environment
 * both hold passwords, and a query string is logged by every hop. Second, that
 * the destructive calls are shaped so a screen cannot reach them by accident:
 * `down` is its own function with a body that has to be filled in, and it is
 * not reachable from the generic action verb.
 */

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

// Typed against the shape this needs rather than against vi.spyOn's return,
// which carries fetch's own overloads and does not match the generic spy type.
function lastRequest(fetchMock: { mock: { calls: unknown[][] } }): {
  url: URL;
  init: RequestInit;
} {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) {
    throw new Error('fetch was never called, so there is no request to read');
  }
  return { url: call[0] as URL, init: (call[1] ?? {}) as RequestInit };
}

/**
 * The body an apply answers with: the diff it carried out and the stack it left
 * behind, which is what the endpoint actually sends.
 */
function applyResult() {
  return {
    project: 'shop',
    path: '/srv/shop/compose.yaml',
    command: 'docker compose up -d',
    diff: {
      services_added: null,
      services_removed: null,
      services_changed: null,
      recreated: ['shop-web-1'],
      networks_added: null,
      networks_removed: null,
      volumes_added: null,
      volumes_removed: null,
      affects_data: false,
      warnings: null,
    },
    state: { name: 'shop', ownership: 'external', config_readable: true },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reading Compose stacks', () => {
  it('lists the stacks on one Node and unwraps the envelope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        projects: [
          {
            name: 'shop',
            services: ['web', 'api', 'db'],
            container_count: 3,
            status: 'running',
            images: ['nginx:1.27'],
            networks: ['shop_default'],
            volumes: ['shop_pgdata'],
            config_path: '/srv/shop/docker-compose.yml',
            ownership: 'slideops',
          },
        ],
      }),
    );

    const projects = await listDockerComposeProjects('node-1');

    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe('shop');
    const { url, init } = lastRequest(fetchMock);
    expect(url.pathname).toBe('/api/v1/nodes/node-1/docker/compose');
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.credentials).toBe('include');
  });

  it('encodes a project name rather than letting it become a path segment', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { project: { name: 'a/b', services: [] } }));

    await getDockerComposeProject('node-1', 'a/b');

    expect(lastRequest(fetchMock).url.pathname).toBe('/api/v1/nodes/node-1/docker/compose/a%2Fb');
  });

  it('reads the Compose file without unwrapping a key that is not there', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { content: 'services:\n  web:\n', path: '/srv/shop/docker-compose.yml' }),
    );

    const file = await getDockerComposeFile('node-1', 'shop');

    expect(file.content).toContain('services:');
    expect(file.path).toBe('/srv/shop/docker-compose.yml');
  });
});

describe('acting on a Compose stack', () => {
  const actions: DockerComposeAction[] = ['up', 'start', 'stop', 'restart', 'pull', 'rebuild'];

  it.each(actions)('posts %s to the stack and resolves empty', async (action) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {}));

    await expect(runDockerComposeAction('node-1', 'shop', action)).resolves.toBeUndefined();

    const { url, init } = lastRequest(fetchMock);
    expect(url.pathname).toBe(`/api/v1/nodes/node-1/docker/compose/shop/${action}`);
    expect(init.method).toBe('POST');
    // No body at all: none of these six takes an option, so none of them has a
    // place to smuggle a destructive one.
    expect(init.body).toBeUndefined();
  });

  it('keeps the stack volumes when down is asked for on its own', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {}));

    await downDockerComposeProject('node-1', 'shop', {
      remove_volumes: false,
      confirm_data_loss: false,
    });

    const { url, init } = lastRequest(fetchMock);
    expect(url.pathname).toBe('/api/v1/nodes/node-1/docker/compose/shop/down');
    expect(JSON.parse(String(init.body))).toEqual({
      remove_volumes: false,
      confirm_data_loss: false,
    });
  });

  it('sends both acknowledgements when the Operator asked to remove the volumes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {}));

    await downDockerComposeProject('node-1', 'shop', {
      remove_volumes: true,
      confirm_data_loss: true,
    });

    expect(JSON.parse(String(lastRequest(fetchMock).init.body))).toEqual({
      remove_volumes: true,
      confirm_data_loss: true,
    });
  });
});

describe('editing the Compose file', () => {
  it('sends the proposed file in the body and never in the query string', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse(200, { validation: { valid: true, issues: [], checked_on_node: true } }),
      );
    const content = 'services:\n  db:\n    environment:\n      POSTGRES_PASSWORD: hunter2\n';

    await validateDockerComposeFile('node-1', 'shop', content);

    const { url, init } = lastRequest(fetchMock);
    expect(url.search).toBe('');
    expect(url.toString()).not.toContain('hunter2');
    expect(JSON.parse(String(init.body))).toEqual({ content });
  });

  it('reports validation errors, including ones with no line number', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        validation: {
          valid: false,
          checked_on_node: true,
          issues: [
            { line: 7, message: 'mapping values are not allowed here' },
            { message: 'service web names an undeclared network' },
          ],
        },
      }),
    );

    const validation = await validateDockerComposeFile('node-1', 'shop', 'services:');

    expect(validation.valid).toBe(false);
    expect(validation.issues).toHaveLength(2);
    expect(validation.issues[1]?.line).toBeUndefined();
  });

  it('returns the diff of what applying would change', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        diff: {
          services_added: null,
          services_removed: null,
          services_changed: null,
          recreated: ['shop-web-1'],
          networks_added: [],
          networks_removed: [],
          volumes_added: ['shop_cache'],
          volumes_removed: [{ name: 'shop_pgdata', exists_on_node: true }],
          affects_data: true,
          warnings: null,
        },
      }),
    );

    const diff = await diffDockerComposeFile('node-1', 'shop', 'services:');

    expect(diff.volumes_removed).toEqual([{ name: 'shop_pgdata', exists_on_node: true }]);
    expect(diff.affects_data).toBe(true);
    // Lists the server left out arrive as null and must reach a screen as lists.
    expect(diff.services_added).toEqual([]);
    expect(diff.warnings).toEqual([]);
  });

  it('applies without a data-loss flag when the Operator was not asked for one', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { result: applyResult() }));

    await applyDockerComposeFile('node-1', 'shop', { content: 'services:' });

    expect(JSON.parse(String(lastRequest(fetchMock).init.body))).toEqual({ content: 'services:' });
  });

  it('carries the data-loss confirmation through when one was given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { result: applyResult() }));

    await applyDockerComposeFile('node-1', 'shop', {
      content: 'services:',
      confirm_data_loss: true,
    });

    expect(JSON.parse(String(lastRequest(fetchMock).init.body))).toEqual({
      content: 'services:',
      confirm_data_loss: true,
    });
  });
});

describe('creating a container', () => {
  it('sends the whole request in the body, so no environment value reaches a URL', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { container: { name: 'cache', id: 'abc123' } }));

    const container = await createDockerContainer('node-1', {
      image: 'redis:7',
      name: 'cache',
      env: { REDIS_PASSWORD: 'hunter2' },
    });

    expect(container.name).toBe('cache');
    const { url, init } = lastRequest(fetchMock);
    expect(url.pathname).toBe('/api/v1/nodes/node-1/docker/containers');
    expect(url.search).toBe('');
    expect(url.toString()).not.toContain('hunter2');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body)).env).toEqual({ REDIS_PASSWORD: 'hunter2' });
  });
});

describe('refusals', () => {
  it('tells a refused mount apart from a request that simply failed', () => {
    const refusal = new ApiError(400, FORBIDDEN_MOUNT_CODE, '');
    const failure = new ApiError(400, 'invalid_request', 'The image name is not valid.');

    expect(isForbiddenMount(refusal)).toBe(true);
    expect(isForbiddenMount(failure)).toBe(false);
    expect(isPrivilegedRefused(new ApiError(400, PRIVILEGED_REFUSED_CODE, ''))).toBe(true);
    expect(isConfirmationRequired(new ApiError(400, CONFIRMATION_REQUIRED_CODE, ''))).toBe(true);
  });

  it('explains a refusal in plain language rather than leaving a bare code', () => {
    const explanation = refusalExplanation(new ApiError(400, FORBIDDEN_MOUNT_CODE, ''));

    expect(explanation).toContain('Docker socket');
    expect(explanation).toContain('named volume');
  });

  it('prefers the server sentence, which can name the actual path', () => {
    const explanation = refusalExplanation(
      new ApiError(400, FORBIDDEN_MOUNT_CODE, '/var/run/docker.sock may not be mounted.'),
    );

    expect(explanation).toBe('/var/run/docker.sock may not be mounted.');
  });

  it('returns null for anything that is not one of these three refusals', () => {
    expect(refusalExplanation(new ApiError(500, 'unknown_error', 'boom'))).toBeNull();
    expect(refusalExplanation(new Error('boom'))).toBeNull();
    expect(refusalExplanation(null)).toBeNull();
  });
});
