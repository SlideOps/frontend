import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminTier } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * Marking every limit Unlimited and saving used to fail with "Limits cannot
 * be negative": the client-side guard rejected any count below zero, but the
 * Unlimited checkbox itself produces -1, the sentinel the backend expects.
 * The guard has to allow exactly -1 through while still catching a real
 * out-of-range value like -2, which nothing in the UI can normally produce
 * but the guard exists to catch anyway.
 */

const api = vi.hoisted(() => ({
  listAdminTiers: vi.fn(),
  updateAdminTier: vi.fn(),
}));

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

const freeTier: AdminTier = {
  name: 'free',
  nodes: 1,
  projects: 1,
  seats: 1,
  history_days: 7,
  automations: false,
  advanced_monitoring: false,
  audit_trail: false,
  amount_minor: 0,
  currency: 'USD',
  purchasable: false,
};

const { Tiers } = await import('./Tiers');

function render() {
  return renderInApp(
    <MemoryRouter>
      <Tiers />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  api.listAdminTiers.mockReset().mockResolvedValue([freeTier]);
  api.updateAdminTier.mockReset().mockImplementation((_name: string, payload: object) => ({
    ...freeTier,
    ...payload,
  }));
});

describe('Tiers', () => {
  it('saves every field marked Unlimited without the negative-limit guard firing', async () => {
    render();
    await screen.findByText('Free');

    // One "Unlimited" checkbox per count field: Nodes, Projects, Seats, History days.
    for (const checkbox of screen.getAllByRole('checkbox', { name: 'Unlimited' })) {
      await userEvent.click(checkbox);
    }

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(api.updateAdminTier).toHaveBeenCalledTimes(1));
    const [, payload] = api.updateAdminTier.mock.calls[0] as [string, Record<string, number>];
    expect(payload.nodes).toBe(-1);
    expect(payload.projects).toBe(-1);
    expect(payload.seats).toBe(-1);
    expect(payload.history_days).toBe(-1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
