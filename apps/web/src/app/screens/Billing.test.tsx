import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type BillingSubscription, type Quote } from '@slideops/api-client';
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
const listBillingArrangements = vi.fn();
const validatePromo = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSubscription: (...a: unknown[]) => getSubscription(...a),
  quoteCheckout: (...a: unknown[]) => quoteCheckout(...a),
  startCheckout: (...a: unknown[]) => startCheckout(...a),
  listTransactions: (...a: unknown[]) => listTransactions(...a),
  listBillingArrangements: (...a: unknown[]) => listBillingArrangements(...a),
  validatePromo: (...a: unknown[]) => validatePromo(...a),
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
  startCheckout
    .mockReset()
    .mockResolvedValue({
      checkout_url: '',
      reference: 'ref',
      provider: 'paystack',
      granted: false,
    });
  listTransactions
    .mockReset()
    .mockResolvedValue({ transactions: [], limit: 5, offset: 0, has_more: false });
  listBillingArrangements.mockReset().mockResolvedValue([]);
  validatePromo.mockReset();
});

describe('Billing: access arranged for you', () => {
  it('shows the arrangement and what is owed on the page the customer already uses', async () => {
    listBillingArrangements.mockResolvedValue([
      {
        id: 'arr_1',
        tier: 'pro',
        condition: 'temporary_access',
        status: 'awaiting_payment',
        amount_minor: 150000,
        currency: 'USD',
        payment_deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
        payment_reference: 'so_open_payment',
        resumable: true,
        created_at: new Date().toISOString(),
      },
    ]);
    show();

    expect(await screen.findByText('Access arranged for you')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete this payment/ })).toBeInTheDocument();
  });

  it('shows no arrangement section when the customer has none', async () => {
    show();
    await waitFor(() => expect(listBillingArrangements).toHaveBeenCalled());

    expect(screen.queryByText('Access arranged for you')).not.toBeInTheDocument();
  });

  it('renders the billing page as before when the arrangements endpoint fails', async () => {
    listBillingArrangements.mockRejectedValue(new ApiError(503, 'unavailable', 'No arrangements.'));
    show();

    expect(await screen.findByText('Total charged today')).toBeInTheDocument();
    expect(screen.getByText('Plans')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upgrade to/ })).toBeInTheDocument();
    expect(screen.queryByText('Access arranged for you')).not.toBeInTheDocument();
    expect(screen.queryByText('No arrangements.')).not.toBeInTheDocument();
  });
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
      expect(quoteCheckout).toHaveBeenCalledWith(expect.objectContaining({ term_months: 1 })),
    );
  });

  it('re-quotes for a full year once that cycle is chosen', async () => {
    show();
    await screen.findByRole('radio', { name: /1 year/ });

    await userEvent.click(screen.getByRole('radio', { name: /1 year/ }));

    await waitFor(() =>
      expect(quoteCheckout).toHaveBeenCalledWith(expect.objectContaining({ term_months: 12 })),
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
      expect(startCheckout).toHaveBeenCalledWith(expect.objectContaining({ term_months: 24 })),
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

describe('Billing: a promo code and the total it is supposed to change', () => {
  /** What the promo endpoint says about a code that takes 25% off. */
  function preview(over: Record<string, unknown> = {}) {
    return {
      code: 'SAVE25',
      tier: 'pro',
      term_months: 1,
      original_amount_minor: 4900,
      discounted_amount_minor: 3675,
      currency: 'USD',
      descriptions: ['25% off your first payment'],
      free_grant: false,
      bonus_nodes: 0,
      bonus_projects: 0,
      bonus_seats: 0,
      ...over,
    };
  }

  /** Type a code and validate it, the way the screen asks. */
  async function applyCode(code = 'SAVE25') {
    await userEvent.type(screen.getByLabelText('Promo code'), code);
    await userEvent.click(screen.getByRole('button', { name: 'Validate' }));
  }

  it('reprices the total under the code, rather than showing a discount above a full price', async () => {
    // The reported bug: the code applied and read correctly, and the number
    // the Operator was about to pay did not move.
    validatePromo.mockResolvedValue(preview());
    quoteCheckout.mockResolvedValueOnce(quote()).mockResolvedValue(
      quote({
        base_amount_minor: 3675,
        fee_amount_minor: 368,
        total_amount_minor: 4043,
        promo_applied: true,
        promo_discount_minor: 1225,
        promo_descriptions: ['25% off your first payment'],
      }),
    );

    show();
    await screen.findByText('Total charged today');
    await applyCode();

    // Priced under the code that was applied, not under no code at all.
    await waitFor(() =>
      expect(quoteCheckout).toHaveBeenLastCalledWith(
        expect.objectContaining({ promo_code: 'SAVE25' }),
      ),
    );
    expect(await screen.findByText('$40.43')).toBeInTheDocument();
    expect(screen.getByText('You saved $12.25')).toBeInTheDocument();
    expect(screen.queryByText('$53.90')).not.toBeInTheDocument();
  });

  it('charges under the same code the total was quoted under', async () => {
    validatePromo.mockResolvedValue(preview());
    quoteCheckout.mockResolvedValue(
      quote({ promo_applied: true, promo_discount_minor: 1225, total_amount_minor: 4043 }),
    );

    show();
    await screen.findByText('Total charged today');
    await applyCode();
    await userEvent.click(screen.getByRole('button', { name: /Upgrade to/ }));

    await waitFor(() =>
      expect(startCheckout).toHaveBeenCalledWith(expect.objectContaining({ promo_code: 'SAVE25' })),
    );
  });

  it('will not charge under a code that was never validated, nor quietly drop it', async () => {
    show();
    await screen.findByText('Total charged today');
    await userEvent.type(screen.getByLabelText('Promo code'), 'MAYBE');
    await userEvent.click(screen.getByRole('button', { name: /Upgrade to/ }));

    // Charging without it loses a discount the Operator plainly meant to use;
    // charging with it takes a different amount than the total on screen.
    expect(startCheckout).not.toHaveBeenCalled();
    expect(await screen.findByText(/Validate this code first/)).toBeInTheDocument();
  });

  it('returns to the full price when the code is edited away', async () => {
    validatePromo.mockResolvedValue(preview());
    quoteCheckout.mockResolvedValue(quote());

    show();
    await screen.findByText('Total charged today');
    await applyCode();
    await waitFor(() =>
      expect(quoteCheckout).toHaveBeenLastCalledWith(
        expect.objectContaining({ promo_code: 'SAVE25' }),
      ),
    );

    await userEvent.type(screen.getByLabelText('Promo code'), 'X');

    await waitFor(() =>
      expect(quoteCheckout).toHaveBeenLastCalledWith(
        expect.objectContaining({ promo_code: undefined }),
      ),
    );
  });

  it('says there is nothing to pay for a code that grants the plan outright', async () => {
    validatePromo.mockResolvedValue(
      preview({ free_grant: true, grant_tier: 'pro', free_days: 30 }),
    );
    quoteCheckout
      .mockResolvedValueOnce(quote())
      .mockResolvedValue(quote({ promo_applied: true, free_grant: true, grant_tier: 'pro' }));

    show();
    await screen.findByText('Total charged today');
    await applyCode();

    // Itemising a subtotal, a fee and a zero total would describe a
    // transaction that is not going to happen.
    expect(await screen.findByText('Nothing to pay')).toBeInTheDocument();
    expect(screen.queryByText('Total charged today')).not.toBeInTheDocument();
  });
});
