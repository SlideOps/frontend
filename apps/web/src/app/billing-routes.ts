/*
 * Where the Operator's own billing screens live, as one definition.
 *
 * These paths are already declared once, in App.tsx's route table. Every place
 * that wanted to send somebody to a payment used to write the path out again,
 * so a route that moved would have left working links behind on some screens
 * and broken ones on others, with nothing to fail loudly. Naming them here
 * means a surface that links to a payment and the list that links to the same
 * payment cannot disagree.
 */

/** The Operator's list of their own payments. */
export const transactionsPath = '/app/billing/transactions';

/** One payment, opened in full, by the reference the API gave it. */
export function transactionDetailPath(reference: string): string {
  return `${transactionsPath}/${encodeURIComponent(reference)}`;
}
