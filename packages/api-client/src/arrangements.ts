import type { ArrangementCondition } from './admin';
import { apiRequest } from './http';

/*
 * The Operator's own view of the payment arrangements made for them.
 *
 * An Admin can grant access ahead of payment. Until now the only place that
 * decision reached the customer was the email announcing it, so the person who
 * owed money had nowhere in the product to see what for, or to finish paying
 * it. This is that place.
 *
 * The request is scoped to the session, so there is no id to pass and no way
 * to name somebody else's arrangement. The response is deliberately narrower
 * than the Admin one: the Admin's private note and their external reference
 * are not in it, and nothing here goes looking for them.
 */

/**
 * The arrangement's own lifecycle as the customer sees it.
 *
 * Wider than the Admin list's vocabulary by one value: `revoked`, for access
 * that was withdrawn rather than allowed to lapse. The customer surface is the
 * one that has to tell those two apart, since only one of them is something
 * that happened *to* them.
 */
export type BillingArrangementStatus =
  'awaiting_payment' | 'active' | 'completed' | 'expired' | 'cancelled' | 'revoked';

/** One arrangement, as the Operator's own Billing page shows it. */
export interface BillingArrangement {
  id: string;
  tier: string;
  /**
   * What is owed, in minor units. Absent when nothing was stated, which is not
   * the same as zero: rendering an absent amount as a zero would tell the
   * customer they owe nothing when nobody has said so.
   */
  amount_minor?: number;
  /** The currency the amount is in, absent whenever the amount is. */
  currency?: string;
  condition: ArrangementCondition;
  status: BillingArrangementStatus;
  /** When payment is expected, absent when no deadline was set. */
  payment_deadline?: string;
  /** The payment already open for this debt, absent when there is none. */
  payment_reference?: string;
  /** Whether that payment can still be returned to. */
  resumable?: boolean;
  /**
   * Whether there is anything to pay right now. This is the field a screen
   * decides on, and it is not the same question as `resumable`.
   *
   * An arrangement whose terms an Admin has just renegotiated is payable with
   * nothing resumable behind it: the open checkout was voided because it would
   * have charged the old figure, and completing it opens one at the new figure.
   * `resumable` only says which route the server will take to get there, which
   * is the server's business rather than the screen's.
   */
  payable?: boolean;
  /** Why there is nothing to pay, for showing in place of a button that cannot
   *  work. Absent when `payable`. */
  unpayable_reason?: string;
  /**
   * When the access itself runs, which is deliberately not the payment
   * deadline. Temporary access is exactly the case where the two differ, and
   * showing one as the other is what made a grant impossible to describe.
   */
  access_start?: string;
  access_end?: string;
  /** How many months the amount covers, absent when it was never recorded. */
  term_months?: number;
  created_at: string;
}

/**
 * What completing an arranged payment produced.
 *
 * `already_succeeded` means the debt turned out to be settled while the
 * customer was looking at it, from another tab or a webhook that arrived first;
 * there is no checkout to go to and the screen shows the receipt instead.
 *
 * `superseded` means the payment that was open could no longer settle this debt,
 * because an Admin changed the tier, the amount or the currency after it was
 * created. A provider fixes those when a checkout is made and cannot reprice
 * one, so a new checkout was opened at the current terms and the old one
 * voided. The customer is told the figure moved rather than quietly charged
 * something other than the number they were last shown.
 */
export interface ArrangementPaymentResult {
  checkout_url: string;
  already_succeeded: boolean;
  superseded: boolean;
  arrangement: BillingArrangement;
}

/**
 * Pay what was arranged, through the one endpoint that decides how.
 *
 * It never opens a second debt, and calling it twice returns the same checkout,
 * so an impatient customer is charged once. Which of resuming and reopening
 * happens is decided by the server against the arrangement's current terms,
 * because only the server knows whether they have moved since the checkout was
 * made.
 */
export function completeArrangementPayment(
  arrangementId: string,
  signal?: AbortSignal,
): Promise<ArrangementPaymentResult> {
  return apiRequest<ArrangementPaymentResult>(
    `/billing/arrangements/${encodeURIComponent(arrangementId)}/complete-payment`,
    { method: 'POST', signal },
  );
}

/** The arrangements made for the signed-in Operator, newest first. */
export function listBillingArrangements(signal?: AbortSignal): Promise<BillingArrangement[]> {
  return apiRequest<{ arrangements?: BillingArrangement[] } | BillingArrangement[]>(
    '/billing/arrangements',
    { signal },
  ).then((response) => (Array.isArray(response) ? response : (response.arrangements ?? [])));
}
