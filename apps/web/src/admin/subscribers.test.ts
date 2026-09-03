import { describe, expect, it } from 'vitest';
import type { AdminSubscriber } from '@slideops/api-client';
import { formatAmount, standingOf, tierMismatch } from './subscribers';

function subscriber(over: Partial<AdminSubscriber> = {}): AdminSubscriber {
  return {
    operator_id: 'op-1',
    email: 'someone@example.com',
    account_tier: 'pro',
    payments: 0,
    paid_minor: 0,
    ...over,
  };
}

const now = new Date('2026-07-30T00:00:00Z');

describe('formatAmount', () => {
  it('renders minor units as money, in the currency the payment was taken in', () => {
    expect(formatAmount(1500000, 'NGN')).toContain('15,000');
    expect(formatAmount(4999, 'USD')).toContain('49.99');
  });

  // A currency SlideOps does not recognise must not blank a billing screen.
  it('falls back to the number rather than failing on an unknown currency', () => {
    expect(formatAmount(1000, 'XYZ')).toContain('10.00');
  });

  // Inventing a symbol would be worse than showing none.
  it('shows the bare number when there is no currency to show', () => {
    expect(formatAmount(1000)).toBe('10.00');
  });
});

describe('standingOf', () => {
  it('calls a paid, current subscription active', () => {
    const standing = standingOf(
      subscriber({ status: 'active', current_period_end: '2026-12-01T00:00:00Z' }),
      now,
    );
    expect(standing).toMatchObject({ label: 'Active', tone: 'good' });
  });

  // The one number worth acting on: it renews or it lapses shortly.
  it('warns when an active subscription is about to end, and says how soon', () => {
    const standing = standingOf(
      subscriber({ status: 'active', current_period_end: '2026-08-09T00:00:00Z' }),
      now,
    );
    expect(standing.tone).toBe('warning');
    expect(standing.label).toBe('Ends in 10 days');
  });

  // Active with a period that has already passed is not a healthy subscription,
  // it is one nothing has reconciled.
  it('calls an active subscription whose period has passed overdue', () => {
    const standing = standingOf(
      subscriber({ status: 'active', current_period_end: '2026-07-01T00:00:00Z' }),
      now,
    );
    expect(standing).toMatchObject({ label: 'Overdue', tone: 'bad' });
  });

  it('separates someone who never subscribed from someone whose payment failed', () => {
    expect(standingOf(subscriber({ account_tier: 'free' }), now).label).toBe('No subscription');
    expect(standingOf(subscriber({ account_tier: 'free', payments: 2 }), now).label).toBe(
      'Never subscribed',
    );
  });

  // A lapse returning the account to Free is the system working, and the wording
  // should not imply somebody needs to fix it.
  it('explains a lapse that returned the account to Free as expected', () => {
    const standing = standingOf(
      subscriber({ status: 'expired', account_tier: 'free', subscription_tier: 'pro' }),
      now,
    );
    expect(standing.label).toBe('Lapsed');
    expect(standing.detail).toMatch(/returned to Free/i);
  });

  // A lapsed subscription with the account still on a paid tier is an Admin
  // granted tier, which is legitimate and should say so rather than look wrong.
  it('explains a lapse where the account kept a paid tier', () => {
    const standing = standingOf(
      subscriber({ status: 'expired', account_tier: 'pro', subscription_tier: 'pro' }),
      now,
    );
    expect(standing.detail).toMatch(/Admin granted tier/i);
  });

  // A pause is an Admin hold, not an organic lapse or a fault, and must read
  // differently from both -- warning, not bad, and never blamed on the Operator.
  it('reads a paused subscription as an Admin hold, not a lapse', () => {
    const standing = standingOf(
      subscriber({
        status: 'paused',
        account_tier: 'free',
        subscription_tier: 'pro',
        pause_reason: 'payment dispute',
        paused_previous_tier: 'pro',
      }),
      now,
    );
    expect(standing.label).toBe('Paused');
    expect(standing.tone).toBe('warning');
    expect(standing.detail).toMatch(/payment dispute/i);
    expect(standing.detail).toMatch(/pro/i);
  });

  it('still explains a pause with no reason on record', () => {
    const standing = standingOf(subscriber({ status: 'paused', account_tier: 'free' }), now);
    expect(standing.label).toBe('Paused');
    expect(standing.detail).not.toBe('');
  });
});

describe('tierMismatch', () => {
  it('is quiet when the account matches the subscription', () => {
    expect(
      tierMismatch(subscriber({ status: 'active', account_tier: 'pro', subscription_tier: 'pro' })),
    ).toBe(false);
  });

  it('flags an account on a different tier from the one it pays for', () => {
    expect(
      tierMismatch(
        subscriber({ status: 'active', account_tier: 'business', subscription_tier: 'pro' }),
      ),
    ).toBe(true);
  });

  // A subscription that ended is meant to leave the account on Free, so that is
  // the system working rather than something to point at.
  it('does not flag a lapse that correctly returned the account to Free', () => {
    expect(
      tierMismatch(
        subscriber({ status: 'expired', account_tier: 'free', subscription_tier: 'pro' }),
      ),
    ).toBe(false);
  });

  it('flags a lapse where the account still holds a paid tier', () => {
    expect(
      tierMismatch(
        subscriber({ status: 'expired', account_tier: 'pro', subscription_tier: 'pro' }),
      ),
    ).toBe(true);
  });
});
