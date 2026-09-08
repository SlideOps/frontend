import { ApiError, TransactionActionError, type BillingArrangement } from '@slideops/api-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import { transactionDetailPath } from '../billing-routes';

/*
 * The arrangement panel on the Operator's own Billing page.
 *
 * What matters here is not that a list renders, but that the panel never
 * invites a second payment for a debt that already has one waiting, and never
 * turns a gift or a closed matter into something that looks owed.
 */

const listBillingArrangements = vi.fn();
const resumeCheckout = vi.fn();
const completeArrangementPayment = vi.fn();
const startCheckout = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listBillingArrangements: (...a: unknown[]) => listBillingArrangements(...a),
  resumeCheckout: (...a: unknown[]) => resumeCheckout(...a),
  completeArrangementPayment: (...a: unknown[]) => completeArrangementPayment(...a),
  startCheckout: (...a: unknown[]) => startCheckout(...a),
}));

const { BillingArrangements } = await import('./BillingArrangements');

const dayMs = 24 * 60 * 60 * 1000;

/** Deadlines are set relative to the moment the test runs, so nothing here
 *  starts failing on a particular calendar day. */
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * dayMs).toISOString();
}

/** The same date wording the panel uses, so the expectation is not a guess at
 *  the machine's locale. */
function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100);
}

/**
 * Whether the server would call this payable, mirrored here so a fixture looks
 * like a real response. It is the arrangement's own lifecycle and condition that
 * decide, never whether a checkout happens to be open: an arrangement whose
 * price was just corrected has no open checkout and is very much payable.
 */
function serverPayable(over: Partial<BillingArrangement>): boolean {
  const status = over.status ?? 'awaiting_payment';
  const condition = over.condition ?? 'temporary_access';
  if (status === 'cancelled' || status === 'revoked' || status === 'completed') {
    return false;
  }
  return condition !== 'free_grant' && condition !== 'offline_settled';
}

function arrangement(over: Partial<BillingArrangement> = {}): BillingArrangement {
  return {
    id: 'arr_1',
    tier: 'pro',
    condition: 'temporary_access',
    status: 'awaiting_payment',
    amount_minor: 150000,
    currency: 'USD',
    payment_deadline: daysFromNow(10),
    payment_reference: 'so_open_payment',
    resumable: true,
    payable: serverPayable(over),
    created_at: daysFromNow(-4),
    ...over,
  };
}

// The panel links through to a payment's own page, so it needs a router the
// same way every other screen that navigates does.
function show() {
  return renderInApp(
    <MemoryRouter>
      <BillingArrangements />
    </MemoryRouter>,
  );
}

// Handing the Operator to the hosted checkout is a real navigation, which jsdom
// refuses. Standing in a plain object for the duration lets the test read where
// the panel actually sent them.
const realLocation = Object.getOwnPropertyDescriptor(window, 'location');
let sentTo = '';

beforeEach(() => {
  listBillingArrangements.mockReset().mockResolvedValue([]);
  resumeCheckout.mockReset();
  completeArrangementPayment.mockReset();
  startCheckout.mockReset();
  sentTo = '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      get href() {
        return sentTo;
      },
      set href(value: string) {
        sentTo = value;
      },
    },
  });
});

afterEach(() => {
  if (realLocation) {
    Object.defineProperty(window, 'location', realLocation);
  }
});

