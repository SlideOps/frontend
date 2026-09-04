import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingSubscription, Quote } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useAuthStore } from '../../store/auth';

/*
 * The Billing screen's checkout: choosing how many months to pay for at once
 * (monthly, or a full year and above paid straight through) and seeing the
 * automatic first-time annual discount before committing to pay. The backend
 * already does the math (monthly price times the months chosen, discounted
 * once); this screen only has to send the right term and show what comes back.
 */

const getSubscription = vi.fn();
const quoteCheckout = vi.fn();
const startCheckout = vi.fn();
const listTransactions = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSubscription: (...a: unknown[]) => getSubscription(...a),
  quoteCheckout: (...a: unknown[]) => quoteCheckout(...a),
  startCheckout: (...a: unknown[]) => startCheckout(...a),
  listTransactions: (...a: unknown[]) => listTransactions(...a),
}));

const { Billing } = await import('./Billing');

const operator = {
  id: 'op_1',
  email: 'ada@example.com',
  role: 'operator' as const,
  mfa_enabled: false,
  has_password: true,
  created_at: 'now',
};

function quote(over: Partial<Quote> = {}): Quote {
  return {
    tier: 'pro',
    currency: 'USD',
    term_months: 1,
    base_amount_minor: 4900,
    fee_label: 'VAT',
    fee_amount_minor: 490,
    total_amount_minor: 5390,
    promo_applied: false,
    promo_descriptions: [],
    free_grant: false,
    annual_discount_applied: false,
    ...over,
  };
}

function subscription(): BillingSubscription {
  return { configured: true, subscription: null };
}

function show() {
  useAuthStore.setState({ operator, status: 'authenticated' });
  return renderInApp(
    <MemoryRouter>
      <Billing />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getSubscription.mockReset().mockResolvedValue(subscription());
  quoteCheckout.mockReset().mockResolvedValue(quote());
  startCheckout.mockReset().mockResolvedValue({ checkout_url: '', reference: 'ref', provider: 'paystack', granted: false });
  listTransactions.mockReset().mockResolvedValue({ transactions: [], limit: 5, offset: 0, has_more: false });
});

describe('Billing: Recent Transactions', () => {
  it('shows nothing when there is no payment history yet', async () => {
    show();
    await waitFor(() => expect(listTransactions).toHaveBeenCalled());
    expect(screen.queryByText('Recent Transactions')).not.toBeInTheDocument();
  });

  it('shows the most recent transactions once there is history, with a link to the full page', async () => {
    listTransactions.mockResolvedValue({
      transactions: [
        {
          reference: 'so_a',
          status: 'success',
          tier: 'pro',
          provider: 'paystack',
          amount_minor: 4900,
          currency: 'USD',
          base_amount_minor: 4900,
          term_months: 1,
          receipt_available: true,
          created_at: '2026-09-04T00:00:00Z',
        },
      ],
      limit: 5,
      offset: 0,
      has_more: false,
    });
    show();
    expect(await screen.findByText('Recent Transactions')).toBeInTheDocument();
    expect(screen.getByText('Payment Successful')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View All Transactions/ })).toBeInTheDocument();
  });
});

describe('Billing: billing cycle', () => {
  it('quotes monthly by default', async () => {
    show();

    await waitFor(() =>
      expect(quoteCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ term_months: 1 }),
      ),
    );
  });

  it('re-quotes for a full year once that cycle is chosen', async () => {
    show();
    await screen.findByRole('radio', { name: /1 year/ });

    await userEvent.click(screen.getByRole('radio', { name: /1 year/ }));

    await waitFor(() =>
      expect(quoteCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ term_months: 12 }),
      ),
    );
  });

  it('sends the chosen term to checkout', async () => {
    show();
    await userEvent.click(await screen.findByRole('radio', { name: /2 years/ }));
    await waitFor(() =>
      expect(quoteCheckout).toHaveBeenCalledWith(expect.objectContaining({ term_months: 24 })),
    );

    await userEvent.click(screen.getByRole('button', { name: /Upgrade to/ }));

    await waitFor(() =>
      expect(startCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ term_months: 24 }),
      ),
    );
  });

  it('shows what was saved when the first-time annual discount applies', async () => {
    quoteCheckout.mockResolvedValue(
      quote({
        term_months: 12,
        base_amount_minor: 58212,
        annual_discount_applied: true,
        annual_discount_minor: 1188,
        total_amount_minor: 64033,
      }),
    );
    show();

    await userEvent.click(await screen.findByRole('radio', { name: /1 year/ }));

    expect(await screen.findByText(/You saved \$11\.88/)).toBeInTheDocument();
  });

  it('shows no savings banner for an ordinary monthly quote', async () => {
    show();
    await screen.findByText('Total charged today');

    expect(screen.queryByText(/You saved/)).not.toBeInTheDocument();
  });
});
