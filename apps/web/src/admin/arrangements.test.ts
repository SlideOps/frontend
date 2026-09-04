import { describe, expect, it } from 'vitest';
import type { Arrangement } from '@slideops/api-client';
import { deadlineUrgency, isEditable } from './arrangements';

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
