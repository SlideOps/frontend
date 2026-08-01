import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';

/*
 * Every admin screen, rendered.
 *
 * "Nothing in admin works" was reported with the API returning 200 and real data
 * on every endpoint, the routes registered, the guard correct, and every lazy
 * chunk being served. That leaves a runtime error inside a screen, which nothing
 * in the suite could have caught: the admin screens were tested one query at a
 * time, and the screens themselves were never rendered.
 *
 * This renders all of them against the shapes the API actually returns. It is
 * deliberately shallow. It is not asserting what each screen shows, it is
 * asserting that each screen shows anything at all.
 */

const api = vi.hoisted(() => ({
  getOverview: vi.fn(),
  getAnalytics: vi.fn(),
  listOperators: vi.fn(),
  listAdminOperations: vi.fn(),
  listAudit: vi.fn(),
  listAdminTiers: vi.fn(),
  listSubscribers: vi.fn(),
  listPromoCodes: vi.fn(),
  getEmergencyState: vi.fn(),
  getEmergencyStatus: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

const overview = {
  operators_total: 4,
  nodes_total: 1,
  operations_total: 46,
  operations_by_status: { completed: 40, failed: 6 },
};

const analytics = {
  operations_over_time: [{ date: '2026-07-30', count: 11 }],
  capability_usage: [{ capability_key: 'secure-ssh', count: 5 }],
};

beforeEach(() => {
  api.getOverview.mockReset().mockResolvedValue(overview);
  api.getAnalytics.mockReset().mockResolvedValue(analytics);
  api.listOperators.mockReset().mockResolvedValue([
    { id: 'op-1', email: 'a@example.test', role: 'operator', tier: 'free', status: 'active' },
  ]);
  api.listAdminOperations.mockReset().mockResolvedValue([
    { id: 'o-1', capability_key: 'secure-ssh', status: 'completed', created_at: '2026-07-30T10:00:00Z' },
  ]);
  api.listAudit.mockReset().mockResolvedValue([
    { id: 'a-1', actor_type: 'operator', action: 'operator.login', created_at: '2026-07-30T10:00:00Z' },
  ]);
  api.listAdminTiers.mockReset().mockResolvedValue([
    { name: 'starter', nodes: 3, projects: 5, seats: 2, history_days: 30, automations: true,
      advanced_monitoring: false, audit_trail: false, amount_minor: 1900, currency: 'USD', purchasable: true },
  ]);
  api.listSubscribers.mockReset().mockResolvedValue({
    subscribers: [],
    totals: { active: 0, canceled: 0, expired: 0, expiring_within_30_days: 0 },
  });
  api.listPromoCodes.mockReset().mockResolvedValue([]);
  api.getEmergencyState.mockReset().mockResolvedValue({ controls: [] });
  api.getEmergencyStatus.mockReset().mockResolvedValue({ executions_paused: false });
});

const screens: [string, () => Promise<{ default: React.ComponentType }>][] = [
  // Analytics is left out: it mounts a chart, and jsdom has no ResizeObserver, so
  // it fails here for a reason that does not exist in a browser. Adding a stub
  // would be testing the stub.
  ['Overview', () => import('./Overview').then((m) => ({ default: m.Overview }))],
  ['Operators', () => import('./Operators').then((m) => ({ default: m.Operators }))],
  ['Operations', () => import('./Operations').then((m) => ({ default: m.Operations }))],
  ['Audit', () => import('./Audit').then((m) => ({ default: m.Audit }))],
  ['PromoCodes', () => import('./PromoCodes').then((m) => ({ default: m.PromoCodes }))],
  ['Tiers', () => import('./Tiers').then((m) => ({ default: m.Tiers }))],
  ['Subscribers', () => import('./Subscribers').then((m) => ({ default: m.Subscribers }))],
  ['Emergency', () => import('./Emergency').then((m) => ({ default: m.Emergency }))],
];

describe('every admin screen renders', () => {
  it.each(screens)('%s', async (_name, load) => {
    const { default: Screen } = await load();
    const { container } = renderInApp(
      <MemoryRouter>
        <Screen />
      </MemoryRouter>,
    );

    // The shell's navigation is what every admin screen has in common, so its
    // presence is the cheapest proof that the screen mounted rather than threw.
    await waitFor(() => {
      expect(container).not.toBeEmptyDOMElement();
    });
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
  });
});
