import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { Subscribers } from './Subscribers';

/*
 * The subscribers table, rendered with the shapes the API actually returns.
 *
 * The reading of a subscriber is tested as pure logic in subscribers.test.ts.
 * What is tested here is the screen: that a lapsed account and a failed payment
 * are on it rather than filtered out, and that the headline reports what an
 * operator of the business would act on.
 */

const { listSubscribers } = vi.hoisted(() => ({ listSubscribers: vi.fn() }));

vi.mock('@slideops/api-client', () => ({
  listSubscribers,
  ApiError: class ApiError extends Error {},
}));

const totals = {
  active: 1,
  canceled: 0,
  expired: 1,
  expiring_within_30_days: 1,
  paid_minor: 3000000,
  currency: 'NGN',
  failed_payments: 1,
};

beforeEach(() => {
  listSubscribers.mockReset();
  listSubscribers.mockResolvedValue({
    totals,
    subscribers: [
      {
        operator_id: 'op-1',
        email: 'paid@example.com',
        account_tier: 'pro',
        status: 'active',
        subscription_tier: 'pro',
        provider: 'paystack',
        current_period_end: '2126-01-01T00:00:00Z',
        payments: 2,
        paid_minor: 3000000,
        currency: 'NGN',
      },
      {
        operator_id: 'op-2',
        email: 'lapsed@example.com',
        account_tier: 'free',
        status: 'expired',
        subscription_tier: 'pro',
        payments: 0,
        paid_minor: 0,
      },
      {
        operator_id: 'op-3',
        email: 'tried@example.com',
        account_tier: 'free',
        payments: 1,
        paid_minor: 0,
        currency: 'NGN',
      },
    ],
  });
});

function renderScreen() {
  return renderInApp(
    <MemoryRouter>
      <Subscribers />
    </MemoryRouter>,
  );
}

describe('Subscribers', () => {
  it('lists everyone who paid, lapsed, or only ever tried', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('paid@example.com')).toBeInTheDocument());

    // The two that a list of active subscribers alone would hide, and that are
    // the reason this screen exists.
    expect(screen.getByText('lapsed@example.com')).toBeInTheDocument();
    expect(screen.getByText('tried@example.com')).toBeInTheDocument();

    expect(screen.getByText('Lapsed')).toBeInTheDocument();
    expect(screen.getByText('Never subscribed')).toBeInTheDocument();
  });

  it('reports the headline an operator of the business would act on', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText('Ending within 30 days')).toBeInTheDocument());

    // Failed attempts are a figure of their own: a rise in them looks identical
    // to nobody trying, if only successful payments are counted.
    expect(screen.getByText('Failed payments')).toBeInTheDocument();
    expect(screen.getByText(/Successful payments only/i)).toBeInTheDocument();
  });

  it('shows money in the currency it was taken in', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getAllByText(/15,000|30,000/).length).toBeGreaterThan(0));
  });

  it('says so plainly when nobody has subscribed', async () => {
    listSubscribers.mockResolvedValue({
      subscribers: [],
      totals: { ...totals, active: 0, expired: 0, paid_minor: 0, failed_payments: 0 },
    });
    renderScreen();
    await waitFor(() => expect(screen.getByText(/Nobody has subscribed yet/i)).toBeInTheDocument());
  });

  it('surfaces a failure to load rather than showing an empty table', async () => {
    listSubscribers.mockRejectedValue(new Error('unreachable'));
    renderScreen();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/Nobody has subscribed yet/i)).not.toBeInTheDocument();
  });
});
