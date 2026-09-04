import { apiBase, apiRequest, unwrap } from './http';

/*
 * Billing -> Transactions: an Operator's own payment activity center. Every
 * function here reads or acts on the authenticated Operator's own payments
 * only -- the backend checks ownership on every one of them, so there is no
 * way to name another Operator's payment through this client either.
 *
 * This is the self-service counterpart to the Admin payment surface
 * (admin.ts's recordOfflinePayment, grantTemporaryAccess, and so on): same
 * underlying payment records, a different, narrower view over them.
 */

/** Every status a payment can carry. Matches the Admin surface exactly --
 *  there is one status vocabulary, not two. */
export type TransactionStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'disputed';

/** One payment, as the Operator's own Transactions page shows it. Carries
 *  nothing an Operator should not see: no internal database id, no admin
 *  recovery notes, no provider secret. */
export interface Transaction {
  reference: string;
  status: TransactionStatus;
  tier: string;
  provider: string;
  amount_minor: number;
  currency: string;
  base_amount_minor: number;
  fee_minor?: number;
  fee_label?: string;
  promo_code?: string;
  term_months: number;
  annual_discount_minor?: number;
  /** The payment provider's own transaction reference. Non-secret. */
  provider_reference?: string;
  /** "2026-09-04 - 2026-10-04", present only for a successful payment. */
  billing_period?: string;
  receipt_available: boolean;
  receipt_sent_at?: string;
  created_at: string;
  cancelled_at?: string;
}

/** Filters a Transactions list or export accepts. Every field is optional;
 *  an empty filter matches everything. */
export interface TransactionListFilter {
  statuses?: TransactionStatus[];
  from?: Date;
  to?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

/** One page of transactions, plus whether another page exists. */
export interface TransactionPage {
  transactions: Transaction[];
  limit: number;
  offset: number;
  has_more: boolean;
}

/** The Transactions page headline: what happened, and what it added up to.
 *  total_paid_minor_by_currency and refunded_minor_by_currency are keyed by
 *  currency and never summed across currencies -- USD and NGN are never
 *  added together into one number. */
export interface TransactionSummary {
  successful_count: number;
  pending_count: number;
  failed_count: number;
  cancelled_count: number;
  refunded_count: number;
  disputed_count: number;
  total_paid_minor_by_currency: Record<string, number>;
  refunded_minor_by_currency: Record<string, number>;
}

/** One bucket of the Transactions page activity chart: one period (a day,
 *  or a month for a wide range), one currency. */
export interface TransactionPoint {
  period: string;
  currency: string;
  successful_minor: number;
  successful_count: number;
  failed_count: number;
  pending_count: number;
}

/** The summary and time series together, fetched in one request since the
 *  Transactions page always shows them together. */
export interface TransactionSummaryResponse {
  summary: TransactionSummary;
  over_time: TransactionPoint[];
}

/** What resuming a pending payment returns: either it already succeeded
 *  elsewhere (already_succeeded true, checkout_url empty -- there is
 *  nothing left to pay) or the same hosted checkout it started still has a
 *  URL to send the Operator back to. */
export interface ResumeCheckoutResult {
  checkout_url: string;
  already_succeeded: boolean;
  transaction: Transaction;
}

function transactionQuery(filter: TransactionListFilter) {
  return {
    status: filter.statuses?.length ? filter.statuses.join(',') : undefined,
    from: filter.from?.toISOString(),
    to: filter.to?.toISOString(),
    q: filter.search || undefined,
    limit: filter.limit,
    offset: filter.offset,
  };
}

/** One page of the Operator's own payment transactions, newest first. */
export function listTransactions(
  filter: TransactionListFilter = {},
  signal?: AbortSignal,
): Promise<TransactionPage> {
  return apiRequest<TransactionPage>('/billing/transactions', {
    query: transactionQuery(filter),
    signal,
  });
}

/** The Transactions page summary and activity time series for a range. Both
 *  from and to omitted means all time. */
export function transactionSummary(
  range: { from?: Date; to?: Date } = {},
  signal?: AbortSignal,
): Promise<TransactionSummaryResponse> {
  return apiRequest<TransactionSummaryResponse>('/billing/transactions/summary', {
    query: { from: range.from?.toISOString(), to: range.to?.toISOString() },
    signal,
  });
}

/** Read one of the Operator's own transactions in full, for the detail view. */
export function getTransaction(reference: string, signal?: AbortSignal): Promise<Transaction> {
  return apiRequest<unknown>(`/billing/transactions/${encodeURIComponent(reference)}`, {
    signal,
  }).then((r) => unwrap<Transaction>(r, 'transaction'));
}

/** Thrown by cancelTransaction and resumeCheckout when the backend refuses
 *  with a payment attached (already succeeded, or not pending), so the
 *  caller can show the real current state instead of just an error. */
export class TransactionActionError extends Error {
  code: string;
  transaction?: Transaction;
  constructor(code: string, message: string, transaction?: Transaction) {
    super(message);
    this.code = code;
    this.transaction = transaction;
  }
}

/** Reads a transaction-carrying error body ({ error: {...}, transaction:
 *  {...} }) off a raw fetch response, for the two actions that attach one. */
async function postTransactionAction(path: string): Promise<Transaction> {
  const base = apiBase();
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { method: 'POST', credentials: 'include' });
  } catch {
    throw new TransactionActionError('network_error', 'The network request failed.');
  }
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const code: string = parsed?.error?.code ?? 'error';
    const message: string = parsed?.error?.message ?? 'That did not go through. Try again.';
    throw new TransactionActionError(code, message, parsed?.transaction as Transaction | undefined);
  }
  return unwrap<Transaction>(parsed, 'transaction');
}

