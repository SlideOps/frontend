import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Transaction } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useAuthStore } from '../../store/auth';

/*
 * One transaction's detail view: the available actions must come from its
 * own status, never a fixed list -- a pending payment offers Complete and
 * Cancel, a successful one offers the receipt actions, and cancelling
 * actually opens the confirmation described in the spec before it runs.
 */

const getTransaction = vi.fn();
const cancelTransaction = vi.fn();
const resumeCheckout = vi.fn();
const refreshTransactionStatus = vi.fn();
const emailTransactionReceipt = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransaction: (...a: unknown[]) => getTransaction(...a),
  cancelTransaction: (...a: unknown[]) => cancelTransaction(...a),
  resumeCheckout: (...a: unknown[]) => resumeCheckout(...a),
  refreshTransactionStatus: (...a: unknown[]) => refreshTransactionStatus(...a),
  emailTransactionReceipt: (...a: unknown[]) => emailTransactionReceipt(...a),
}));

const { TransactionDetail } = await import('./TransactionDetail');

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
    status: 'pending',
    tier: 'pro',
    provider: 'paystack',
    amount_minor: 4900,
    currency: 'USD',
    base_amount_minor: 4900,
    term_months: 1,
    receipt_available: false,
    created_at: '2026-09-04T12:00:00Z',
    ...over,
  };
}

function show() {
  useAuthStore.setState({ operator, status: 'authenticated' });
  return renderInApp(
    <MemoryRouter initialEntries={['/app/billing/transactions/so_a']}>
      <Routes>
        <Route path="/app/billing/transactions/:reference" element={<TransactionDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getTransaction.mockReset().mockResolvedValue(tx());
  cancelTransaction.mockReset();
  resumeCheckout.mockReset();
  refreshTransactionStatus.mockReset();
  emailTransactionReceipt.mockReset();
});

describe('TransactionDetail: state-aware actions', () => {
  it('offers Complete and Cancel for a pending payment, and nothing receipt-related', async () => {
    show();
    expect(await screen.findByRole('button', { name: 'Complete Payment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Payment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check Payment Status/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Receipt' })).not.toBeInTheDocument();
  });

  it('offers the receipt actions for a successful payment, and nothing cancel/complete', async () => {
    getTransaction.mockResolvedValue(tx({ status: 'success', receipt_available: true }));
    show();
    expect(await screen.findByRole('button', { name: /View Receipt/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download Receipt/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Email Receipt/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete Payment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Payment' })).not.toBeInTheDocument();
  });

  it('offers Try Payment Again for a failed payment', async () => {
    getTransaction.mockResolvedValue(tx({ status: 'failed' }));
    show();
    expect(await screen.findByRole('button', { name: 'Try Payment Again' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Payment' })).not.toBeInTheDocument();
  });

  it('offers Start Payment Again for a cancelled payment', async () => {
    getTransaction.mockResolvedValue(tx({ status: 'cancelled' }));
    show();
    expect(await screen.findByRole('button', { name: 'Start Payment Again' })).toBeInTheDocument();
  });
});

describe('TransactionDetail: cancel flow', () => {
  it('confirms before cancelling, and only cancels once confirmed', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel Payment' }));

    expect(screen.getByText('Cancel this payment?')).toBeInTheDocument();
    expect(cancelTransaction).not.toHaveBeenCalled();

    cancelTransaction.mockResolvedValue(tx({ status: 'cancelled' }));
    // The trigger button and the dialog's own confirm button share a label;
    // the dialog's is the one added most recently.
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel Payment' });
    await userEvent.click(cancelButtons[cancelButtons.length - 1]!);

    await waitFor(() => expect(cancelTransaction).toHaveBeenCalledWith('so_a'));
  });

  it('backing out with Keep Payment never cancels anything', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel Payment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep Payment' }));

    expect(cancelTransaction).not.toHaveBeenCalled();
  });
});

describe('TransactionDetail: unknown reference', () => {
  it('shows a not-found state rather than a raw error for a 404', async () => {
    getTransaction.mockRejectedValue(new ApiError(404, 'not_found', 'no transaction matches that reference'));
    show();
    expect(await screen.findByText('Transaction not found')).toBeInTheDocument();
  });
});
