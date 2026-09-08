import type { BillingArrangement } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import { accessReading, nextStep, statusReading, termReading } from './billing-arrangements';

/*
 * The readings the detail view is built out of.
 *
 * Each of these exists because the summary card answers "what do I owe" and
 * nothing else. What is tested here is not that they format a string, but that
 * they never state something nobody agreed: a term that was never recorded, an
 * access period read off the payment deadline, or a next step that tells
 * somebody to pay something the panel gives them no way to pay.
 */

const dayMs = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * dayMs).toISOString();
}

function arrangement(over: Partial<BillingArrangement> = {}): BillingArrangement {
  return {
    id: 'arr_1',
    tier: 'pro',
    condition: 'temporary_access',
    status: 'awaiting_payment',
    amount_minor: 150000,
    currency: 'USD',
    payable: true,
    created_at: daysFromNow(-4),
    ...over,
  };
}

describe('how long the amount covers', () => {
  it('says nothing at all when no term was recorded', () => {
    // Every arrangement made before the term was stored carries none. Reading
    // that as a month would state a billing period nobody agreed to.
    expect(termReading(arrangement())).toBeNull();
    expect(termReading(arrangement({ term_months: 0 }))).toBeNull();
  });

  it('reads a year as a year rather than as twelve months', () => {
    expect(termReading(arrangement({ term_months: 12 }))).toBe('1 year');
    expect(termReading(arrangement({ term_months: 1 }))).toBe('1 month');
    expect(termReading(arrangement({ term_months: 3 }))).toBe('3 months');
  });
});

describe('when the access itself runs', () => {
  it('is nothing when neither end of the period is known', () => {
    // Deliberately not falling back to the payment deadline. Temporary access
    // is exactly the case where the two differ.
    expect(accessReading(arrangement({ payment_deadline: daysFromNow(5) }))).toBeNull();
  });

  it('counts down the access that is left, not the money that is due', () => {
    const reading = accessReading(
      arrangement({ access_start: daysFromNow(-4), access_end: daysFromNow(6) }),
    );
    expect(reading?.note).toBe('6 days of access left.');
  });

  it('says access has ended once it has', () => {
    const reading = accessReading(arrangement({ access_end: daysFromNow(-1) }));
    expect(reading?.note).toBe('This access has ended.');
  });

  it('states an open-ended period without inventing an end for it', () => {
    const reading = accessReading(arrangement({ access_start: daysFromNow(-4) }));
    expect(reading?.period).toMatch(/^From /);
    expect(reading?.note).toBeNull();
  });
});

describe('what the customer should do about it', () => {
  it('never asks a gift to be paid for', () => {
    expect(
      nextStep(arrangement({ condition: 'free_grant', status: 'active', payable: false })),
    ).toBe('Nothing is expected of you. Use the plan.');
  });

  it('gives the server its own words when there is nothing to pay', () => {
    // Never a guess made from the status: the server is the one that knows why
    // it refused, and the button is enabled from the same field.
    expect(
      nextStep(arrangement({ payable: false, unpayable_reason: 'This access was withdrawn.' })),
    ).toBe('This access was withdrawn.');
  });

  it('names the deadline for a debt that has one, and does not invent one otherwise', () => {
    expect(nextStep(arrangement({ payment_deadline: daysFromNow(9) }))).toMatch(
      /^Complete the payment by /,
    );
    expect(nextStep(arrangement())).toBe(
      'Complete the payment when you are ready. No deadline was set.',
    );
  });

  it('reads an overdue payment as still settleable rather than as lost', () => {
    expect(nextStep(arrangement({ payment_deadline: daysFromNow(-2) }))).toBe(
      'This payment is past its deadline. Completing it now settles it.',
    );
  });

  it('speaks in the past tense about a matter that is closed', () => {
    expect(nextStep(arrangement({ status: 'revoked', payable: false }))).toBe(
      'Access on this arrangement was withdrawn.',
    );
  });
});

describe('the arrangement status', () => {
  it('never shows the wire value to a person', () => {
    expect(statusReading(arrangement()).label).toBe('Awaiting payment');
    expect(statusReading(arrangement({ status: 'revoked' })).label).toBe('Withdrawn');
    expect(statusReading(arrangement({ status: 'completed' })).tone).toBe('success');
  });
});
