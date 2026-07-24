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
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/marketplace/plugins');
  });

  it('installs a Plugin and reports it installed and enabled', async () => {
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

    const installed = await installPlugin({ plugin_id: 'postgresql', config: { port: 5432 } });

    expect(installed.plugin_id).toBe('postgresql');
    expect(installed.enabled).toBe(true);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const sent = JSON.parse(String(init?.body)) as { plugin_id: string; config: { port: number } };
    expect(sent.plugin_id).toBe('postgresql');
    expect(sent.config.port).toBe(5432);
  });

  it('reflects install then uninstall in the installed list', async () => {
    // First read: the Plugin is installed.
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
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
    const before = await listInstalledPlugins();
    expect(before.map((p) => p.plugin_id)).toContain('postgresql');

    // Uninstall issues a DELETE against the plugin id.
    const deleteMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(204, undefined));
    await uninstallPlugin('postgresql');
    const deleteInit = deleteMock.mock.calls[0]?.[1];
    expect(deleteInit?.method).toBe('DELETE');
    expect(String(deleteMock.mock.calls[0]?.[0])).toContain('/api/v1/plugins/postgresql');

    // Second read: the Plugin is gone.
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(200, { plugins: [] }));
    const after = await listInstalledPlugins();
    expect(after.map((p) => p.plugin_id)).not.toContain('postgresql');
  });

  it('surfaces a typed error when Core cannot be uninstalled', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(403, {
        error: { code: 'core_not_removable', message: 'The Core bundle cannot be uninstalled.' },
      }),
    );

    await expect(uninstallPlugin('core')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'core_not_removable',
    });
  });
});
