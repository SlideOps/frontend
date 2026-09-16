import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Domain, Node, Service, ServerDomain } from '@slideops/api-client';
import { ApiError } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const addServiceDomain = vi.fn();
const verifyDomain = vi.fn();
const provisionDomain = vi.fn();
const listServiceDomains = vi.fn();
const listServerDomains = vi.fn();
const updateDomain = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  addServiceDomain: (...a: unknown[]) => addServiceDomain(...a),
  verifyDomain: (...a: unknown[]) => verifyDomain(...a),
  provisionDomain: (...a: unknown[]) => provisionDomain(...a),
  listServiceDomains: (...a: unknown[]) => listServiceDomains(...a),
  listServerDomains: (...a: unknown[]) => listServerDomains(...a),
  updateDomain: (...a: unknown[]) => updateDomain(...a),
}));

const { AddDomainStepper } = await import('./AddDomainStepper');

const services = [
  { id: 'svc-api', name: 'api', node_id: 'node-1' } as Service,
  { id: 'svc-web', name: 'web', node_id: 'node-1' } as Service,
];
const nodes = [{ id: 'node-1', name: 'shared-box' } as Node];

function domain(over: Partial<Domain> = {}): Domain {
  return {
    id: 'dom-1',
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

function show() {
  return renderInApp(
    <AddDomainStepper services={services} nodes={nodes} onFinished={() => {}} onCancel={() => {}} />,
  );
}

/** Walk as far as the DNS check, which is where the interesting rules live. */
async function walkToTheDNSCheck() {
  show();
  await userEvent.selectOptions(screen.getByLabelText('Service'), 'svc-api');
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await userEvent.type(screen.getByLabelText('Hostname'), 'api.example.com');
  await userEvent.type(screen.getByLabelText(/Port your application listens on/), '3000');
  await userEvent.click(screen.getByRole('button', { name: 'Claim the hostname' }));
  await screen.findByRole('button', { name: 'The record is created' });
  await userEvent.click(screen.getByRole('button', { name: 'The record is created' }));
}

beforeEach(() => {
  for (const fn of [
    addServiceDomain,
    verifyDomain,
    provisionDomain,
    listServiceDomains,
    listServerDomains,
    updateDomain,
  ]) {
    fn.mockReset();
  }
  addServiceDomain.mockResolvedValue(domain());
  listServiceDomains.mockResolvedValue([domain()]);
  listServerDomains.mockResolvedValue([]);
});

describe('AddDomainStepper', () => {
  it('says a domain belongs to a Service and that the server follows from it', () => {
    show();
    expect(
      screen.getByText(/The server follows from the Service, so there is no separate server/i),
    ).toBeInTheDocument();
  });

  it('names the server the chosen Service already runs on', async () => {
    show();
    await userEvent.selectOptions(screen.getByLabelText('Service'), 'svc-api');
    expect(screen.getByText(/api runs on shared-box/)).toBeInTheDocument();
  });

  it('will not let the journey start before a Service has been chosen', () => {
    show();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  // Nothing is applied by arriving at a step: the first call of any kind is the
  // one the Operator presses.
  it('calls nothing until the Operator claims the hostname', async () => {
    show();
    await userEvent.selectOptions(screen.getByLabelText('Service'), 'svc-api');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(addServiceDomain).not.toHaveBeenCalled();
    expect(verifyDomain).not.toHaveBeenCalled();
    expect(provisionDomain).not.toHaveBeenCalled();
  });

  it('says what claiming the hostname will and will not do before it is claimed', async () => {
    show();
    await userEvent.selectOptions(screen.getByLabelText('Service'), 'svc-api');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      screen.getByText(/No port is opened, no route is written, and no certificate is requested/i),
    ).toBeInTheDocument();
  });

  it('hands over the exact record with every field copyable on its own', async () => {
    show();
    await userEvent.selectOptions(screen.getByLabelText('Service'), 'svc-api');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.type(screen.getByLabelText('Hostname'), 'api.example.com');
    await userEvent.type(screen.getByLabelText(/Port your application listens on/), '3000');
    await userEvent.click(screen.getByRole('button', { name: 'Claim the hostname' }));

    expect(await screen.findByText('203.0.113.10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy the value/i })).toBeInTheDocument();
  });

  // The property the whole stepper exists for.
  it('blocks the journey at the DNS step when the lookup found a different target', async () => {
    verifyDomain.mockResolvedValue(
      domain({ dns_checked_at: '2026-09-08T10:00:00Z', dns_observed: '198.51.100.7' }),
    );
    await walkToTheDNSCheck();

    await userEvent.click(screen.getByRole('button', { name: 'Check DNS now' }));

    expect(await screen.findByText(/Expected/)).toBeInTheDocument();
    expect(screen.getByText('198.51.100.7')).toBeInTheDocument();
    expect(screen.getByText(/DNS does not point here yet/i)).toBeInTheDocument();
    // The step that would open a port and ask for a certificate is not merely
    // disabled: it does not exist to be pressed.
    expect(screen.queryByRole('button', { name: 'Put it live' })).not.toBeInTheDocument();
    expect(provisionDomain).not.toHaveBeenCalled();
  });

  it('opens the routing step only once the lookup answered with the expected target', async () => {
    verifyDomain.mockResolvedValue(
      domain({
        state: 'dns_verified',
        state_detail: 'DNS points here.',
        dns_checked_at: '2026-09-08T10:00:00Z',
        dns_observed: '203.0.113.10',
      }),
    );
    await walkToTheDNSCheck();

    await userEvent.click(screen.getByRole('button', { name: 'Check DNS now' }));
    expect(await screen.findByRole('button', { name: 'Put it live' })).toBeInTheDocument();
  });

  it('says what putting it live will do to the server before it does it', async () => {
    verifyDomain.mockResolvedValue(
      domain({ state: 'dns_verified', dns_observed: '203.0.113.10' }),
    );
    await walkToTheDNSCheck();
    await userEvent.click(screen.getByRole('button', { name: 'Check DNS now' }));

    expect(
      await screen.findByText(/Sites already served by that server are not touched/i),
    ).toBeInTheDocument();
  });

  // The backend refuses provisioning while DNS is not ready, and its reason is
  // the only thing that knows why. Replacing it with a generic failure is what
  // sends an Operator to a terminal.
  it('shows the backend refusal in its own words rather than a generic failure', async () => {
    verifyDomain.mockResolvedValue(
      domain({ state: 'dns_verified', dns_observed: '203.0.113.10' }),
    );
    provisionDomain.mockRejectedValue(
      new ApiError(409, 'dns_not_ready', 'DNS for api.example.com does not resolve here yet.'),
    );
    await walkToTheDNSCheck();
    await userEvent.click(screen.getByRole('button', { name: 'Check DNS now' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Put it live' }));

    expect(
      await screen.findByText('DNS for api.example.com does not resolve here yet.'),
    ).toBeInTheDocument();
  });

  it('does not declare success while the hostname is not serving the Service', async () => {
    verifyDomain.mockResolvedValue(
      domain({ state: 'dns_verified', dns_observed: '203.0.113.10' }),
    );
    provisionDomain.mockResolvedValue(
      domain({
        state: 'tls_pending',
        state_detail: 'Routed. Waiting for the certificate.',
        dns_observed: '203.0.113.10',
        last_error: 'The certificate has not been issued yet.',
      }),
    );
    await walkToTheDNSCheck();
    await userEvent.click(screen.getByRole('button', { name: 'Check DNS now' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Put it live' }));

    expect(await screen.findByText('Not serving')).toBeInTheDocument();
    expect(screen.getByText('The certificate has not been issued yet.')).toBeInTheDocument();
  });

  it('re-reads the domain when asked instead of polling the backend on its own', async () => {
    verifyDomain.mockResolvedValue(
      domain({ state: 'dns_verified', dns_observed: '203.0.113.10' }),
    );
    provisionDomain.mockResolvedValue(domain({ state: 'tls_pending', dns_observed: '203.0.113.10' }));
    listServiceDomains.mockResolvedValue([
      domain({ state: 'active', serving: true, tls_state: 'active', dns_observed: '203.0.113.10' }),
    ]);
    await walkToTheDNSCheck();
    await userEvent.click(screen.getByRole('button', { name: 'Check DNS now' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Put it live' }));

    expect(listServiceDomains).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(listServiceDomains).toHaveBeenCalledWith('svc-api'));
    expect(await screen.findByRole('link', { name: 'api.example.com' })).toBeInTheDocument();
  });

  describe('building a hostname from a Server Domain', () => {
    const serverDomain = { id: 'sd-1', node_id: 'node-1', domain: 'mycompany.com' } as ServerDomain;

    it('offers no namespace toggle when the server has no Server Domain', async () => {
      listServerDomains.mockResolvedValue([]);
      show();
      await userEvent.selectOptions(screen.getByLabelText('Service'), 'svc-api');
      await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

      expect(
        screen.queryByText(/Build this from a Server Domain/i),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText('Hostname')).toBeInTheDocument();
    });

    it('builds the hostname from the Server Domain and a subdomain', async () => {
      listServerDomains.mockResolvedValue([serverDomain]);
      addServiceDomain.mockResolvedValue(domain({ hostname: 'frc.mycompany.com' }));
      show();
      await userEvent.selectOptions(screen.getByLabelText('Service'), 'svc-api');
      await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

      await userEvent.click(await screen.findByLabelText(/Build this from a Server Domain/i));
      await userEvent.selectOptions(screen.getByLabelText('Server Domain'), 'sd-1');
      await userEvent.type(screen.getByLabelText(/Subdomain/i), 'frc');
      expect(screen.getByText(/This will be frc\.mycompany\.com/)).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(/Port your application listens on/), '3000');
      await userEvent.click(screen.getByRole('button', { name: 'Claim the hostname' }));

      await waitFor(() =>
        expect(addServiceDomain).toHaveBeenCalledWith('svc-api', 'frc.mycompany.com', 3000),
      );
      // Tagging the namespace is a second, explicit write against the hostname
      // already claimed, not folded silently into the claim itself.
      await waitFor(() =>
        expect(updateDomain).toHaveBeenCalledWith('dom-1', { port: 3000, serverDomainId: 'sd-1' }),
      );
    });

    it('claims the Server Domain itself when no subdomain is given', async () => {
      listServerDomains.mockResolvedValue([serverDomain]);
      addServiceDomain.mockResolvedValue(domain({ hostname: 'mycompany.com' }));
      show();
      await userEvent.selectOptions(screen.getByLabelText('Service'), 'svc-api');
      await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

      await userEvent.click(await screen.findByLabelText(/Build this from a Server Domain/i));
      await userEvent.selectOptions(screen.getByLabelText('Server Domain'), 'sd-1');
      expect(screen.getByText(/This will be mycompany\.com/)).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(/Port your application listens on/), '3000');
      await userEvent.click(screen.getByRole('button', { name: 'Claim the hostname' }));

      await waitFor(() =>
        expect(addServiceDomain).toHaveBeenCalledWith('svc-api', 'mycompany.com', 3000),
      );
    });

    it('will not let the claim start before a Server Domain is chosen, once the toggle is on', async () => {
      listServerDomains.mockResolvedValue([serverDomain]);
      show();
      await userEvent.selectOptions(screen.getByLabelText('Service'), 'svc-api');
      await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await userEvent.click(await screen.findByLabelText(/Build this from a Server Domain/i));
      await userEvent.type(screen.getByLabelText(/Port your application listens on/), '3000');

      expect(screen.getByRole('button', { name: 'Claim the hostname' })).toBeDisabled();
      expect(addServiceDomain).not.toHaveBeenCalled();
    });
  });
});
