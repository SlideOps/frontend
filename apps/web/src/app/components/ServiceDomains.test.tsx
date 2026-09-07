import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Domain, Service } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const listServiceDomains = vi.fn();
const addServiceDomain = vi.fn();
const verifyDomain = vi.fn();
const provisionDomain = vi.fn();
const removeDomain = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listServiceDomains: (...a: unknown[]) => listServiceDomains(...a),
  addServiceDomain: (...a: unknown[]) => addServiceDomain(...a),
  verifyDomain: (...a: unknown[]) => verifyDomain(...a),
  provisionDomain: (...a: unknown[]) => provisionDomain(...a),
  removeDomain: (...a: unknown[]) => removeDomain(...a),
}));

const { ServiceDomains } = await import('./ServiceDomains');

function service(): Service {
  return { id: 'svc-1', name: 'api', runtime: 'container', status: 'running' } as Service;
}

function domain(over: Partial<Domain> = {}): Domain {
  return {
    id: 'dom-1',
    hostname: 'api.example.com',
    url: 'https://api.example.com',
    service_id: 'svc-1',
    target_port: 3000,
    state: 'pending_dns',
    state_detail: 'Waiting for DNS to point at SlideOps.',
    serving: false,
    tls_state: 'pending',
    dns_mode: 'manual',
    record: { type: 'A', name: 'api', value: '203.0.113.10', ttl: 'Auto' },
    created_at: '2026-09-07T10:00:00Z',
    ...over,
  } as Domain;
}

beforeEach(() => {
  for (const fn of [
    listServiceDomains,
    addServiceDomain,
    verifyDomain,
    provisionDomain,
    removeDomain,
  ]) {
    fn.mockReset();
  }
  listServiceDomains.mockResolvedValue([]);
});

describe('ServiceDomains', () => {
  // The whole point is that this is a Service setting rather than server
  // administration, so the words that would make it the latter must not appear.
  it('never asks the Operator to understand the infrastructure', async () => {
    listServiceDomains.mockResolvedValue([domain()]);
    const { container } = renderInApp(<ServiceDomains service={service()} />);

    await screen.findByText('api.example.com');
    const text = container.textContent ?? '';
    for (const leaked of [
      'nginx',
      'Caddy',
      'reverse proxy',
      'upstream',
      'certificate authority',
      '172.17',
    ]) {
      expect(text.toLowerCase()).not.toContain(leaked.toLowerCase());
    }
  });

  it('shows the exact record to create, each part copyable on its own', async () => {
    listServiceDomains.mockResolvedValue([domain()]);
    renderInApp(<ServiceDomains service={service()} />);

    await screen.findByText('api.example.com');
    expect(screen.getByText('Type')).toBeInTheDocument();
    // The label a registrar's form asks for, not the whole hostname.
    expect(screen.getByText('api')).toBeInTheDocument();
    expect(screen.getByText('203.0.113.10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy the value/i })).toBeInTheDocument();
  });

  it('says where the hostname currently resolves when it points elsewhere', async () => {
    listServiceDomains.mockResolvedValue([
      domain({ dns_observed: '198.51.100.7', last_error: 'resolves to 198.51.100.7' }),
    ]);
    renderInApp(<ServiceDomains service={service()} />);

    expect(await screen.findByText(/Currently resolves to 198.51.100.7/)).toBeInTheDocument();
  });

  it('adds a domain with the port the application listens on', async () => {
    addServiceDomain.mockResolvedValue(domain());
    renderInApp(<ServiceDomains service={service()} />);

    await userEvent.type(await screen.findByLabelText('Add a domain'), 'api.example.com');
    await userEvent.type(screen.getByLabelText(/Port your application listens on/), '3000');
    await userEvent.click(screen.getByRole('button', { name: 'Add domain' }));

    await waitFor(() =>
      expect(addServiceDomain).toHaveBeenCalledWith('svc-1', 'api.example.com', 3000),
    );
  });

  // Publishing the port to the internet is exactly what this replaces, so the
  // form has to say the visitor never uses it.
  it('says the port does not need publishing', async () => {
    renderInApp(<ServiceDomains service={service()} />);
    expect(await screen.findByText(/you do not need to publish it/i)).toBeInTheDocument();
  });

  it('offers Check DNS while waiting, and Put it live once DNS points here', async () => {
    listServiceDomains.mockResolvedValue([domain()]);
    const { unmount } = renderInApp(<ServiceDomains service={service()} />);
    expect(await screen.findByRole('button', { name: /Check DNS/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Put it live' })).not.toBeInTheDocument();
    unmount();

    listServiceDomains.mockResolvedValue([
      domain({ state: 'dns_verified', state_detail: 'DNS points here. Setting up routing.' }),
    ]);
    renderInApp(<ServiceDomains service={service()} />);
    expect(await screen.findByRole('button', { name: 'Put it live' })).toBeInTheDocument();
  });

  it('links a serving domain at its https address', async () => {
    listServiceDomains.mockResolvedValue([
      domain({ state: 'active', state_detail: 'Serving.', serving: true, tls_state: 'active' }),
    ]);
    renderInApp(<ServiceDomains service={service()} />);

    const link = await screen.findByRole('link', { name: 'api.example.com' });
    expect(link).toHaveAttribute('href', 'https://api.example.com');
  });

  // Removing a domain does not remove the DNS record, and the Operator is the
  // only one who can do that, so they have to be told.
  it('warns what removing does and does not do, before removing', async () => {
    listServiceDomains.mockResolvedValue([domain()]);
    renderInApp(<ServiceDomains service={service()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(await screen.findByText(/no DNS record is touched/i)).toBeInTheDocument();
    expect(removeDomain).not.toHaveBeenCalled();
  });

  it('tells an empty Service what a domain would give it', async () => {
    renderInApp(<ServiceDomains service={service()} />);
    expect(
      await screen.findByText(/reachable at a name instead of an address and a port/i),
    ).toBeInTheDocument();
  });
});
