import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DNSConnection, WorkspaceIngressView } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const listDNSConnections = vi.fn();
const connectDNS = vi.fn();
const disconnectDNS = vi.fn();
const getWorkspaceIngress = vi.fn();
const chooseWorkspaceIngress = vi.fn();
const disableWorkspaceIngress = vi.fn();
const listNodes = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listDNSConnections: (...a: unknown[]) => listDNSConnections(...a),
  connectDNS: (...a: unknown[]) => connectDNS(...a),
  disconnectDNS: (...a: unknown[]) => disconnectDNS(...a),
  getWorkspaceIngress: (...a: unknown[]) => getWorkspaceIngress(...a),
  chooseWorkspaceIngress: (...a: unknown[]) => chooseWorkspaceIngress(...a),
  disableWorkspaceIngress: (...a: unknown[]) => disableWorkspaceIngress(...a),
  listNodes: (...a: unknown[]) => listNodes(...a),
}));

const { DomainRouting } = await import('./DomainRouting');

function connection(over: Partial<DNSConnection> = {}): DNSConnection {
  return {
    id: 'dns-1',
    kind: 'cloudflare',
    zone: 'example.com',
    state: 'active',
    usable: true,
    created_at: '2026-09-07T10:00:00Z',
    ...over,
  };
}

function ingress(over: Partial<WorkspaceIngressView> = {}): WorkspaceIngressView {
  return {
    node_id: '',
    public_address: '',
    enabled: false,
    drifted: false,
    ...over,
  };
}

beforeEach(() => {
  for (const fn of [
    listDNSConnections,
    connectDNS,
    disconnectDNS,
    getWorkspaceIngress,
    chooseWorkspaceIngress,
    disableWorkspaceIngress,
    listNodes,
  ]) {
    fn.mockReset();
  }
  listDNSConnections.mockResolvedValue([]);
  getWorkspaceIngress.mockResolvedValue(ingress());
  listNodes.mockResolvedValue([{ id: 'n-1', name: 'edge-node' }]);
});

describe('DomainRouting', () => {
  // A zone holds mail routing and ownership proofs. Somebody handing over a
  // token deserves to know what will and will not be touched with it.
  it('says what SlideOps will and will not touch before asking for a token', async () => {
    renderInApp(<DomainRouting canAdminister />);

    expect(
      await screen.findByText(/only ever changes or removes records it created itself/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/mail and\s+verification records, is left alone/i)).toBeInTheDocument();
  });

  it('keeps the token out of the page after connecting', async () => {
    connectDNS.mockResolvedValue(connection());
    const { container } = renderInApp(<DomainRouting canAdminister />);

    await userEvent.type(
      await screen.findByLabelText(/Domain this credential may manage/),
      'example.com',
    );
    await userEvent.type(screen.getByLabelText(/Cloudflare API token/), 'super-secret-token');
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(connectDNS).toHaveBeenCalled());
    expect(container.textContent ?? '').not.toContain('super-secret-token');
  });

  it('says a domain can still be added with no DNS connected', async () => {
    renderInApp(<DomainRouting canAdminister />);
    expect(
      await screen.findByText(/show you the exact record to create yourself/i),
    ).toBeInTheDocument();
  });

  it('shows why a credential stopped working', async () => {
    listDNSConnections.mockResolvedValue([
      connection({ usable: false, state: 'invalid', last_error: 'Authentication error' }),
    ]);
    renderInApp(<DomainRouting canAdminister />);

    expect(await screen.findByText('Authentication error')).toBeInTheDocument();
  });

  // Disconnecting must not read as "this will break my sites", because it does
  // not: the records already written stay exactly where they are.
  it('says disconnecting leaves existing records alone', async () => {
    listDNSConnections.mockResolvedValue([connection()]);
    renderInApp(<DomainRouting canAdminister />);

    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByText(/left exactly where they are/i)).toBeInTheDocument();
    expect(disconnectDNS).not.toHaveBeenCalled();
  });

  // An ingress is not a free improvement: it makes one server the path for all
  // public traffic, and the page has to say so rather than only selling it.
  it('says what choosing one entry point costs as well as what it gives', async () => {
    renderInApp(<DomainRouting canAdminister />);

    expect(
      await screen.findByText(/All public traffic for this Workspace passes through it/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/never needs a DNS change/i)).toBeInTheDocument();
  });

  it('chooses an entry point', async () => {
    chooseWorkspaceIngress.mockResolvedValue(
      ingress({ enabled: true, node_id: 'n-1', public_address: '203.0.113.9' }),
    );
    renderInApp(<DomainRouting canAdminister />);

    await userEvent.selectOptions(
      await screen.findByLabelText(/Server to answer for this Workspace/),
      'n-1',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Use one entry point' }));

    await waitFor(() => expect(chooseWorkspaceIngress).toHaveBeenCalledWith('n-1', undefined));
  });

  // The one thing that breaks every hostname in a Workspace at once, and it is
  // completely invisible without being told.
  it('warns when the entry point has moved and every domain still points at the old address', async () => {
    getWorkspaceIngress.mockResolvedValue(
      ingress({
        enabled: true,
        node_id: 'n-1',
        public_address: '203.0.113.9',
        drifted: true,
        current_address: '198.51.100.4',
      }),
    );
    renderInApp(<DomainRouting canAdminister />);

    expect(await screen.findByText(/still points at 203.0.113.9/)).toBeInTheDocument();
    expect(screen.getByText(/changed to 198.51.100.4/)).toBeInTheDocument();
  });

  it('leaves the controls out for a role that cannot change any of this', async () => {
    listDNSConnections.mockResolvedValue([connection()]);
    renderInApp(<DomainRouting canAdminister={false} />);

    await screen.findByText('example.com');
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
    expect(screen.getByText(/requires the Owner or an Admin/i)).toBeInTheDocument();
  });
});
