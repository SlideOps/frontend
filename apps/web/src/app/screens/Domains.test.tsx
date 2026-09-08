import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Domain, type Node, type RouteDrift, type Service } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

const listWorkspaceDomains = vi.fn();
const listServices = vi.fn();
const listNodes = vi.fn();
const verifyDomain = vi.fn();
const provisionDomain = vi.fn();
const removeDomain = vi.fn();
const inspectNodeRoutes = vi.fn();
const repairNodeRoutes = vi.fn();
const listDNSConnections = vi.fn();
const getWorkspaceIngress = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listWorkspaceDomains: (...a: unknown[]) => listWorkspaceDomains(...a),
  listServices: (...a: unknown[]) => listServices(...a),
  listNodes: (...a: unknown[]) => listNodes(...a),
  verifyDomain: (...a: unknown[]) => verifyDomain(...a),
  provisionDomain: (...a: unknown[]) => provisionDomain(...a),
  removeDomain: (...a: unknown[]) => removeDomain(...a),
  inspectNodeRoutes: (...a: unknown[]) => inspectNodeRoutes(...a),
  repairNodeRoutes: (...a: unknown[]) => repairNodeRoutes(...a),
  listDNSConnections: (...a: unknown[]) => listDNSConnections(...a),
  getWorkspaceIngress: (...a: unknown[]) => getWorkspaceIngress(...a),
}));

const { Domains } = await import('./Domains');

function domain(over: Partial<Domain> = {}): Domain {
  return {
    id: 'dom-api',
    hostname: 'api.example.com',
    url: 'https://api.example.com',
    service_id: 'svc-api',
    node_id: 'node-1',
    target_port: 3000,
    state: 'pending_dns',
    state_detail: 'Waiting for DNS to point here.',
    serving: false,
    tls_state: 'pending',
    dns_mode: 'manual',
    record: { type: 'A', name: 'api', value: '203.0.113.10', ttl: 'Auto' },
    created_at: '2026-09-07T10:00:00Z',
    ...over,
  } as Domain;
}

/** Two Services on one server, each answering on its own hostname. */
const apiDomain = domain();
const webDomain = domain({
  id: 'dom-web',
  hostname: 'web.example.com',
  url: 'https://web.example.com',
  service_id: 'svc-web',
  target_port: 8080,
  state: 'active',
  state_detail: 'Serving.',
  serving: true,
  tls_state: 'active',
  dns_checked_at: '2026-09-08T09:00:00Z',
  dns_observed: '203.0.113.10',
});

const services = [
  { id: 'svc-api', name: 'api', node_id: 'node-1' } as Service,
  { id: 'svc-web', name: 'web', node_id: 'node-1' } as Service,
];
const nodes = [{ id: 'node-1', name: 'shared-box' } as Node];

function drift(over: Partial<RouteDrift> = {}): RouteDrift {
  return {
    node_id: 'node-1',
    missing: [],
    unmanaged: [],
    healthy: true,
    summary: 'Every domain SlideOps manages on this server is routed.',
    ...over,
  };
}

function show(entry = '/app/domains') {
  return renderInApp(
    <MemoryRouter initialEntries={[entry]}>
      <Domains />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const fn of [
    listWorkspaceDomains,
    listServices,
    listNodes,
    verifyDomain,
    provisionDomain,
    removeDomain,
    inspectNodeRoutes,
    repairNodeRoutes,
    listDNSConnections,
    getWorkspaceIngress,
  ]) {
    fn.mockReset();
  }
  listWorkspaceDomains.mockResolvedValue([apiDomain, webDomain]);
  listServices.mockResolvedValue(services);
  listNodes.mockResolvedValue(nodes);
  inspectNodeRoutes.mockResolvedValue(drift());
  listDNSConnections.mockResolvedValue([]);
  getWorkspaceIngress.mockResolvedValue({
    node_id: 'node-1',
    public_address: '203.0.113.10',
    enabled: false,
    drifted: false,
  });
  useWorkspaceStore.setState({
    workspaces: [{ id: 'ws-1', name: 'W', role: 'owner', active: true } as never],
  });
});