/** Cancel a pending payment before it was ever charged. Safe to call twice.
 *  Throws TransactionActionError with code "already_succeeded" and the
 *  real, successful transaction attached when the provider confirms it
 *  actually already went through. */
export function cancelTransaction(reference: string): Promise<Transaction> {
  return postTransactionAction(`/billing/transactions/${encodeURIComponent(reference)}/cancel`);
}

/** Resume (complete) a pending payment: sends the Operator back into the
 *  same hosted checkout rather than starting a new one, or reports the
 *  payment already succeeded. */
export async function resumeCheckout(reference: string): Promise<ResumeCheckoutResult> {
  const base = apiBase();
  const response = await fetch(`${base}/billing/transactions/${encodeURIComponent(reference)}/resume`, {
    method: 'POST',
    credentials: 'include',
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    const code: string = parsed?.error?.code ?? 'error';
    const message: string = parsed?.error?.message ?? 'That payment could not be resumed.';
    throw new TransactionActionError(code, message, parsed?.transaction as Transaction | undefined);
  }
  return parsed as ResumeCheckoutResult;
}

/** Check a pending payment's current status against the provider fresh. A
 *  payment already in a final state is returned unchanged. */
export function refreshTransactionStatus(reference: string): Promise<Transaction> {
  return apiRequest<unknown>(`/billing/transactions/${encodeURIComponent(reference)}/refresh`, {
    method: 'POST',
  }).then((r) => unwrap<Transaction>(r, 'transaction'));
}

/** Email the receipt for an already-successful payment to the Operator's
 *  own account email again. */
export function emailTransactionReceipt(reference: string): Promise<Transaction> {
  return apiRequest<unknown>(`/billing/transactions/${encodeURIComponent(reference)}/email-receipt`, {
    method: 'POST',
  }).then((r) => unwrap<Transaction>(r, 'transaction'));
}

/** The URL to view or download a payment's PDF receipt/invoice in a new
 *  tab -- the same document the receipt email attaches. Cookie-authenticated,
 *  same as every other request; not a signed link. */
export function transactionReceiptURL(reference: string): string {
  return `${apiBase()}/billing/payments/${encodeURIComponent(reference)}/invoice.pdf`;
}

/** The URL to export the Operator's own transactions as CSV, with the same
 *  filters the list view accepts. Opening it in a new tab downloads the file. */
export function transactionsExportCSVURL(filter: TransactionListFilter = {}): string {
  const query = transactionQuery(filter);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `${apiBase()}/billing/transactions/export.csv${qs ? `?${qs}` : ''}`;
}
