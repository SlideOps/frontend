import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Domain, Node, ServerDomain } from '@slideops/api-client';
import { ApiError } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * A Server Domain is a namespace, not a route: adding one must never claim a
 * hostname, write a route, or request a certificate by itself. These tests
 * hold that boundary, alongside the ordinary add/remove/role-gating behavior
 * every other domain surface already has.
 */

const listServerDomains = vi.fn();
const addServerDomain = vi.fn();
const removeServerDomain = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listServerDomains: (...a: unknown[]) => listServerDomains(...a),
  addServerDomain: (...a: unknown[]) => addServerDomain(...a),
  removeServerDomain: (...a: unknown[]) => removeServerDomain(...a),
}));

const { ServerDomains } = await import('./ServerDomains');

const node = { id: 'node-1', name: 'shared-box' } as Node;

function serverDomain(over: Partial<ServerDomain> = {}): ServerDomain {
  return {
    id: 'sd-1',
    node_id: 'node-1',
    domain: 'mycompany.com',
    created_at: '2026-09-07T10:00:00Z',
    ...over,
  };
}

function boundDomain(over: Partial<Domain> = {}): Domain {
  return {
    id: 'dom-1',
    hostname: 'frc.mycompany.com',
    url: 'https://frc.mycompany.com',
    service_id: 'svc-frc',
    node_id: 'node-1',
    target_port: 3000,
    target_scheme: 'http',
    needs_reapply: false,
    state: 'active',
    state_detail: 'Serving.',
    serving: true,
    tls_state: 'active',
    dns_mode: 'manual',
    record: { type: 'A', name: 'frc', value: '203.0.113.10', ttl: 'Auto' },
    created_at: '2026-09-07T10:00:00Z',
    cert_method: 'http01',
    server_domain_id: 'sd-1',
    ...over,
  } as Domain;
}

function show(over: { canAdminister?: boolean; domains?: Domain[] } = {}) {
  return renderInApp(
    <ServerDomains
      node={node}
      domains={over.domains ?? []}
      canAdminister={over.canAdminister ?? true}
    />,
  );
}

beforeEach(() => {
  for (const fn of [listServerDomains, addServerDomain, removeServerDomain]) {
    fn.mockReset();
  }
  listServerDomains.mockResolvedValue([]);
});

describe('ServerDomains', () => {
  it('says a server has no Server Domain yet', async () => {
    show();
    expect(await screen.findByText('No Server Domains yet')).toBeInTheDocument();
  });

  it('lists the Server Domains already added to this server', async () => {
    listServerDomains.mockResolvedValue([serverDomain()]);
    show();
    expect(await screen.findByText('mycompany.com')).toBeInTheDocument();
  });

  it('says how many hostnames claim a namespace, and says plainly when none do', async () => {
    listServerDomains.mockResolvedValue([serverDomain()]);
    show({ domains: [boundDomain(), boundDomain({ id: 'dom-2', hostname: 'api.mycompany.com' })] });

    expect(await screen.findByText('2 hostnames claim this namespace.')).toBeInTheDocument();
  });

  it('says no hostname has claimed it yet, when none have', async () => {
    listServerDomains.mockResolvedValue([serverDomain()]);
    show({ domains: [] });

    expect(await screen.findByText('No hostname claimed under it yet.')).toBeInTheDocument();
  });

  it('adds a domain as a namespace, and that alone -- no hostname, route, or certificate', async () => {
    addServerDomain.mockResolvedValue(serverDomain());
    show();

    await userEvent.type(screen.getByLabelText(/Add a domain as a namespace/i), 'mycompany.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(addServerDomain).toHaveBeenCalledWith('node-1', 'mycompany.com'));
  });

  it('shows the backend refusal in its own words when adding fails', async () => {
    addServerDomain.mockRejectedValue(
      new ApiError(409, 'domain_taken', 'this server already has that domain as a namespace'),
    );
    show();

    await userEvent.type(screen.getByLabelText(/Add a domain as a namespace/i), 'mycompany.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      await screen.findByText('this server already has that domain as a namespace'),
    ).toBeInTheDocument();
  });

  it('asks for confirmation before removing a namespace, and says what stays untouched', async () => {
    listServerDomains.mockResolvedValue([serverDomain()]);
    show();

    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText(/keeps its route, its DNS record, and its certificate/i),
    ).toBeInTheDocument();
    expect(removeServerDomain).not.toHaveBeenCalled();

    // The dialog's own confirm button is a second "Remove", after the row's own
    // trigger in the DOM.
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await userEvent.click(removeButtons[removeButtons.length - 1] as HTMLElement);
    await waitFor(() => expect(removeServerDomain).toHaveBeenCalledWith('sd-1'));
  });

  it('offers no add form and no remove button to anyone but the Owner or an Admin', async () => {
    listServerDomains.mockResolvedValue([serverDomain()]);
    show({ canAdminister: false });

    await screen.findByText('mycompany.com');
    expect(screen.queryByLabelText(/Add a domain as a namespace/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(screen.getByText(/requires the Owner or an Admin/i)).toBeInTheDocument();
  });
});