describe('the arrangement panel on Billing', () => {
  it('shows what is owed and by when for an arrangement awaiting payment', async () => {
    const deadline = daysFromNow(12);
    listBillingArrangements.mockResolvedValue([arrangement({ payment_deadline: deadline })]);

    show();

    expect(await screen.findByText('Pro plan')).toBeInTheDocument();
    expect(screen.getByText(money(150000, 'USD'))).toBeInTheDocument();
    expect(screen.getByText('Outstanding')).toBeInTheDocument();
    expect(screen.getByText(`Due by ${day(deadline)}`)).toBeInTheDocument();
  });

  it('completes an arrangement through the one endpoint that decides, and never a new checkout', async () => {
    listBillingArrangements.mockResolvedValue([
      arrangement({ payment_reference: 'so_open_payment' }),
    ]);
    completeArrangementPayment.mockResolvedValue({
      checkout_url: 'https://pay.example/so_open_payment',
      already_succeeded: false,
      superseded: false,
    });

    show();
    await userEvent.click(await screen.findByRole('button', { name: /Complete this payment/ }));

    // The arrangement is named, never the payment reference. Which payment can
    // settle it is the server's decision, because only the server knows whether
    // the terms have moved since the open one was created.
    await waitFor(() => expect(completeArrangementPayment).toHaveBeenCalledWith('arr_1'));
    expect(startCheckout).not.toHaveBeenCalled();
    await waitFor(() => expect(sentTo).toBe('https://pay.example/so_open_payment'));
  });

  it('says the amount changed before sending the customer to a repriced checkout', async () => {
    listBillingArrangements.mockResolvedValue([arrangement()]);
    completeArrangementPayment.mockResolvedValue({
      checkout_url: 'https://pay.example/repriced',
      already_succeeded: false,
      superseded: true,
    });

    show();
    await userEvent.click(await screen.findByRole('button', { name: /Complete this payment/ }));

    // Arriving at a checkout showing a different number than the page just
    // showed, with no explanation, reads as the platform having got it wrong.
    expect(await screen.findByText(/new payment was prepared at the current amount/)).toBeInTheDocument();
    await waitFor(() => expect(sentTo).toBe('https://pay.example/repriced'));
  });

  it('links the arrangement through to the payment detail page the Transactions list opens', async () => {
    listBillingArrangements.mockResolvedValue([
      arrangement({ payment_reference: 'so_open_payment' }),
    ]);

    show();

    const link = await screen.findByRole('link', { name: /View payment so_open_payment/ });
    // The same path the Transactions list hands to the router for one payment,
    // taken from the one place that path is written down.
    expect(link).toHaveAttribute('href', transactionDetailPath('so_open_payment'));
  });

  it('offers opening the payment and resuming it as two separate things', async () => {
    listBillingArrangements.mockResolvedValue([arrangement()]);

    show();

    expect(await screen.findByRole('button', { name: /Complete this payment/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View payment/ })).toBeInTheDocument();
    expect(completeArrangementPayment).not.toHaveBeenCalled();
  });

  it('still links to the payment when it can no longer be resumed', async () => {
    listBillingArrangements.mockResolvedValue([arrangement({ resumable: false })]);

    show();

    // The payment stays reachable whether or not it can be returned to: it is
    // still the record of what happened. Whether paying is offered alongside it
    // is a separate question, and one the server answers.
    expect(await screen.findByRole('link', { name: /View payment so_open_payment/ })).toBeInTheDocument();
  });

  it('links nowhere when the arrangement carries no payment reference', async () => {
    listBillingArrangements.mockResolvedValue([
      arrangement({ payment_reference: undefined, resumable: false }),
    ]);

    show();

    await screen.findByText('Pro plan');
    expect(screen.queryByRole('link', { name: /View payment/ })).not.toBeInTheDocument();
  });

  it('says the completing payment is the one already waiting rather than a new charge', async () => {
    listBillingArrangements.mockResolvedValue([arrangement()]);

    show();

    expect(
      await screen.findByText(/never starts a second payment for the same thing/i),
    ).toBeInTheDocument();
  });

  it('reads a free grant as no charge and offers nothing to pay', async () => {
    listBillingArrangements.mockResolvedValue([
      arrangement({
        condition: 'free_grant',
        status: 'active',
        amount_minor: undefined,
        currency: undefined,
        payment_deadline: undefined,
        payment_reference: undefined,
        resumable: false,
      }),
    ]);

    show();

    expect(await screen.findByText('No charge')).toBeInTheDocument();
    expect(screen.getByText('Nothing to pay')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete this payment/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Outstanding')).not.toBeInTheDocument();
    expect(screen.queryByText(money(0, 'USD'))).not.toBeInTheDocument();
  });

  it('never offers a payment on a free grant that still carries an amount', async () => {
    listBillingArrangements.mockResolvedValue([
      arrangement({ condition: 'free_grant', status: 'active' }),
    ]);

    show();

    expect(await screen.findByText('No charge')).toBeInTheDocument();
    expect(screen.queryByText(money(150000, 'USD'))).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete this payment/ })).not.toBeInTheDocument();
  });

  it('offers nothing to complete on a settled arrangement and reads it as history', async () => {
    listBillingArrangements.mockResolvedValue([
      arrangement({ condition: 'offline_settled', status: 'completed' }),
    ]);

    show();

    expect(await screen.findByText(/Settled\. Nothing is outstanding on it\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete this payment/ })).not.toBeInTheDocument();
    expect(completeArrangementPayment).not.toHaveBeenCalled();
  });

  it('offers nothing to complete on a revoked arrangement and reads it as history', async () => {
    listBillingArrangements.mockResolvedValue([arrangement({ status: 'revoked' })]);

    show();

    expect(
      await screen.findByText(/Access on this arrangement was withdrawn\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete this payment/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Outstanding')).not.toBeInTheDocument();
  });

  it('offers nothing to complete on a cancelled or expired arrangement', async () => {
    listBillingArrangements.mockResolvedValue([
      arrangement({ id: 'arr_cancelled', status: 'cancelled' }),
      arrangement({ id: 'arr_expired', status: 'expired' }),
    ]);

    show();

    expect(await screen.findByText(/Cancelled\. Nothing is owed on it\./)).toBeInTheDocument();
    expect(screen.getByText(/Expired without payment\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete this payment/ })).not.toBeInTheDocument();
  });

  it('reads a deadline that has already passed as overdue', async () => {
    const passed = daysFromNow(-5);
    listBillingArrangements.mockResolvedValue([arrangement({ payment_deadline: passed })]);

    show();

    expect(await screen.findByText(`Overdue since ${day(passed)}`)).toBeInTheDocument();
  });

  it('leaves an absent amount unstated rather than showing it as zero', async () => {
    listBillingArrangements.mockResolvedValue([
      arrangement({ amount_minor: undefined, currency: undefined }),
    ]);

    show();

    expect(await screen.findByText('Amount not stated yet')).toBeInTheDocument();
    expect(screen.queryByText(money(0, 'USD'))).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('still offers to pay an outstanding debt with no payment open for it', async () => {
    // The case the panel used to give up on. An Admin correcting the price
    // voids the checkout that would have charged the old figure, so an
    // arrangement that is very much owed has nothing open against it, and this
    // is exactly when the customer most needs to be able to pay.
    listBillingArrangements.mockResolvedValue([
      arrangement({ payment_reference: undefined, resumable: false }),
    ]);
    completeArrangementPayment.mockResolvedValue({
      checkout_url: 'https://pay.example/fresh',
      already_succeeded: false,
      superseded: false,
    });

    show();
    await userEvent.click(await screen.findByRole('button', { name: /Complete this payment/ }));

    await waitFor(() => expect(completeArrangementPayment).toHaveBeenCalledWith('arr_1'));
    await waitFor(() => expect(sentTo).toBe('https://pay.example/fresh'));
  });

  it('offers to pay a debt whose open payment can no longer be returned to', async () => {
    // Not resumable is not the same as not payable, and reading it as though it
    // were is what left a customer looking at a debt with no way to settle it.
    listBillingArrangements.mockResolvedValue([arrangement({ resumable: false })]);

    show();

    await screen.findByText('Pro plan');
    expect(screen.getByRole('button', { name: /Complete this payment/ })).toBeInTheDocument();
  });

  it('offers no way to pay for access that was withdrawn', async () => {
    // A revoked grant reads as finished, so it is summarised rather than given a
    // card of its own. What matters either way is that there is no route from
    // here to paying for access the customer no longer has.
    listBillingArrangements.mockResolvedValue([
      arrangement({
        status: 'revoked',
        unpayable_reason: 'This access was withdrawn, so the payment is no longer required.',
      }),
    ]);

    show();

    await screen.findByText(/Pro/);
    expect(screen.queryByRole('button', { name: /Complete this payment/ })).not.toBeInTheDocument();
    expect(completeArrangementPayment).not.toHaveBeenCalled();
  });

  it('surfaces the backend message when resuming the payment fails', async () => {
    listBillingArrangements.mockResolvedValue([arrangement()]);
    completeArrangementPayment.mockRejectedValue(
      new TransactionActionError('not_pending', 'This payment is no longer pending.'),
    );

    show();
    await userEvent.click(await screen.findByRole('button', { name: /Complete this payment/ }));

    expect(await screen.findByText('This payment is no longer pending.')).toBeInTheDocument();
    expect(screen.getByText(/Try again, or open Transactions/)).toBeInTheDocument();
  });

  it('surfaces the backend message when the resume request itself is refused', async () => {
    listBillingArrangements.mockResolvedValue([arrangement()]);
    completeArrangementPayment.mockRejectedValue(new ApiError(409, 'conflict', 'The gateway rejected this.'));

    show();
    await userEvent.click(await screen.findByRole('button', { name: /Complete this payment/ }));

    expect(await screen.findByText('The gateway rejected this.')).toBeInTheDocument();
  });

  it('says so rather than inventing a redirect when the payment already went through', async () => {
    listBillingArrangements.mockResolvedValue([arrangement()]);
    completeArrangementPayment.mockResolvedValue({
      checkout_url: '',
      already_succeeded: true,
      superseded: false,
    });

    show();
    await userEvent.click(await screen.findByRole('button', { name: /Complete this payment/ }));

    expect(await screen.findByText(/That payment already went through/)).toBeInTheDocument();
    expect(sentTo).toBe('');
  });

  it('shows no panel when there are no arrangements', async () => {
    listBillingArrangements.mockResolvedValue([]);

    const { container } = show();

    await waitFor(() => expect(listBillingArrangements).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows no panel when the arrangements endpoint fails', async () => {
    listBillingArrangements.mockRejectedValue(new ApiError(503, 'unavailable', 'Not available.'));

    const { container } = show();

    await waitFor(() => expect(listBillingArrangements).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Not available.')).not.toBeInTheDocument();
  });
});
