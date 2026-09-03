import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  installPlugin,
  listInstalledPlugins,
  listMarketplacePlugins,
  uninstallPlugin,
} from './marketplace';

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

describe('marketplace requests', () => {
  it('lists the catalog with cookies and unwraps the envelope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        plugins: [
          {
            manifest: { id: 'postgresql', name: 'PostgreSQL', category: 'Databases' },
            core: false,
            installed: false,
            enabled: true,
          },
        ],
      }),
    );

    const plugins = await listMarketplacePlugins();

    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.id).toBe('postgresql');
    expect(plugins[0]?.installed).toBe(false);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/api/v1/marketplace/plugins');
    // With no Project the catalog stays global and carries no project_id.
    expect(url).not.toContain('project_id');
  });

  it('reads the Capability keys a Plugin provides from the backend field, capabilities', async () => {
    // The backend's own wire shape (pluginManifestView in the Go transport
    // layer) names this field capabilities, not provides. Every screen in
    // this app reads plugin.provides; casting the raw response straight to
    // the typed shape left it undefined always, which is why an installed
    // Capability's card could never route anywhere but the read-only
    // Marketplace catalog entry, whatever an Operator clicked.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        plugins: [
          {
            manifest: {
              id: 'postgresql',
              name: 'PostgreSQL',
              category: 'Databases',
              capabilities: ['install-postgresql'],
            },
            core: false,
            installed: true,
          },
        ],
      }),
    );

    const plugins = await listMarketplacePlugins('pr_1');

    expect(plugins[0]?.provides).toEqual(['install-postgresql']);
  });

  it('reflects a Project in the catalog with project_id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { plugins: [] }));

    await listMarketplacePlugins('pr_1');

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/api/v1/marketplace/plugins');
    expect(url).toContain('project_id=pr_1');
  });

  it('installs a Plugin into a Project and reports it installed and enabled', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, {
        plugin: {
          id: 'ip_1',
          plugin_id: 'postgresql',
          enabled: true,
          installed_at: '2026-07-24T00:00:00Z',
        },
      }),
    );

    const installed = await installPlugin('pr_1', {
      plugin_id: 'postgresql',
      config: { port: 5432 },
    });

    expect(installed.plugin_id).toBe('postgresql');
    expect(installed.enabled).toBe(true);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/projects/pr_1/plugins');
    const sent = JSON.parse(String(init?.body)) as { plugin_id: string; config: { port: number } };
    expect(sent.plugin_id).toBe('postgresql');
    expect(sent.config.port).toBe(5432);
  });

  it('reflects install then uninstall in a Project installed list', async () => {
    // First read: the Plugin is installed in the Project.
    const listMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(200, {
        plugins: [
          {
            id: 'ip_1',
            plugin_id: 'postgresql',
            enabled: true,
            installed_at: '2026-07-24T00:00:00Z',
          },
        ],
      }),
    );
    const before = await listInstalledPlugins('pr_1');
    expect(before.map((p) => p.plugin_id)).toContain('postgresql');
    expect(String(listMock.mock.calls[0]?.[0])).toContain('/api/v1/projects/pr_1/plugins');

    // Uninstall issues a DELETE against the Project's plugin id.
    const deleteMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(204, undefined));
    await uninstallPlugin('pr_1', 'postgresql');
    const deleteInit = deleteMock.mock.calls[0]?.[1];
    expect(deleteInit?.method).toBe('DELETE');
    expect(String(deleteMock.mock.calls[0]?.[0])).toContain(
      '/api/v1/projects/pr_1/plugins/postgresql',
    );

    // Second read: the Plugin is gone.
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(200, { plugins: [] }));
    const after = await listInstalledPlugins('pr_1');
    expect(after.map((p) => p.plugin_id)).not.toContain('postgresql');
  });

  it('maps the embedded manifest on an installed Plugin the same way', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        plugins: [
          {
            id: 'ip_1',
            plugin_id: 'postgresql',
            enabled: true,
            installed_at: '2026-07-24T00:00:00Z',
            manifest: { id: 'postgresql', name: 'PostgreSQL', capabilities: ['install-postgresql'] },
          },
        ],
      }),
    );

    const installed = await listInstalledPlugins('pr_1');

    expect(installed[0]?.manifest?.provides).toEqual(['install-postgresql']);
  });

  it('surfaces a typed error when Core cannot be uninstalled', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(403, {
        error: { code: 'core_immutable', message: 'The Core bundle cannot be uninstalled.' },
      }),
    );

    await expect(uninstallPlugin('pr_1', 'core')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'core_immutable',
    });
  });
});
