import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderInApp } from '../../test/render';
import type { InstalledPlugin, Plugin } from '@slideops/api-client';

/*
 * The Project stack, now split into what is actually installed and what is
 * still available to add, rather than one mixed grid. This is what surfaces
 * an installed Capability's real visual manager (Sites, Queues, the Database
 * Explorer, and so on) when a Node is known, since a bare Marketplace catalog
 * page has nowhere to send that link.
 */

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

const listMarketplacePlugins = vi.fn();
const listInstalledPlugins = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listMarketplacePlugins: (...args: unknown[]) => listMarketplacePlugins(...args),
  listInstalledPlugins: (...args: unknown[]) => listInstalledPlugins(...args),
}));

const { ProjectStack } = await import('./ProjectStack');

function plugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    id: 'postgresql',
    name: 'PostgreSQL',
    version: '1.0.0',
    author: 'SlideOps',
    category: 'database',
    description: 'A PostgreSQL server.',
    provides: ['install-postgresql'],
    config: [],
    permissions: [],
    installed: false,
    ...overrides,
  };
}

function installedEntry(overrides: Partial<InstalledPlugin> = {}): InstalledPlugin {
  return { id: 'inst-1', plugin_id: 'postgresql', enabled: true, installed_at: '2026-01-01', ...overrides };
}

function show(nodeId?: string) {
  return renderInApp(
    <MemoryRouter>
      <ProjectStack projectId="proj-1" nodeId={nodeId} />
    </MemoryRouter>,
  );
}

describe('ProjectStack', () => {
  beforeEach(() => {
    listMarketplacePlugins.mockReset();
    listInstalledPlugins.mockReset();
    navigate.mockReset();
  });

  it('splits installed Plugins from what is still available to add', async () => {
    listMarketplacePlugins.mockResolvedValue([
      plugin({ id: 'postgresql', name: 'PostgreSQL', installed: true }),
      plugin({ id: 'redis', name: 'Redis', installed: false }),
    ]);
    listInstalledPlugins.mockResolvedValue([installedEntry({ plugin_id: 'postgresql' })]);
    show();

    await screen.findByText('PostgreSQL');
    expect(screen.getAllByText('Installed').length).toBeGreaterThan(0);
    expect(screen.getByText('Available to add')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
  });

  it('says plainly when nothing is installed yet', async () => {
    listMarketplacePlugins.mockResolvedValue([plugin({ id: 'redis', installed: false })]);
    listInstalledPlugins.mockResolvedValue([]);
    show();
    expect(await screen.findByText('Nothing is installed yet.')).toBeInTheDocument();
  });

  it('opens an installed Capability straight into its own management page when a Node is known', async () => {
    listMarketplacePlugins.mockResolvedValue([
      plugin({ id: 'postgresql', name: 'PostgreSQL', installed: true, provides: ['install-postgresql'] }),
    ]);
    listInstalledPlugins.mockResolvedValue([installedEntry({ plugin_id: 'postgresql' })]);
    const operator = userEvent.setup();
    show('node-1');

    await operator.click(await screen.findByRole('button', { name: /Manage/ }));
    expect(navigate).toHaveBeenCalledWith('/app/capabilities/install-postgresql?node=node-1&project=proj-1');
  });

  it('falls back to the Marketplace catalog entry when no Node is known', async () => {
    listMarketplacePlugins.mockResolvedValue([
      plugin({ id: 'postgresql', name: 'PostgreSQL', installed: true, provides: ['install-postgresql'] }),
    ]);
    listInstalledPlugins.mockResolvedValue([installedEntry({ plugin_id: 'postgresql' })]);
    const operator = userEvent.setup();
    show(undefined);

    await operator.click(await screen.findByRole('button', { name: /Details/ }));
    expect(navigate).toHaveBeenCalledWith('/app/marketplace/postgresql');
  });
});
