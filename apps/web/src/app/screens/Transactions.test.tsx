import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction, TransactionSummaryResponse } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useAuthStore } from '../../store/auth';

/*
 * Billing -> Transactions: the Operator's own payment activity center. These
 * tests pin the properties the spec cares about most -- a first-time
 * Operator sees a real empty state rather than a blank table, a status
 * filter actually narrows the request, and a pending row offers Complete
 * Payment inline without navigating away first.
 */

const listTransactions = vi.fn();
const transactionSummary = vi.fn();
const resumeCheckout = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listTransactions: (...a: unknown[]) => listTransactions(...a),
  transactionSummary: (...a: unknown[]) => transactionSummary(...a),
  resumeCheckout: (...a: unknown[]) => resumeCheckout(...a),
}));

const { Transactions } = await import('./Transactions');

const operator = {
  id: 'op_1',
  email: 'ada@example.com',
  role: 'operator' as const,
  mfa_enabled: false,
  has_password: true,
  created_at: 'now',
};

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    reference: 'so_a',
    status: 'success',
    tier: 'pro',
    provider: 'paystack',
    amount_minor: 4900,
    currency: 'USD',
    base_amount_minor: 4900,
    term_months: 1,
    receipt_available: true,
    created_at: '2026-09-04T12:00:00Z',
    ...over,
  };
}

function summary(over: Partial<TransactionSummaryResponse['summary']> = {}): TransactionSummaryResponse {
  return {
    summary: {
      successful_count: 0,
      pending_count: 0,
      failed_count: 0,
      cancelled_count: 0,
      refunded_count: 0,
      disputed_count: 0,
      total_paid_minor_by_currency: {},
      refunded_minor_by_currency: {},
      ...over,
    },
    over_time: [],
  };
}

function show() {
  useAuthStore.setState({ operator, status: 'authenticated' });
  return renderInApp(
    <MemoryRouter initialEntries={['/app/billing/transactions']}>
      <Transactions />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listTransactions.mockReset().mockResolvedValue({ transactions: [], limit: 20, offset: 0, has_more: false });
  transactionSummary.mockReset().mockResolvedValue(summary());
  resumeCheckout.mockReset();
});

describe('Transactions: empty states', () => {
  it('shows a real empty state, not a blank table, for a first-time Operator', async () => {
    show();
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
    expect(
      screen.getByText('Your payment activity will appear here once you make your first purchase.'),
    ).toBeInTheDocument();
  });

  it('shows a different empty state when a filter matches nothing', async () => {
    listTransactions.mockResolvedValue({ transactions: [], limit: 20, offset: 0, has_more: false });
    show();
    await screen.findByText('No transactions yet');
    await userEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(await screen.findByText('No transactions found')).toBeInTheDocument();
  });
});

describe('Transactions: the list', () => {
  it('shows each transaction with payment-specific status language', async () => {
    listTransactions.mockResolvedValue({
      transactions: [tx({ status: 'pending', reference: 'so_pending' })],
      limit: 20,
      offset: 0,
      has_more: false,
    });
    show();
    expect(await screen.findByText('Pending Payment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete Payment' })).toBeInTheDocument();
  });

  it('does not offer Complete Payment on a successful transaction', async () => {
    listTransactions.mockResolvedValue({
      transactions: [tx({ status: 'success' })],
      limit: 20,
      offset: 0,
      has_more: false,
    });
    show();
    expect(await screen.findByText('Payment Successful')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete Payment' })).not.toBeInTheDocument();
  });

  it('narrows the request when a status filter is chosen', async () => {
    show();
    await screen.findByText('No transactions yet');
    listTransactions.mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'Failed' }));

    await waitFor(() =>
      expect(listTransactions).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ['failed'] }),
        expect.anything(),
      ),
    );
  });

  it('resumes the same checkout rather than starting a new one', async () => {
    listTransactions.mockResolvedValue({
      transactions: [tx({ status: 'pending', reference: 'so_pending' })],
      limit: 20,
      offset: 0,
      has_more: false,
    });
    resumeCheckout.mockResolvedValue({
      checkout_url: 'https://checkout.example.com/so_pending',
      already_succeeded: false,
      transaction: tx({ status: 'pending', reference: 'so_pending' }),
    });
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Complete Payment' }));

    await waitFor(() => expect(resumeCheckout).toHaveBeenCalledWith('so_pending'));
  });
});

describe('Transactions: summary', () => {
  it('keeps different currencies separate rather than adding them together', async () => {
    transactionSummary.mockResolvedValue(
      summary({
        successful_count: 2,
        total_paid_minor_by_currency: { USD: 4900, NGN: 7500000 },
      }),
    );
    show();
    const totalPaid = await screen.findByText('Total Paid');
    const card = totalPaid.closest('div')?.parentElement as HTMLElement;
    expect(within(card).getByText(/\$49\.00/)).toBeInTheDocument();
    expect(within(card).getByText(/NGN/)).toBeInTheDocument();
  });
});
