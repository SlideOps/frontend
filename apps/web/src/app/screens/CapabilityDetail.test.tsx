import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import type { Capability, CapabilityState, Node, Operation } from '@slideops/api-client';

/*
 * A database server usually carries one database per application, so a
 * Capability's own management page, opened from a Service, has to show the
 * credential for the one database that Service actually uses, not a
 * platform-wide "has manage-postgresql ever run on this Node" flag: that flag
 * says nothing about which of possibly several Services asked. It reads the
 * same scoped list-databases Action Browse itself reads, then finds the
 * completed manage Operation that created the database it named.
 */

const getCapability = vi.fn();
const getCapabilityStates = vi.fn();
const listNodes = vi.fn();
const listOperations = vi.fn();
const runCapabilityAction = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getCapability: (...a: unknown[]) => getCapability(...a),
  getCapabilityStates: (...a: unknown[]) => getCapabilityStates(...a),
  listNodes: (...a: unknown[]) => listNodes(...a),
  listOperations: (...a: unknown[]) => listOperations(...a),
  runCapabilityAction: (...a: unknown[]) => runCapabilityAction(...a),
}));

const { CapabilityDetail } = await import('./CapabilityDetail');

function capability(overrides: Partial<Capability> = {}): Capability {
  return {
    key: 'install-postgresql',
    name: 'PostgreSQL',
    category: 'database',
    description: 'A PostgreSQL server.',
    intent: '',
    risk_level: 'medium',
    supported_platforms: [],
    requirements: [],
    verification_strategy: '',
    parameters: [],
    ...overrides,
  } as Capability;
}

function node(overrides: Partial<Node> = {}): Node {
  return {
    id: 'node-1',
    name: 'db-server',
    address: '10.0.0.1',
    port: 22,
    ssh_username: 'deploy',
    auth_kind: 'password',
    status: 'active',
    project_id: 'proj-1',
    ...overrides,
  } as Node;
}

function done(overrides: Partial<CapabilityState> = {}): CapabilityState {
  return {
    last_operation_id: 'install-op-1',
    last_completed_at: '2026-07-01T00:00:00Z',
    ...overrides,
  } as CapabilityState;
}

function manageOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: 'manage-op-1',
    node_id: 'node-1',
    capability_key: 'manage-postgresql',
    status: 'completed',
    plan: null,
    verification: null,
    error: null,
    parameters: { database: 'service_a_db', username: 'service_a', password: '[stored securely]' },
    created_at: '2026-07-15T00:00:00Z',
    approved_at: null,
    started_at: null,
    completed_at: '2026-07-15T00:00:00Z',
    ...overrides,
  } as Operation;
}

function show(query: string) {
  return renderInApp(
    <MemoryRouter initialEntries={[`/app/capabilities/install-postgresql${query}`]}>
      <Routes>
        <Route path="/app/capabilities/:key" element={<CapabilityDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CapabilityDetail: Service scoped database credentials', () => {
  it('shows the credential for the one database this Service actually uses', async () => {
    getCapability.mockResolvedValue(capability());
    listNodes.mockResolvedValue([node()]);
    getCapabilityStates.mockResolvedValue({ 'install-postgresql': done() });
    runCapabilityAction.mockResolvedValue({
      columns: ['Database', 'Owner', 'Size', 'Encoding'],
      rows: [['service_a_db', 'service_a', '8 MB', 'UTF8']],
      empty: '',
    });
    listOperations.mockResolvedValue([manageOperation()]);

    show('?node=node-1&project=proj-1&service=svc-1');

    // service_a_db appears both in Browse's own Tree and in the credential
    // card below it; either is fine, there just has to be at least one.
    expect((await screen.findAllByText('service_a_db')).length).toBeGreaterThan(0);
    expect(runCapabilityAction).toHaveBeenCalledWith(
      'install-postgresql',
      'list-databases',
      expect.objectContaining({ node_id: 'node-1', service_id: 'svc-1' }),
    );
  });

  it('offers the create-database nudge when this Service points at no database yet', async () => {
    getCapability.mockResolvedValue(capability());
    listNodes.mockResolvedValue([node()]);
    getCapabilityStates.mockResolvedValue({ 'install-postgresql': done() });
    runCapabilityAction.mockResolvedValue({ columns: [], rows: [], empty: 'nothing' });
    listOperations.mockResolvedValue([]);

    show('?node=node-1&project=proj-1&service=svc-1');

    expect(await screen.findByText('One more step for a credential')).toBeInTheDocument();
  });
});

describe('CapabilityDetail: installed version', () => {
  it('shows the version the completing Operation actually ran with', async () => {
    getCapability.mockResolvedValue(capability());
    listNodes.mockResolvedValue([node()]);
    getCapabilityStates.mockResolvedValue({ 'install-postgresql': done({ version: '16' }) });
    listOperations.mockResolvedValue([]);

    show('?node=node-1');

    expect(await screen.findByText(/version 16/)).toBeInTheDocument();
  });

  it('names no version for a Capability installed before version selection existed', async () => {
    getCapability.mockResolvedValue(capability());
    listNodes.mockResolvedValue([node()]);
    getCapabilityStates.mockResolvedValue({ 'install-postgresql': done() });
    listOperations.mockResolvedValue([]);

    show('?node=node-1');

    await screen.findByText(/Already installed/);
    expect(screen.queryByText(/version/)).not.toBeInTheDocument();
  });
});
