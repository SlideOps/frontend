import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Automation, Capability, Node } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * An Automation runs while nobody is watching, so the list's job is to say
 * whether it is still working.
 *
 * It did not. Every row showed the Capability, the Node, the schedule, and when
 * the next run was due, and nothing at all about how the last one went. One that
 * had failed every night for a week rendered identically to one that had
 * succeeded every night, and the only way to find out was to open the Operation
 * and read it. These payloads are the shapes the API returns, taken from a real
 * server: one Automation that worked and one that genuinely failed.
 */

const node: Node = {
  id: 'n1',
  name: 'contabo vmi cloud VPS 6',
  address: '169.58.53.167',
  status: 'reachable',
} as Node;

const capabilities = [
  { key: 'enable-monitoring', name: 'Enable monitoring', risk_level: 'low' },
  { key: 'remove-server-user', name: 'Remove server user', risk_level: 'high' },
] as Capability[];

const healthy: Automation = {
  id: 'a-healthy',
  operator_id: 'op',
  node_id: 'n1',
  capability_key: 'enable-monitoring',
  parameters: { interval: '60' },
  schedule: { frequency: 'daily', time: '03:30' },
  enabled: true,
  last_run_at: '2026-07-30T22:14:09Z',
  next_run_at: '2026-07-31T03:30:00Z',
  last_operation_id: 'op-2',
  last_run_status: 'completed',
  created_at: '2026-07-30T22:12:00Z',
};

const fresh: Automation = {
  ...healthy,
  id: 'a-fresh',
  last_run_at: null,
  last_operation_id: null,
  last_run_status: null,
};

const broken: Automation = {
  ...healthy,
  id: 'a-broken',
  capability_key: 'remove-server-user',
  parameters: { username: 'nobody-was-ever-here' },
  schedule: { frequency: 'monthly', day_of_month: 1, time: '05:00' },
  last_run_status: 'failed',
};

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listAutomations: async () => [healthy, broken, fresh],
  listNodes: async () => [node],
  listCapabilities: async () => capabilities,
}));

const { Automations } = await import('./Automations');

function renderList() {
  return renderInApp(
    <MemoryRouter>
      <Automations />
    </MemoryRouter>,
  );
}

describe('Automations list', () => {
  it('says outright when the last run failed', async () => {
    renderList();
    expect(await screen.findByText(/Last run failed/)).toBeInTheDocument();
  });

  it('shows a working Automation as having run, without alarming about it', async () => {
    renderList();
    expect(await screen.findByText(/^Last ran /)).toBeInTheDocument();
  });

  // The bug, pinned: the two rows must not read the same.
  it('does not render a failing Automation the same as a healthy one', async () => {
    renderList();
    await screen.findByText(/Last run failed/);
    expect(screen.queryAllByText(/Last run failed/)).toHaveLength(1);
    expect(screen.queryAllByText(/^Last ran /)).toHaveLength(1);
  });

  it('says an Automation has not run yet rather than leaving the line blank', async () => {
    renderList();
    expect(await screen.findByText('Not run yet')).toBeInTheDocument();
  });
});