describe('Domains and DNS', () => {
  // Several Services routinely share one server, and no other screen answers
  // which hostname belongs to which of them.
  it('shows two Services on one server, each with its own hostname and its own Service named', async () => {
    show();

    expect(await screen.findByText('api.example.com')).toBeInTheDocument();
    expect(screen.getByText('web.example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'api' })).toHaveAttribute(
      'href',
      '/app/services/svc-api',
    );
    expect(screen.getByRole('link', { name: 'web' })).toHaveAttribute(
      'href',
      '/app/services/svc-web',
    );
  });

  it('gathers both of that server’s hostnames under the one server it is grouped by', async () => {
    show();
    await screen.findByText('api.example.com');

    expect(screen.getByRole('heading', { name: 'shared-box' })).toBeInTheDocument();
    expect(screen.getByText('2 domains')).toBeInTheDocument();
  });

  it('separates the same two hostnames by Service when grouped by Service', async () => {
    show();
    await screen.findByText('api.example.com');

    await userEvent.selectOptions(screen.getByLabelText('Group by'), 'service');
    expect(screen.getByRole('heading', { name: 'api' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'web' })).toBeInTheDocument();
  });

  it('narrows the list to the hostnames matching what was searched for', async () => {
    show();
    await screen.findByText('api.example.com');

    await userEvent.type(screen.getByLabelText('Search domains'), 'web');
    expect(screen.queryByText('api.example.com')).not.toBeInTheDocument();
    expect(screen.getByText('web.example.com')).toBeInTheDocument();
  });

  it('narrows the list to one status when a status is chosen', async () => {
    show();
    await screen.findByText('api.example.com');

    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'active');
    expect(screen.getByText('web.example.com')).toBeInTheDocument();
    expect(screen.queryByText('api.example.com')).not.toBeInTheDocument();
  });

  // A deep link from a Service page should land already narrowed to it.
  it('opens narrowed to the Service a deep link named', async () => {
    show('/app/domains?service=svc-web');

    expect(await screen.findByText('web.example.com')).toBeInTheDocument();
    expect(screen.queryByText('api.example.com')).not.toBeInTheDocument();
  });

  it('reads DNS as the expected target beside the one that answered', async () => {
    show();
    await screen.findByText('web.example.com');

    expect(screen.getByText('Expected 203.0.113.10, found 203.0.113.10.')).toBeInTheDocument();
    // Never checked is a real answer, and quieter than pretending it is fine.
    expect(
      screen.getByText('Expected 203.0.113.10. Nothing has looked this name up yet.'),
    ).toBeInTheDocument();
  });

  it('shows a missing route as what was expected against what was found', async () => {
    inspectNodeRoutes.mockResolvedValue(
      drift({
        missing: ['api.example.com'],
        healthy: false,
        summary: '1 domain is missing a route on this server.',
      }),
    );
    show();

    expect(await screen.findByText('a route for api.example.com')).toBeInTheDocument();
    expect(screen.getByText('no route on shared-box')).toBeInTheDocument();
  });

  it('never puts a missing route back until the Operator presses it', async () => {
    inspectNodeRoutes.mockResolvedValue(
      drift({ missing: ['api.example.com'], healthy: false, summary: 'x' }),
    );
    repairNodeRoutes.mockResolvedValue(drift());
    show();

    const repair = await screen.findByRole('button', { name: 'Put back the missing routes' });
    expect(repairNodeRoutes).not.toHaveBeenCalled();
    await userEvent.click(repair);
    await waitFor(() => expect(repairNodeRoutes).toHaveBeenCalledWith('node-1'));
  });

  it('says a server SlideOps did not set up is left alone and is left out of the summary', async () => {
    inspectNodeRoutes.mockResolvedValue(
      drift({ unmanaged: ['blog.operators-own.com'], summary: 'x' }),
    );
    show();

    expect(await screen.findByText('blog.operators-own.com')).toBeInTheDocument();
    expect(screen.getByText(/left out of the summary above on purpose/i)).toBeInTheDocument();
  });

  it('says what checking DNS will do, and does not check until it is pressed', async () => {
    verifyDomain.mockResolvedValue(apiDomain);
    show();
    await screen.findByText('api.example.com');

    expect(screen.getByText(/Nothing on any server changes/i)).toBeInTheDocument();
    expect(verifyDomain).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Check DNS now' }));
    await waitFor(() => expect(verifyDomain).toHaveBeenCalledWith('dom-api'));
  });

  // The backend's reason is the only thing that knows why, so it is shown as it
  // came rather than replaced with a generic failure.
  it('shows the backend refusal in its own words when an action is refused', async () => {
    listWorkspaceDomains.mockResolvedValue([domain({ state: 'dns_verified' })]);
    provisionDomain.mockRejectedValue(
      new ApiError(409, 'dns_not_ready', 'DNS for api.example.com does not resolve here yet.'),
    );
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Put it live' }));
    expect(
      await screen.findByText('DNS for api.example.com does not resolve here yet.'),
    ).toBeInTheDocument();
  });

  it('shows the error when the domain list could not be read, instead of an empty page', async () => {
    listWorkspaceDomains.mockRejectedValue(
      new ApiError(503, 'unavailable', 'The domain service is not answering.'),
    );
    show();

    const note = await screen.findByRole('alert');
    expect(within(note).getByText('The domain service is not answering.')).toBeInTheDocument();
    expect(screen.queryByText(/No domains in this Workspace yet/)).not.toBeInTheDocument();
  });

  // There is no standalone certificate call, so the remediation is honest about
  // what pressing it actually runs.
  it('offers a failed certificate the provisioning run that issues one, and says so', async () => {
    listWorkspaceDomains.mockResolvedValue([
      domain({
        state: 'active',
        serving: true,
        tls_state: 'failed',
        last_error: 'The certificate authority refused the challenge.',
      }),
    ]);
    show();

    expect(await screen.findByText(/no separate certificate retry/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run provisioning again' })).toBeInTheDocument();
  });

  it('warns before removing that the DNS record is not touched', async () => {
    show();
    await screen.findByText('api.example.com');

    const [firstRemove] = screen.getAllByRole('button', { name: 'Remove' });
    await userEvent.click(firstRemove as HTMLElement);
    expect(await screen.findByText(/no DNS record is touched/i)).toBeInTheDocument();
    expect(removeDomain).not.toHaveBeenCalled();
  });
});
