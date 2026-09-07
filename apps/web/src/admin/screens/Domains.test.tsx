import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminDomain } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

const listAdminDomains = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listAdminDomains: (...a: unknown[]) => listAdminDomains(...a),
}));

const { Domains } = await import('./Domains');

function domain(over: Partial<AdminDomain> = {}): AdminDomain {
  return {
    hostname: 'api.example.com',
    workspace_id: 'ws-1',
    service_id: 'svc-1',
    state: 'active',
    state_detail: 'Serving.',
    tls_state: 'active',
    serving: true,
    target_port: 3000,
    ingress_kind: 'node',
    dns_mode: 'manual',
    created_at: '2026-09-07T10:00:00Z',
    ...over,
  };
}

function show() {
  return renderInApp(
    <MemoryRouter>
      <Domains />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listAdminDomains.mockReset();
  listAdminDomains.mockResolvedValue([]);
});

describe('admin Domains', () => {
  // The four links fail separately and each has a different fix, so they are
  // four columns rather than one status.
  it('shows DNS, routing and the certificate as separate answers', async () => {
    listAdminDomains.mockResolvedValue([domain()]);
    show();

    expect(await screen.findByText('api.example.com')).toBeInTheDocument();
    expect(screen.getByText('DNS')).toBeInTheDocument();
    expect(screen.getByText('Routing')).toBeInTheDocument();
    expect(screen.getByText('Certificate')).toBeInTheDocument();
  });

  // The whole point: these two look identical under a single "failed" status and
  // need completely different fixes.
  it('tells a domain that never resolved apart from one whose certificate is missing', async () => {
    listAdminDomains.mockResolvedValue([
      domain({
        hostname: 'never-resolved.example.com',
        state: 'pending_dns',
        state_detail: 'Waiting for DNS to point at SlideOps.',
        tls_state: 'pending',
        serving: false,
      }),
      domain({
        hostname: 'no-certificate.example.com',
        state: 'degraded',
        state_detail: 'Serving, with something that needs attention.',
        tls_state: 'failed',
        serving: false,
      }),
    ]);
    show();

    await screen.findByText('never-resolved.example.com');
    expect(screen.getByText('Not resolving')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    // The one that is routed but has no certificate still reads as routed.
    expect(screen.getAllByText('Routed').length).toBeGreaterThan(0);
  });

  it('says where a hostname actually resolves when it points elsewhere', async () => {
    listAdminDomains.mockResolvedValue([
      domain({
        state: 'pending_dns',
        serving: false,
        tls_state: 'pending',
        dns_observed: '198.51.100.7',
      }),
    ]);
    show();

    expect(await screen.findByText('198.51.100.7')).toBeInTheDocument();
    expect(screen.getByText('Points elsewhere')).toBeInTheDocument();
  });

  it('shows the reason on the row, so nothing else has to be opened', async () => {
    listAdminDomains.mockResolvedValue([
      domain({
        state: 'failed',
        serving: false,
        tls_state: 'failed',
        last_error: 'Port 80 could not be opened',
      }),
    ]);
    show();

    expect(await screen.findByText('Port 80 could not be opened')).toBeInTheDocument();
  });

  it('says what it points at, including the Service port', async () => {
    listAdminDomains.mockResolvedValue([domain()]);
    show();

    expect(await screen.findByText('svc-1')).toBeInTheDocument();
    expect(screen.getByText(/port 3000/)).toBeInTheDocument();
  });

  it('has an empty state rather than a bare table', async () => {
    show();
    expect(await screen.findByText('No domains yet')).toBeInTheDocument();
  });
});
