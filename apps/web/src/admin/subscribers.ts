import type { AdminPaymentStatus, AdminSubscriber } from '@slideops/api-client';

/*
 * How billing is read and phrased on the Admin surface. Pure, so it is testable
 * without a screen, and so the wording lives in one place instead of being
 * scattered through the markup.
 */

/**
 * Format an amount held in the smallest currency unit.
 *
 * The API sends minor units because that is the only representation that does
 * not lose money to rounding, and every payment provider works in them. Dividing
 * by a hundred here is not universally correct, since a few currencies have no
 * minor unit at all, but Intl knows which and is told the currency rather than
 * being guessed at.
 */
export function formatAmount(minor: number, currency?: string): string {
  if (!currency) {
    // Without a currency there is nothing honest to render but the number, and
    // showing a symbol we invented would be worse than showing none.
    return (minor / 100).toFixed(2);
  }
  try {
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(minor / 10 ** digits);
  } catch {
    // An unrecognised currency code should not blank a billing screen.
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

/** How one payment's own status reads on the Admin surface -- the exact same
 *  words the Operator's own Transactions page uses for the same status,
 *  never a generic "Pending Transaction" or a raw status code. One status
 *  vocabulary, not two. */
export const paymentStatusLabel: Record<AdminPaymentStatus, string> = {
  pending: 'Pending Payment',
  success: 'Payment Successful',
  failed: 'Payment Failed',
  cancelled: 'Payment Cancelled',
  refunded: 'Payment Refunded',
  disputed: 'Payment Disputed',
};

export const paymentStatusTone: Record<AdminPaymentStatus, 'good' | 'warning' | 'bad' | 'neutral'> = {
  pending: 'warning',
  success: 'good',
  failed: 'bad',
  cancelled: 'neutral',
  refunded: 'neutral',
  disputed: 'bad',
};

/** How a subscriber's standing reads, and how strongly it should be shown. */
export type SubscriberStanding = {
  label: string;
  tone: 'good' | 'warning' | 'bad' | 'neutral';
  /** Why it reads that way, shown as a hint rather than left to be inferred. */
  detail: string;
};

/** How many days from now until a date, negative when it has passed. */
function daysUntil(when: string, now: Date): number {
  const ms = new Date(when).getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/** The window in which an active subscription is worth flagging as ending. */
const endingSoonDays = 30;

/**
 * Read a subscriber's standing.
 *
 * The account tier and the subscription tier can disagree, and that disagreement
 * is the useful part rather than a glitch: an Admin granted tier moves the account
 * without touching the subscription, and a lapse returns the account to Free while
 * the subscription row stays for the record. Both cases are named here so nobody
 * has to work out which one they are looking at.
 */
export function standingOf(
  subscriber: AdminSubscriber,
  now: Date = new Date(),
): SubscriberStanding {
  if (!subscriber.status) {
    return subscriber.payments > 0
      ? {
          label: 'Never subscribed',
          tone: 'bad',
          detail: 'They attempted a payment and it did not complete.',
        }
      : { label: 'No subscription', tone: 'neutral', detail: 'No payment has been attempted.' };
  }

  if (subscriber.status === 'active') {
    const ends = subscriber.current_period_end;
    if (ends) {
      const days = daysUntil(ends, now);
      if (days < 0) {
        return {
          label: 'Overdue',
          tone: 'bad',
          detail: 'The paid period has ended but the subscription still reads active.',
        };
      }
      if (days <= endingSoonDays) {
        return {
          label: days === 0 ? 'Ends today' : `Ends in ${days} day${days === 1 ? '' : 's'}`,
          tone: 'warning',
          detail: 'It renews or lapses shortly.',
        };
      }
    }
    return { label: 'Active', tone: 'good', detail: 'Paid and current.' };
  }

  if (subscriber.status === 'paused') {
    return {
      label: 'Paused',
      tone: 'warning',
      detail: subscriber.pause_reason
        ? `Held by an Admin: ${subscriber.pause_reason}. Resuming restores ${subscriber.paused_previous_tier || 'the prior tier'} exactly.`
        : `Held by an Admin. Resuming restores ${subscriber.paused_previous_tier || 'the prior tier'} exactly.`,
    };
  }

  const onFree = subscriber.account_tier === 'free';
  return {
    label: subscriber.status === 'canceled' ? 'Cancelled' : 'Lapsed',
    tone: 'bad',
    detail: onFree
      ? 'The account has returned to Free. The subscription is kept for the record.'
      : `The subscription ended, but the account is still on ${subscriber.account_tier}. An Admin granted tier does that, and it is not a fault.`,
  };
}

/**
 * Whether the account tier and the subscription tier disagree in a way worth
 * pointing at. A subscription that has ended is expected to leave the account on
 * Free, so that is not a mismatch, it is the system working.
 */
export function tierMismatch(subscriber: AdminSubscriber): boolean {
  if (!subscriber.subscription_tier) {
    return false;
  }
  if (subscriber.status !== 'active') {
    return subscriber.account_tier !== 'free';
  }
  return subscriber.account_tier !== subscriber.subscription_tier;
}
