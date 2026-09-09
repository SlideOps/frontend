import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import {
  DOCKER_CONFIRMATION_REQUIRED_CODE,
  DOCKER_IN_USE_CODE,
  DOCKER_PROTECTED_NETWORK_CODE,
  connectDockerNetwork,
  createDockerNetwork,
  createDockerVolume,
  disconnectDockerNetwork,
  dockerInUseContainers,
  inspectDockerImage,
  inspectDockerVolume,
  isDockerConfirmationRequired,
  isDockerProtectedNetwork,
  isDockerResourceInUse,
  previewDockerCleanup,
  pullDockerImage,
  removeDockerImage,
  removeDockerNetwork,
  removeDockerVolume,
  runDockerCleanup,
  tagDockerImage,
} from './docker-resources';

/*
 * Acting on a Node's images, volumes and networks.
 *
 * Three things matter here and the rest is plumbing. Every call must reach the
 * Node it names with the method and body the backend contract states, because a
 * removal sent as a read does nothing and a removal sent to the wrong id
 * removes the wrong thing. A refusal must stay distinguishable from a failure,
 * since a screen shows a completely different sentence for each. And
 * confirm_data_loss must be off unless a caller said otherwise, because it is
 * the only thing standing between a cleanup button and somebody's database.
 */

/** Build a Response-like stub for the mocked fetch. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

function okFetch(body: unknown = {}) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, body));
}

/** The request init of the nth fetch, for asserting method and body. */
function initOf(mock: ReturnType<typeof okFetch>, index = 0) {
  return mock.mock.calls[index]?.[1];
}

function bodyOf(mock: ReturnType<typeof okFetch>, index = 0): unknown {
  const raw = initOf(mock, index)?.body;
  return typeof raw === 'string' ? JSON.parse(raw) : undefined;
}

