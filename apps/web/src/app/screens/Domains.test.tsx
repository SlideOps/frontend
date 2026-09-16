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
const listServerDomains = vi.fn();

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
  listServerDomains: (...a: unknown[]) => listServerDomains(...a),
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
    cert_method: 'http01',
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

/** Every test below that exercises a specific tab's content opens it this way,
 *  matching how an Operator actually gets there rather than asserting on
 *  internal tab state. */
async function openTab(label: string) {
  await userEvent.click(await screen.findByRole('tab', { name: label }));
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
    listServerDomains,
  ]) {
    fn.mockReset();
  }
  listWorkspaceDomains.mockResolvedValue([apiDomain, webDomain]);
  listServices.mockResolvedValue(services);
  listNodes.mockResolvedValue(nodes);
  inspectNodeRoutes.mockResolvedValue(drift());
  listDNSConnections.mockResolvedValue([]);
  listServerDomains.mockResolvedValue([]);
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

describe('Domains and DNS: the tabbed shell', () => {
  it('opens on Overview by default', async () => {
    show();
    expect(await screen.findByRole('tab', { name: 'Overview', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
  });

  it('switches what is shown when a different tab is chosen, without a full reload', async () => {
    show();
    await screen.findByRole('tab', { name: 'Overview', selected: true });

    await openTab('Domains');
    expect(await screen.findByText('api.example.com')).toBeInTheDocument();
    expect(listWorkspaceDomains).toHaveBeenCalledTimes(1);

    await openTab('Servers');
    expect(await screen.findByRole('heading', { name: 'Server Domains' })).toBeInTheDocument();
    expect(listWorkspaceDomains).toHaveBeenCalledTimes(1);
  });

  // A link from a Service or a Node page always promised the filtered list
  // that used to be the whole page; that promise holds even though the page
  // now opens on a summary by default.
  it('opens straight on the Domains tab when a Service or Node deep link named one', async () => {
    show('/app/domains?service=svc-web');
    expect(await screen.findByRole('tab', { name: 'Domains', selected: true })).toBeInTheDocument();
    expect(await screen.findByText('web.example.com')).toBeInTheDocument();
    expect(screen.queryByText('api.example.com')).not.toBeInTheDocument();
  });

  it('opens directly on a tab named in the URL, for a link or a reload', async () => {
    show('/app/domains?tab=certificates');
    expect(
      await screen.findByRole('tab', { name: 'Certificates', selected: true }),
    ).toBeInTheDocument();
  });
});

describe('Overview', () => {
  it('counts every domain and says how many are serving', async () => {
    show();
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 serving')).toBeInTheDocument();
  });

  it('lists a domain that is not serving as something that needs attention', async () => {
    show();
    expect(await screen.findByRole('link', { name: 'api.example.com' })).toHaveAttribute(
      'href',
      '/app/domains/dom-api',
    );
  });

  it('says everything is serving when nothing needs attention', async () => {
    listWorkspaceDomains.mockResolvedValue([webDomain]);
    show();
    expect(await screen.findByText('Every domain in this Workspace is serving.')).toBeInTheDocument();
  });

  it('opens the Domains tab from its own summary card', async () => {
    show();
    await userEvent.click(await screen.findByText('Domains'));
    expect(await screen.findByRole('tab', { name: 'Domains', selected: true })).toBeInTheDocument();
  });
});

describe('Services', () => {
  it('shows which hostnames belong to which Service', async () => {
    show();
    await openTab('Services');

    const apiCard = (await screen.findByRole('link', { name: 'api' })).closest('.rounded-md');
    expect(within(apiCard as HTMLElement).getByText('api.example.com')).toBeInTheDocument();
  });

  it('says a Service has no hostname yet, rather than showing nothing', async () => {
    listWorkspaceDomains.mockResolvedValue([]);
    show();
    await openTab('Services');

    expect(await screen.findAllByText(/No hostname yet/i)).toHaveLength(2);
  });

  // A Capability Service is infrastructure a Project depends on -- a
  // database, a cache -- and is never what a hostname points at. Listing it
  // here would be a row that can only ever say "no hostname yet" and never
  // explain why, so it never appears.
  it('never lists a Capability Service, only what was deployed as software', async () => {
    listServices.mockResolvedValue([
      ...services,
      { id: 'svc-db', name: 'primary-db', node_id: 'node-1', deployment_type: 'capability' } as Service,
    ]);
    show();
    await openTab('Services');

    await screen.findByRole('link', { name: 'api' });
    expect(screen.queryByRole('link', { name: 'primary-db' })).not.toBeInTheDocument();
  });
});

describe('Servers', () => {
  it('lists a Server Domain under the server it namespaces, once added', async () => {
    listServerDomains.mockResolvedValue([
      { id: 'sd-1', node_id: 'node-1', domain: 'mycompany.com', created_at: '2026-09-07T10:00:00Z' },
    ]);
    show();
    await openTab('Servers');

    const section = (
      await screen.findByRole('heading', { name: 'Server Domains' })
    ).closest('section') as HTMLElement;
    expect(within(section).getByText('mycompany.com')).toBeInTheDocument();
    expect(within(section).getByText(nodes[0]?.name as string)).toBeInTheDocument();
  });

  it('says a server has no Server Domain yet, without implying anything is broken', async () => {
    show();
    await openTab('Servers');

    const section = (
      await screen.findByRole('heading', { name: 'Server Domains' })
    ).closest('section') as HTMLElement;
    expect(within(section).getByText('No Server Domains yet')).toBeInTheDocument();
  });

  it('says adding one assigns nothing to a Service automatically', async () => {
    show();
    await openTab('Servers');
    expect(await screen.findByText(/assigns it to nothing automatically/i)).toBeInTheDocument();
  });
});

describe('Domains', () => {
  // Several Services routinely share one server, and no other screen answers
  // which hostname belongs to which of them.
  it('shows two Services on one server, each with its own hostname and its own Service named', async () => {
    show('/app/domains?tab=domains');

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
    show('/app/domains?tab=domains');
    await screen.findByText('api.example.com');

    expect(screen.getByRole('heading', { name: 'shared-box' })).toBeInTheDocument();
    expect(screen.getByText('2 domains')).toBeInTheDocument();
  });

  it('separates the same two hostnames by Service when grouped by Service', async () => {
    show('/app/domains?tab=domains');
    await screen.findByText('api.example.com');

    await userEvent.selectOptions(screen.getByLabelText('Group by'), 'service');
    expect(screen.getByRole('heading', { name: 'api' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'web' })).toBeInTheDocument();
  });

  it('narrows the list to the hostnames matching what was searched for', async () => {
    show('/app/domains?tab=domains');
    await screen.findByText('api.example.com');

    await userEvent.type(screen.getByLabelText('Search domains'), 'web');
    expect(screen.queryByText('api.example.com')).not.toBeInTheDocument();
    expect(screen.getByText('web.example.com')).toBeInTheDocument();
  });

  it('narrows the list to one status when a status is chosen', async () => {
    show('/app/domains?tab=domains');
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
    show('/app/domains?tab=domains');
    await screen.findByText('web.example.com');

    expect(screen.getByText('Expected 203.0.113.10, found 203.0.113.10.')).toBeInTheDocument();
    // Never checked is a real answer, and quieter than pretending it is fine.
    expect(
      screen.getByText('Expected 203.0.113.10. Nothing has looked this name up yet.'),
    ).toBeInTheDocument();
  });

  it('says what checking DNS will do, and does not check until it is pressed', async () => {
    verifyDomain.mockResolvedValue(apiDomain);
    show('/app/domains?tab=domains');
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
    show('/app/domains?tab=domains');

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
    show('/app/domains?tab=domains');

    expect(await screen.findByText(/no separate certificate retry/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run provisioning again' })).toBeInTheDocument();
  });

  it('warns before removing that the DNS record is not touched', async () => {
    show('/app/domains?tab=domains');
    await screen.findByText('api.example.com');

    const [firstRemove] = screen.getAllByRole('button', { name: 'Remove' });
    await userEvent.click(firstRemove as HTMLElement);
    expect(await screen.findByText(/no DNS record is touched/i)).toBeInTheDocument();
    expect(removeDomain).not.toHaveBeenCalled();
  });

  it('opens the Add a domain flow from the page header on any tab', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Add a domain' }));

    expect(await screen.findByRole('tab', { name: 'Domains', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add a domain' })).toBeInTheDocument();
  });
});

describe('Cloudflare', () => {
  it('shows Cloudflare credential management, and only that', async () => {
    show();
    await openTab('Cloudflare');

    expect(
      await screen.findByText(/only ever changes or removes records it created itself/i),
    ).toBeInTheDocument();
  });
});

describe('DNS', () => {
  it('shows every hostname’s DNS state and its record together', async () => {
    show();
    await openTab('DNS');

    expect(await screen.findByText('api.example.com')).toBeInTheDocument();
    expect(screen.getByText('web.example.com')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Check DNS now' })).toHaveLength(2);
  });

  it('checks one hostname without touching the others, and re-reads on success', async () => {
    verifyDomain.mockResolvedValue(apiDomain);
    show();
    await openTab('DNS');

    const [firstCheck] = await screen.findAllByRole('button', { name: 'Check DNS now' });
    await userEvent.click(firstCheck as HTMLElement);
    await waitFor(() => expect(verifyDomain).toHaveBeenCalledWith('dom-api'));
    expect(verifyDomain).toHaveBeenCalledTimes(1);
    // Re-reading the whole list is how the fresh reading gets on screen.
    await waitFor(() => expect(listWorkspaceDomains).toHaveBeenCalledTimes(2));
  });

  it('shows the backend refusal in its own words when a check fails', async () => {
    verifyDomain.mockRejectedValue(new ApiError(502, 'dns_lookup_failed', 'The resolver did not answer.'));
    show();
    await openTab('DNS');

    const [firstCheck] = await screen.findAllByRole('button', { name: 'Check DNS now' });
    await userEvent.click(firstCheck as HTMLElement);
    expect(await screen.findByText('The resolver did not answer.')).toBeInTheDocument();
  });
});

describe('Certificates', () => {
  it('shows every hostname’s certificate state and method together', async () => {
    show();
    await openTab('Certificates');

    expect(await screen.findByText('api.example.com')).toBeInTheDocument();
    expect(screen.getAllByText('HTTP-01').length).toBeGreaterThan(0);
  });

  it('flags a proxied hostname still left on HTTP-01', async () => {
    listWorkspaceDomains.mockResolvedValue([
      domain({ proxy_mode: 'proxied', cert_method: 'http01' }),
    ]);
    show();
    await openTab('Certificates');

    expect(
      await screen.findByText(/1 hostname is proxied but still set to HTTP-01/i),
    ).toBeInTheDocument();
  });
});

describe('Routing', () => {
  it('shows the entry-point configuration, not the Cloudflare credential', async () => {
    show();
    await openTab('Routing');

    expect(
      await screen.findByText(/All public traffic for this Workspace passes through it/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/only ever changes or removes records it created itself/i),
    ).not.toBeInTheDocument();
  });
});

describe('Diagnostics', () => {
  it('shows a missing route as what was expected against what was found', async () => {
    inspectNodeRoutes.mockResolvedValue(
      drift({
        missing: ['api.example.com'],
        healthy: false,
        summary: '1 domain is missing a route on this server.',
      }),
    );
    show();
    await openTab('Diagnostics');

    expect(await screen.findByText('a route for api.example.com')).toBeInTheDocument();
    expect(screen.getByText('no route on shared-box')).toBeInTheDocument();
  });

  it('never puts a missing route back until the Operator presses it', async () => {
    inspectNodeRoutes.mockResolvedValue(
      drift({ missing: ['api.example.com'], healthy: false, summary: 'x' }),
    );
    repairNodeRoutes.mockResolvedValue(drift());
    show();
    await openTab('Diagnostics');

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
    await openTab('Diagnostics');

    expect(await screen.findByText('blog.operators-own.com')).toBeInTheDocument();
    expect(screen.getByText(/left out of the summary above on purpose/i)).toBeInTheDocument();
  });

  it('lists every hostname’s four states, problems first', async () => {
    show();
    await openTab('Diagnostics');

    const rows = await screen.findAllByRole('link', { name: /example\.com/ });
    expect(rows[0]).toHaveTextContent('api.example.com');
  });

  it('offers the same remediation the Domains tab offers, from here as well', async () => {
    verifyDomain.mockResolvedValue(apiDomain);
    show();
    await openTab('Diagnostics');

    await userEvent.click(await screen.findByRole('button', { name: 'Check DNS now' }));
    await waitFor(() => expect(verifyDomain).toHaveBeenCalledWith('dom-api'));
  });
});
