import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Domain, Service } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const listServiceDomains = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listServiceDomains: (...a: unknown[]) => listServiceDomains(...a),
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

function show() {
  return renderInApp(
    <MemoryRouter>
      <ServiceDomains service={service()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listServiceDomains.mockReset();
  listServiceDomains.mockResolvedValue([]);
});

describe('ServiceDomains', () => {
  // The whole point is that this is a Service setting rather than server
  // administration, so the words that would make it the latter must not appear.
  it('never asks the Operator to understand the infrastructure', async () => {
    listServiceDomains.mockResolvedValue([domain()]);
    const { container } = show();

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
    show();

    await screen.findByText('api.example.com');
    expect(screen.getByText('Type')).toBeInTheDocument();
    // The label a registrar's form asks for, not the whole hostname.
    expect(screen.getByText('api')).toBeInTheDocument();
    expect(screen.getByText('203.0.113.10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy the value/i })).toBeInTheDocument();
  });

  it('reads DNS as expected against found rather than as a verdict', async () => {
    listServiceDomains.mockResolvedValue([
      domain({ dns_observed: '198.51.100.7', dns_checked_at: '2026-09-07T11:00:00Z' }),
    ]);
    show();

    expect(
      await screen.findByText(/Expected 203.0.113.10, found 198.51.100.7/),
    ).toBeInTheDocument();
  });

  // Adding, checking and provisioning moved to one page. What must not happen is
  // this tab quietly keeping a second copy of them.
  it('offers no way to change a domain, only the way to the page that does', async () => {
    listServiceDomains.mockResolvedValue([domain()]);
    show();

    await screen.findByText('api.example.com');
    for (const gone of ['Add domain', 'Check DNS', 'Put it live', 'Remove']) {
      expect(screen.queryByRole('button', { name: gone })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Manage domains and DNS/ })).toHaveAttribute(
      'href',
      '/app/domains?service=svc-1',
    );
  });

  it('links a serving domain at its https address', async () => {
    listServiceDomains.mockResolvedValue([
      domain({ state: 'active', state_detail: 'Serving.', serving: true, tls_state: 'active' }),
    ]);
    show();

    const link = await screen.findByRole('link', { name: 'api.example.com' });
    expect(link).toHaveAttribute('href', 'https://api.example.com');
  });

  it('tells an empty Service what a domain would give it', async () => {
    show();
    expect(
      await screen.findByText(/reachable at\s+a name instead of an address and a port/i),
    ).toBeInTheDocument();
  });
});
