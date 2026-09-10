import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Domain, type Node, type Service } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * One hostname, in full, and the correction that used to cost the whole domain.
 *
 * The case behind these tests is a real one: an Operator put their first live
 * domain on the wrong port, and because the port could only be set when the
 * hostname was claimed, the only way out was to remove the hostname and add it
 * again, throwing away the DNS record they had already created at their
 * registrar and the certificate that had already been issued.
 */

const getDomain = vi.fn();
const updateDomain = vi.fn();
const listServices = vi.fn();
const listNodes = vi.fn();
const verifyDomain = vi.fn();
const provisionDomain = vi.fn();
const removeDomain = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getDomain: (...a: unknown[]) => getDomain(...a),
  updateDomain: (...a: unknown[]) => updateDomain(...a),
  listServices: (...a: unknown[]) => listServices(...a),
  listNodes: (...a: unknown[]) => listNodes(...a),
  verifyDomain: (...a: unknown[]) => verifyDomain(...a),
  provisionDomain: (...a: unknown[]) => provisionDomain(...a),
  removeDomain: (...a: unknown[]) => removeDomain(...a),
}));

const { DomainDetail } = await import('./DomainDetail');

/**
 * The screen reads its id from the route and navigates on removal, so it gets a
 * real router at the entry it would actually be opened from. renderInApp
 * deliberately supplies no router: a screen that needs one should say so here,
 * where the test can control where it starts.
 */
function renderDetail() {
  return renderInApp(
    <MemoryRouter initialEntries={['/app/domains/dom-api']}>
      <Routes>
        <Route path="/app/domains/:id" element={<DomainDetail />} />
        <Route path="/app/domains" element={<div>All domains</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function domain(over: Partial<Domain> = {}): Domain {
  return {
    id: 'dom-api',
    hostname: 'api.example.com',
    url: 'https://api.example.com',
    service_id: 'svc-api',
    node_id: 'node-1',
    target_port: 3000,
    target_scheme: 'http',
    needs_reapply: false,
    state: 'active',
    state_detail: 'Serving.',
    serving: true,
    tls_state: 'active',
    dns_mode: 'manual',
    dns_observed: '203.0.113.10',
    dns_checked_at: '2026-09-09T09:00:00Z',
    record: { type: 'A', name: 'api', value: '203.0.113.10', ttl: 'Auto' },
    created_at: '2026-09-07T10:00:00Z',
    ...over,
  } as Domain;
}

const services = [{ id: 'svc-api', name: 'api', node_id: 'node-1' } as Service];
const nodes = [{ id: 'node-1', name: 'shared-box' } as Node];

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceStore.setState({
    workspaces: [{ id: 'ws-1', name: 'W', role: 'owner', active: true } as never],
  });
  listServices.mockResolvedValue(services);
  listNodes.mockResolvedValue(nodes);
});

describe('DomainDetail', () => {
  it('shows where the hostname points, which a list row has no room for', async () => {
    getDomain.mockResolvedValue(domain());
    renderDetail();

    expect(await screen.findByText('api.example.com')).toBeInTheDocument();
    // The Service and the server it runs on, resolved to names rather than ids.
    const where = screen.getByRole('heading', { name: /where it points/i }).closest('section');
    expect(where).not.toBeNull();
    expect(within(where as HTMLElement).getByText('api')).toBeInTheDocument();
    expect(within(where as HTMLElement).getByText('shared-box')).toBeInTheDocument();
    expect(screen.getByText('3000')).toBeInTheDocument();
    // And the record to create, so it never has to be looked for elsewhere.
    expect(screen.getByText('203.0.113.10')).toBeInTheDocument();
  });

  it('corrects the port without giving up the hostname', async () => {
    getDomain.mockResolvedValue(domain());
    updateDomain.mockResolvedValue(
      domain({ target_port: 8080, provisioned_port: 3000, needs_reapply: true }),
    );
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const port = screen.getByLabelText(/port your application listens on/i);
    await userEvent.clear(port);
    await userEvent.type(port, '8080');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateDomain).toHaveBeenCalledWith('dom-api', { port: 8080, scheme: 'http' }),
    );
    // The hostname is never sent: it is claimed and released, not renamed.
    expect(removeDomain).not.toHaveBeenCalled();
  });

  it('refuses a port that is not one, before anything is sent', async () => {
    getDomain.mockResolvedValue(domain());
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const port = screen.getByLabelText(/port your application listens on/i);
    await userEvent.clear(port);
    await userEvent.type(port, '99999');

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(updateDomain).not.toHaveBeenCalled();
  });

  it('says the server has not caught up, naming both ports', async () => {
    getDomain.mockResolvedValue(
      domain({ target_port: 8080, provisioned_port: 3000, needs_reapply: true }),
    );
    renderDetail();

    expect(await screen.findByText(/this change is not live yet/i)).toBeInTheDocument();
    // Both numbers, because "out of date" without them is a feeling, not a fact.
    const banner = screen.getByText(/this change is not live yet/i).closest('div')
      ?.parentElement as HTMLElement;
    expect(banner).toHaveTextContent('3000');
    expect(banner).toHaveTextContent('8080');
  });

  it('applies a correction through provisioning, which is what rewrites the route', async () => {
    getDomain.mockResolvedValue(
      domain({ target_port: 8080, provisioned_port: 3000, needs_reapply: true }),
    );
    provisionDomain.mockResolvedValue(domain({ target_port: 8080, provisioned_port: 8080 }));
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: /apply the change/i }));
    await waitFor(() => expect(provisionDomain).toHaveBeenCalledWith('dom-api'));
  });

  it('never asks a Viewer to change anything', async () => {
    useWorkspaceStore.setState({
      workspaces: [{ id: 'ws-1', name: 'W', role: 'viewer', active: true } as never],
    });
    getDomain.mockResolvedValue(domain());
    renderDetail();

    expect(await screen.findByText(/needs a role above Viewer/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('points at Edit from the remove confirmation, since a wrong port is not a reason to start over', async () => {
    getDomain.mockResolvedValue(domain());
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: /remove this domain/i }));
    expect(await screen.findByText(/use Edit instead/i)).toBeInTheDocument();
    expect(removeDomain).not.toHaveBeenCalled();
  });
});