function urlOf(mock: ReturnType<typeof okFetch>, index = 0): string {
  return String(mock.mock.calls[index]?.[0]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('images', () => {
  it('pulls the reference exactly as it was given', async () => {
    const fetchMock = okFetch({});

    await pullDockerImage('nd_1', 'nginx:1.27-alpine');

    expect(urlOf(fetchMock)).toContain('/api/v1/nodes/nd_1/docker/images/pull');
    expect(initOf(fetchMock)?.method).toBe('POST');
    expect(bodyOf(fetchMock)).toEqual({ reference: 'nginx:1.27-alpine' });
  });

  it('does not append a tag to a bare repository', async () => {
    const fetchMock = okFetch({});

    await pullDockerImage('nd_1', 'nginx');

    expect(bodyOf(fetchMock)).toEqual({ reference: 'nginx' });
  });

  it('removes an image with the force decision the caller made', async () => {
    const fetchMock = okFetch({});

    await removeDockerImage('nd_1', 'sha256:abc', false);

    expect(urlOf(fetchMock)).toContain('/docker/images/sha256%3Aabc');
    expect(initOf(fetchMock)?.method).toBe('DELETE');
    expect(bodyOf(fetchMock)).toEqual({ force: false });
  });

  it('tags an image without moving it', async () => {
    const fetchMock = okFetch({});

    await tagDockerImage('nd_1', 'sha256:abc', 'internal/web:blue');

    expect(urlOf(fetchMock)).toContain('/docker/images/sha256%3Aabc/tag');
    expect(bodyOf(fetchMock)).toEqual({ reference: 'internal/web:blue' });
  });

  it('reads an image inspect from under the image key the endpoint uses', async () => {
    okFetch({ image: { Id: 'sha256:abc', Os: 'linux', RepoTags: ['nginx:latest'] } });

    const inspect = await inspectDockerImage('nd_1', 'sha256:abc');

    expect(inspect).toEqual({ Id: 'sha256:abc', Os: 'linux', RepoTags: ['nginx:latest'] });
  });
});

describe('volumes', () => {
  it('creates a volume and returns the volume the daemon created', async () => {
    const fetchMock = okFetch({
      volume: {
        name: 'app-data',
        driver: 'local',
        mountpoint: '/var/lib/docker/volumes/app-data/_data',
        in_use: false,
        containers: [],
        labels: {},
      },
    });

    const volume = await createDockerVolume('nd_1', { name: 'app-data', driver: 'local' });

    expect(volume.name).toBe('app-data');
    expect(initOf(fetchMock)?.method).toBe('POST');
    expect(bodyOf(fetchMock)).toEqual({ name: 'app-data', driver: 'local' });
  });

  it('removes a volume by name, encoding it into the path', async () => {
    const fetchMock = okFetch({});

    await removeDockerVolume('nd_1', 'app/data', false);

    expect(urlOf(fetchMock)).toContain('/docker/volumes/app%2Fdata');
    expect(initOf(fetchMock)?.method).toBe('DELETE');
    expect(bodyOf(fetchMock)).toEqual({ force: false });
  });

  it('reads a volume inspect', async () => {
    okFetch({ volume: { Name: 'app-data', Scope: 'local' } });

    expect(await inspectDockerVolume('nd_1', 'app-data')).toEqual({
      Name: 'app-data',
      Scope: 'local',
    });
  });
});

describe('networks', () => {
  it('creates a network with only what the Operator chose', async () => {
    const fetchMock = okFetch({
      network: {
        id: 'net1',
        name: 'backend',
        driver: 'bridge',
        scope: 'local',
        internal: true,
        containers: [],
        labels: {},
      },
    });

    const network = await createDockerNetwork('nd_1', {
      name: 'backend',
      driver: 'bridge',
      internal: true,
    });

    expect(network.name).toBe('backend');
    expect(bodyOf(fetchMock)).toEqual({ name: 'backend', driver: 'bridge', internal: true });
  });

  it('removes a network with no body at all, because Docker offers no force', async () => {
    const fetchMock = okFetch({});

    await removeDockerNetwork('nd_1', 'net1');

    expect(initOf(fetchMock)?.method).toBe('DELETE');
    expect(initOf(fetchMock)?.body).toBeUndefined();
  });

  it('connects and disconnects a container by whatever names it', async () => {
    const fetchMock = okFetch({});

    await connectDockerNetwork('nd_1', 'net1', 'web');
    await disconnectDockerNetwork('nd_1', 'net1', 'web');

    expect(urlOf(fetchMock, 0)).toContain('/docker/networks/net1/connect');
    expect(bodyOf(fetchMock, 0)).toEqual({ container: 'web' });
    expect(urlOf(fetchMock, 1)).toContain('/docker/networks/net1/disconnect');
    expect(bodyOf(fetchMock, 1)).toEqual({ container: 'web' });
  });
});

describe('cleanup', () => {
  it('reads the preview through its envelope', async () => {
    // The endpoint answers with plans keyed by slug. The client turns them
    // into the categories a screen renders, which is where the human label
    // comes from: the server never sends one.
    const fetchMock = okFetch({
      plans: [
        {
          kind: 'stopped-containers',
          item_count: 7,
          targets: ['old-api'],
          reclaimable_bytes: 1_200_000_000,
        },
        { kind: 'unused-volumes', item_count: 2, targets: null, reclaimable_bytes: 400_000_000 },
      ],
    });

    const preview = await previewDockerCleanup('nd_1');

    expect(preview.categories).toHaveLength(2);
    expect(preview.categories[0]?.key).toBe('stopped-containers');
    expect(preview.categories[0]?.label).toBe('Stopped containers');
    expect(preview.categories[0]?.count).toBe(7);
    expect(initOf(fetchMock)?.method).toBe('GET');
  });

  it('never sets confirm_data_loss unless the caller asked for it', async () => {
    const fetchMock = okFetch({ reclaimed_bytes: 10 });

    await runDockerCleanup('nd_1', 'dangling_images');

    expect(bodyOf(fetchMock)).toEqual({ category: 'dangling_images', confirm_data_loss: false });
  });

  it('carries the data loss consent when the Operator gave it', async () => {
    const fetchMock = okFetch({ reclaimed_bytes: 400_000_000 });

    const result = await runDockerCleanup('nd_1', 'unused_volumes', true);

    expect(bodyOf(fetchMock)).toEqual({ category: 'unused_volumes', confirm_data_loss: true });
    expect(result.reclaimed_bytes).toBe(400_000_000);
  });

  it('leaves the reclaimed figure absent when the Node reported none', async () => {
    okFetch({});

    const result = await runDockerCleanup('nd_1', 'build_cache');

    // Absent, not zero. Nobody said zero bytes were released.
    expect(result.reclaimed_bytes).toBeUndefined();
  });
});

describe('telling a refusal from a failure', () => {
  it('recognises each refusal by its code and not by its status', () => {
    const inUse = new ApiError(409, DOCKER_IN_USE_CODE, 'Still used by web and api.');
    const protectedNetwork = new ApiError(
      409,
      DOCKER_PROTECTED_NETWORK_CODE,
      'bridge is built in.',
    );
    const consent = new ApiError(400, DOCKER_CONFIRMATION_REQUIRED_CODE, 'This would remove data.');
    const otherConflict = new ApiError(409, 'node_busy', 'An Operation is already running.');

    expect(isDockerResourceInUse(inUse)).toBe(true);
    expect(isDockerResourceInUse(otherConflict)).toBe(false);
    expect(isDockerProtectedNetwork(protectedNetwork)).toBe(true);
    expect(isDockerProtectedNetwork(otherConflict)).toBe(false);
    expect(isDockerConfirmationRequired(consent)).toBe(true);
    expect(isDockerConfirmationRequired(otherConflict)).toBe(false);
  });

  it('is not fooled by a plain Error or by a thrown string', () => {
    expect(isDockerResourceInUse(new Error('in_use'))).toBe(false);
    expect(isDockerProtectedNetwork('protected_network')).toBe(false);
    expect(isDockerConfirmationRequired(null)).toBe(false);
  });

  it('reads the containers an in_use refusal named', () => {
    const error = new ApiError(409, DOCKER_IN_USE_CODE, 'Still used by web and api.', {
      containers: ['web', 'api'],
    });

    expect(dockerInUseContainers(error)).toEqual(['web', 'api']);
  });

  it('returns no containers rather than guessing when the refusal named none', () => {
    expect(dockerInUseContainers(new ApiError(409, DOCKER_IN_USE_CODE, 'Still in use.'))).toEqual(
      [],
    );
    expect(
      dockerInUseContainers(
        new ApiError(409, DOCKER_IN_USE_CODE, 'Still in use.', { containers: 'web' }),
      ),
    ).toEqual([]);
    expect(dockerInUseContainers(new ApiError(500, 'unknown_error', 'Broke.'))).toEqual([]);
  });

  it('drops entries that are not names, so an empty string never renders as a container', () => {
    const error = new ApiError(409, DOCKER_IN_USE_CODE, 'Still in use.', {
      containers: ['web', '', 3, null, 'api'],
    });

    expect(dockerInUseContainers(error)).toEqual(['web', 'api']);
  });
});
