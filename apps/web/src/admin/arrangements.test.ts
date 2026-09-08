import { describe, expect, it } from 'vitest';
import { ApiError, type Arrangement, type ArrangementWithOperator } from '@slideops/api-client';
import {
  accessReading,
  arrangementEdit,
  deadlineUrgency,
  isEditable,
  isStaleEditorError,
  matchesArrangementSearch,
  matchesLifecycleFilter,
  obligationOf,
  obligationText,
  paymentReading,
  readIfSupported,
  type ArrangementEditDraft,
  type ArrangementFacts,
} from './arrangements';

function arrangement(over: Partial<Arrangement> = {}): Arrangement {
  return {
    id: 'arr-1',
    operator_id: 'op-1',
    tier: 'starter',
    amount_minor: 0,
    condition: 'payment_required',
    status: 'awaiting_payment',
    auto_expire_on_deadline: false,
    created_by_operator_id: 'admin-1',
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

const now = new Date('2026-07-30T00:00:00Z');

describe('deadlineUrgency', () => {
  it('reads nothing to warn about without a deadline', () => {
    expect(deadlineUrgency(arrangement(), now)).toBeNull();
  });

  it('reads nothing to warn about once the arrangement is no longer awaiting payment', () => {
    const standing = deadlineUrgency(
      arrangement({ status: 'completed', payment_deadline: '2026-07-31T00:00:00Z' }),
      now,
    );
    expect(standing).toBeNull();
  });

  it('flags a passed deadline as passed', () => {
    const standing = deadlineUrgency(
      arrangement({ payment_deadline: '2026-07-29T00:00:00Z' }),
      now,
    );
    expect(standing).toMatchObject({ label: 'Deadline passed', tone: 'bad' });
  });

  it('flags a deadline due today', () => {
    const standing = deadlineUrgency(
      arrangement({ payment_deadline: '2026-07-30T00:00:00Z' }),
      now,
    );
    expect(standing).toMatchObject({ label: 'Due today', tone: 'bad' });
  });

  it('warns when a deadline is close, and says how soon', () => {
    const standing = deadlineUrgency(
      arrangement({ payment_deadline: '2026-08-01T00:00:00Z' }),
      now,
    );
    expect(standing).toMatchObject({ label: 'Due in 2 days', tone: 'warning' });
  });

  it('reads a distant deadline calmly', () => {
    const standing = deadlineUrgency(
      arrangement({ payment_deadline: '2026-08-20T00:00:00Z' }),
      now,
    );
    expect(standing).toMatchObject({ tone: 'neutral' });
  });
});

describe('isEditable', () => {
  it('allows cancelling or extending only while awaiting payment', () => {
    expect(isEditable(arrangement({ status: 'awaiting_payment' }))).toBe(true);
  });

  it('refuses once an arrangement has settled one way or another', () => {
    expect(isEditable(arrangement({ status: 'active' }))).toBe(false);
    expect(isEditable(arrangement({ status: 'completed' }))).toBe(false);
    expect(isEditable(arrangement({ status: 'expired' }))).toBe(false);
    expect(isEditable(arrangement({ status: 'cancelled' }))).toBe(false);
  });
});

/*
 * The lifecycle readings.
 *
 * What is asserted here is the property that makes the console readable: access,
 * payment, and what is owed are three answers, they are allowed to disagree, and
 * an amount nobody recorded is never turned into a zero.
 */

function facts(over: Partial<ArrangementFacts> = {}): ArrangementFacts {
  return {
    condition: 'temporary_access',
    status: 'awaiting_payment',
    amount_minor: 15000000,
    currency: 'NGN',
    payment_deadline: '2026-08-22T00:00:00Z',
    ...over,
  };
}

function row(over: Partial<ArrangementWithOperator> = {}): ArrangementWithOperator {
  return {
    id: 'arr-1',
    operator_id: 'op-1',
    operator_email: 'chidi@example.test',
    tier: 'pro',
    amount_minor: 15000000,
    currency: 'NGN',
    condition: 'temporary_access',
    status: 'awaiting_payment',
    auto_expire_on_deadline: false,
    created_by_operator_id: 'admin-1',
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  };
}

describe('the three readings', () => {
  it('answers access, payment and what is owed separately for one temporary grant', () => {
    const live = facts();
    expect(accessReading(live, now).label).toBe('Active');
    expect(paymentReading(live, now).label).toBe('Pending');
    expect(obligationText(obligationOf(live, now))).toMatch(/150,000/);
    expect(obligationText(obligationOf(live, now))).toMatch(/due by/);
  });

  it('grants nothing under a payment-required arrangement until the payment lands', () => {
    const waiting = facts({ condition: 'payment_required' });
    expect(accessReading(waiting, now).label).toBe('Not granted');
    expect(paymentReading(waiting, now).label).toBe('Pending');
  });

  it('reads an offline payment as access granted and money already in', () => {
    const settled = facts({ condition: 'offline_settled', status: 'active' });
    expect(accessReading(settled, now).label).toBe('Active');
    expect(paymentReading(settled, now).label).toBe('Paid');
    expect(obligationText(obligationOf(settled, now))).toMatch(/paid$/);
  });

  it('calls a payment overdue once its deadline has passed, without touching access', () => {
    const late = facts({ payment_deadline: '2026-07-01T00:00:00Z' });
    expect(accessReading(late, now).label).toBe('Active');
    expect(paymentReading(late, now).label).toBe('Overdue');
  });

  it('never reports an amount nobody recorded as a zero', () => {
    expect(obligationOf(facts({ amount_minor: undefined }), now).kind).toBe('unknown');
    expect(obligationOf(facts({ amount_minor: null }), now).kind).toBe('unknown');
    expect(obligationOf(facts({ amount_minor: 0 }), now).kind).toBe('unknown');
    expect(obligationText(obligationOf(facts({ amount_minor: 0 }), now))).toBe(
      'Amount not recorded',
    );
  });

  it('says nothing is owed only where the backend says no payment applies', () => {
    expect(obligationOf(facts({ amount_applicable: false }), now).kind).toBe('none');
    expect(obligationText(obligationOf(facts({ amount_applicable: false }), now))).toBe(
      'Nothing owed',
    );
  });

  it('shows money in the currency the backend gave, never a symbol of its own', () => {
    const inDollars = obligationText(obligationOf(facts({ currency: 'USD' }), now));
    const inNaira = obligationText(obligationOf(facts({ currency: 'NGN' }), now));
    expect(inDollars).not.toBe(inNaira);
    expect(inDollars).toMatch(/150,000/);
  });

  it('prefers the words the backend used over its own reading', () => {
    const stated = facts({ access_state: 'revoked', payment_state: 'paid' });
    expect(accessReading(stated, now).label).toBe('Revoked');
    expect(paymentReading(stated, now).label).toBe('Paid');
  });

  it('shows an unfamiliar backend word as the backend said it', () => {
    const odd = accessReading(facts({ access_state: 'held_for_review' }), now);
    expect(odd.label).toBe('Held for review');
    expect(odd.detail).toMatch(/held_for_review/);
  });
});

describe('narrowing the list', () => {
  it('finds arrangements whose access is live', () => {
    expect(matchesLifecycleFilter(facts(), 'active', now)).toBe(true);
    expect(matchesLifecycleFilter(facts({ status: 'expired' }), 'active', now)).toBe(false);
  });

  it('finds arrangements whose payment has not arrived', () => {
    expect(matchesLifecycleFilter(facts(), 'unpaid', now)).toBe(true);
    expect(
      matchesLifecycleFilter(facts({ condition: 'offline_settled' }), 'unpaid', now),
    ).toBe(false);
  });

  it('separates a payment still pending from one that has already run late', () => {
    const late = facts({ payment_deadline: '2026-07-01T00:00:00Z' });
    expect(matchesLifecycleFilter(late, 'pending_payment', now)).toBe(false);
    expect(matchesLifecycleFilter(late, 'unpaid', now)).toBe(true);
  });

  it('finds arrangements about to run out, and leaves distant ones alone', () => {
    expect(
      matchesLifecycleFilter(facts({ access_end: '2026-08-02T00:00:00Z' }), 'expiring_soon', now),
    ).toBe(true);
    expect(
      matchesLifecycleFilter(facts({ access_end: '2026-12-01T00:00:00Z' }), 'expiring_soon', now),
    ).toBe(false);
  });

  it('finds access that was taken back, and does not confuse it with access that lapsed', () => {
    expect(matchesLifecycleFilter(facts({ access_state: 'revoked' }), 'revoked', now)).toBe(true);
    expect(matchesLifecycleFilter(facts({ status: 'expired' }), 'revoked', now)).toBe(false);
    expect(matchesLifecycleFilter(facts({ status: 'expired' }), 'expired', now)).toBe(true);
  });

  it('keeps everything under the all filter', () => {
    expect(matchesLifecycleFilter(facts({ status: 'cancelled' }), 'all', now)).toBe(true);
  });

  it('finds a customer by email, by plan, and by amount typed with or without separators', () => {
    expect(matchesArrangementSearch(row(), 'chidi')).toBe(true);
    expect(matchesArrangementSearch(row(), 'PRO')).toBe(true);
    expect(matchesArrangementSearch(row(), '150,000')).toBe(true);
    expect(matchesArrangementSearch(row(), '150000')).toBe(true);
    expect(matchesArrangementSearch(row(), 'someone else')).toBe(false);
  });

  it('matches everything on an empty search', () => {
    expect(matchesArrangementSearch(row(), '   ')).toBe(true);
  });
});

describe('editing an arrangement', () => {
  const before: ArrangementEditDraft = {
    tier: 'pro',
    amountMinor: '15000000',
    currency: 'NGN',
    paymentDeadline: '2026-08-22T00:00',
    accessEnd: '',
    notes: 'Agreed by phone',
  };

  it('sends only the fields that changed', () => {
    const { patch } = arrangementEdit(before, { ...before, tier: 'enterprise' });
    expect(patch).toEqual({ tier: 'enterprise' });
  });

  it('describes each change before it is saved, in readable money and dates', () => {
    const { changes } = arrangementEdit(before, { ...before, amountMinor: '20000000' });
    expect(changes).toHaveLength(1);
    expect(changes[0]?.label).toBe('Amount');
    expect(changes[0]?.from).toMatch(/150,000/);
    expect(changes[0]?.to).toMatch(/200,000/);
  });

  it('leaves a cleared amount out rather than sending a zero', () => {
    const { patch, changes } = arrangementEdit(before, { ...before, amountMinor: '' });
    expect(patch.amountMinor).toBeUndefined();
    expect(changes).toHaveLength(0);
  });

  it('clears a date by sending an explicit null rather than dropping the field', () => {
    const { patch } = arrangementEdit(before, { ...before, paymentDeadline: '' });
    expect(patch.paymentDeadline).toBeNull();
  });

  it('sends nothing at all when nothing was touched', () => {
    const { patch, changes } = arrangementEdit(before, { ...before });
    expect(changes).toHaveLength(0);
    expect(patch).toEqual({});
  });
});

describe('another admin getting there first', () => {
  it('reads a 409 as the arrangement having changed since it was opened', () => {
    expect(isStaleEditorError(new ApiError(409, 'conflict', 'changed'))).toBe(true);
  });

  it('does not mistake any other failure for a stale editor', () => {
    expect(isStaleEditorError(new ApiError(400, 'invalid', 'bad'))).toBe(false);
    expect(isStaleEditorError(new Error('offline'))).toBe(false);
  });
});

describe('an endpoint this server build does not have', () => {
  it('reports a missing route as an absence rather than a failure', async () => {
    const missing = new ApiError(404, 'unknown_error', 'no such endpoint');
    await expect(readIfSupported(() => Promise.reject(missing))).resolves.toBeNull();
  });

  it('lets a real not-found through, because that is about the arrangement', async () => {
    const gone = new ApiError(404, 'arrangement_not_found', 'no such arrangement');
    await expect(readIfSupported(() => Promise.reject(gone))).rejects.toBe(gone);
  });
});
