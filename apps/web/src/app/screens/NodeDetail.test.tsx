import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Node } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * The real friction this locks in: a Node that has never been discovered
 * landed an Operator on a page with nothing on it -- no OS, no
 * recommendations, not even confirmation the credential worked -- and made
 * them click Discover themselves just to see any of that. The first
 * Discovery now runs on its own the moment the page can tell one has never
 * happened, so the Operator never has to ask for information SlideOps
 * already had the means to show them immediately.
 */

vi.mock('../components/NodeCapacity', () => ({ NodeCapacity: () => null }));
vi.mock('../components/ServerReadiness', () => ({ ServerReadiness: () => null }));
vi.mock('../components/NodeHealth', () => ({ NodeHealth: () => null }));
vi.mock('../components/SecureServer', () => ({
  ServerPosture: () => null,
  SecureServer: () => null,
}));
vi.mock('../components/DiscoveryScan', () => ({ DiscoveryScan: () => null }));

const neverDiscovered: Node = {
  id: 'node-1',
  name: 'sali-database-server',
  hostname: '',
  address: '187.7.20.159',
  port: 22,
  ssh_username: 'salidb',
  auth_kind: 'private_key',
  ssh_key_id: null,
  project_id: null,
  os: '',
  distro: '',
  distro_version: '',
  status: 'unknown',
  tags: [],
  last_discovered_at: null,
  created_at: '2026-09-05T20:00:00Z',
};

const alreadyDiscovered: Node = { ...neverDiscovered, last_discovered_at: '2026-09-06T00:00:00Z' };

const getNodeMock = vi.fn();
const discoverNodeMock = vi.fn();
const getSavedDiscoveryMock = vi.fn();
const getCapabilityStatesMock = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getNode: (...args: [string]) => getNodeMock(...args),
  discoverNode: (...args: [string]) => discoverNodeMock(...args),
  getSavedDiscovery: (...args: [string]) => getSavedDiscoveryMock(...args),
  listCapabilities: vi.fn(async () => [
    { key: 'secure-ssh', name: 'Secure SSH', category: 'Security', description: '' },
    { key: 'configure-firewall', name: 'Configure firewall', category: 'Security', description: '' },
  ]),
  getCapabilityStates: (...args: [string]) => getCapabilityStatesMock(...args),
}));

const { NodeDetail } = await import('./NodeDetail');

function show(initialTab?: string) {
  return renderInApp(
    <MemoryRouter initialEntries={[`/nodes/node-1${initialTab ? `?tab=${initialTab}` : ''}`]}>
      <Routes>
        <Route path="/nodes/:id" element={<NodeDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getNodeMock.mockReset();
  discoverNodeMock.mockReset();
  getSavedDiscoveryMock.mockReset();
  getCapabilityStatesMock.mockReset();
  discoverNodeMock.mockResolvedValue({ facts: {}, assessment: { summary: '', recommendations: [] } });
  getSavedDiscoveryMock.mockResolvedValue({ found: false });
  getCapabilityStatesMock.mockResolvedValue({});
});

describe('NodeDetail auto-discovery', () => {
  it('runs Discovery on its own for a Node that has never been discovered', async () => {
    getNodeMock.mockResolvedValue(neverDiscovered);
    show();

    await screen.findByText('sali-database-server');
    await waitFor(() => expect(discoverNodeMock).toHaveBeenCalledWith('node-1'));
    expect(getSavedDiscoveryMock).not.toHaveBeenCalled();
  });

  it('loads the saved Discovery instead of reconnecting for a Node that already has one', async () => {
    getNodeMock.mockResolvedValue(alreadyDiscovered);
    show();

    await screen.findByText('sali-database-server');
    await waitFor(() => expect(getSavedDiscoveryMock).toHaveBeenCalledWith('node-1'));
    expect(discoverNodeMock).not.toHaveBeenCalled();
  });
});

describe('NodeDetail recommended capabilities', () => {
  it('surfaces an undone recommendation as a direct next step', async () => {
    getNodeMock.mockResolvedValue(alreadyDiscovered);
    getSavedDiscoveryMock.mockResolvedValue({
      found: true,
      facts: {},
      assessment: {
        summary: '',
        recommendations: [
          { capability_key: 'secure-ssh', title: 'Secure SSH', reason: 'Password auth is on.' },
        ],
      },
    });
    show('capabilities');

    await screen.findByText('Do this next');
    expect(screen.getAllByText('Secure SSH').length).toBeGreaterThan(0);
    expect(screen.getByText('Password auth is on.')).toBeInTheDocument();
  });

  it('does not recommend a capability that already ran here', async () => {
    getNodeMock.mockResolvedValue(alreadyDiscovered);
    getCapabilityStatesMock.mockResolvedValue({
      'secure-ssh': { status: 'done', source: 'slideops' },
    });
    getSavedDiscoveryMock.mockResolvedValue({
      found: true,
      facts: {},
      assessment: {
        summary: '',
        recommendations: [
          { capability_key: 'secure-ssh', title: 'Secure SSH', reason: 'Password auth is on.' },
        ],
      },
    });
    show('capabilities');

    await screen.findByText('Available Capabilities');
    expect(screen.queryByText('Do this next')).not.toBeInTheDocument();
  });
});
