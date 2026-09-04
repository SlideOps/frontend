import {
  ApiError,
  listTransactions,
  resumeCheckout,
  transactionSummary,
  transactionsExportCSVURL,
  type Transaction,
  type TransactionStatus,
} from '@slideops/api-client';
import { Button, Card, StatTile, Text, type ChartPalette } from '@slideops/design-system';
import { CreditCard, Download, Search } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '../billing-format';
import { transactionsOverTimeOption } from '../charts/options';
import { BillingTabs } from '../components/BillingTabs';
import { LazyChart } from '../components/LazyChart';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { TransactionStatusBadge } from '../components/TransactionStatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * Billing -> Transactions: the Operator's own payment activity center. A
 * standalone page, distinct from Deployment/Activity/Operations History --
 * this is for payments, purchases, subscriptions, and refunds only.
 *
 * Analytics (the summary and the chart) load for the selected date range
 * independently of the list below, which paginates and filters on its own,
 * so switching a status filter never re-fetches the whole range's totals.
 */

const PAGE_SIZE = 20;

type RangeKey = '7d' | '30d' | '90d' | '6m' | '1y' | 'all' | 'custom';

const RANGE_OPTIONS: { key: RangeKey; label: string; days?: number }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '6m', label: '6 months', days: 182 },
  { key: '1y', label: '1 year', days: 365 },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

const STATUS_FILTERS: { key: TransactionStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'success', label: 'Successful' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'disputed', label: 'Disputed' },
];

function rangeToDates(range: RangeKey, customFrom: string, customTo: string): { from?: Date; to?: Date } {
  if (range === 'all') {
    return {};
  }
  if (range === 'custom') {
    return {
      from: customFrom ? new Date(customFrom) : undefined,
      to: customTo ? new Date(`${customTo}T23:59:59`) : undefined,
    };
  }
  const days = RANGE_OPTIONS.find((option) => option.key === range)?.days ?? 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

function TransactionRow({
  transaction,
  onOpen,
  onComplete,
  completing,
}: {
  transaction: Transaction;
  onOpen: () => void;
  onComplete: () => void;
  completing: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-3 transition-colors duration-fast ease-standard first:border-t hover:bg-subtle sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <TransactionStatusBadge status={transaction.status} />
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Text variant="body-sm" className="font-medium capitalize">
            {transaction.tier} plan
          </Text>
          <Text variant="body-sm" className="font-semibold">
            {formatMoney(transaction.amount_minor, transaction.currency)}
          </Text>
        </div>
        <Text variant="caption" tone="secondary">
          {new Date(transaction.created_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}{' '}
          · {transaction.reference}
        </Text>
      </button>
      <div className="flex shrink-0 gap-2">
        {transaction.status === 'pending' ? (
          <Button variant="secondary" size="sm" onClick={onComplete} disabled={completing}>
            {completing ? 'Opening' : 'Complete Payment'}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onOpen}>
          View
        </Button>
      </div>
    </div>
  );
}

export function Transactions() {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>('90d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [completing, setCompleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { from, to } = useMemo(
    () => rangeToDates(range, customFrom, customTo),
    [range, customFrom, customTo],
  );

  const summaryState = useAsyncData(
    (signal) => transactionSummary({ from, to }, signal),
    [from?.getTime(), to?.getTime()],
  );

  const listFilter = useMemo(
    () => ({
      statuses: statusFilter === 'all' ? undefined : [statusFilter],
      from,
      to,
      search: search || undefined,
      limit: PAGE_SIZE,
    }),
    [statusFilter, from, to, search],
  );

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const listState = useAsyncData(
    (signal) =>
      listTransactions({ ...listFilter, offset: 0 }, signal).then((page) => {
        setTransactions(page.transactions);
        setHasMore(page.has_more);
        setOffset(page.transactions.length);
        return page;
      }),
    [listFilter],
  );

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const page = await listTransactions({ ...listFilter, offset });
      setTransactions((prev) => [...prev, ...page.transactions]);
      setHasMore(page.has_more);
      setOffset((prev) => prev + page.transactions.length);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Could not load more.');
    } finally {
      setLoadingMore(false);
    }
  }, [listFilter, offset]);

  const runComplete = async (reference: string) => {
    setCompleting(reference);
    setActionError(null);
    try {
      const result = await resumeCheckout(reference);
      if (result.already_succeeded) {
        listState.reload();
        return;
      }
      window.location.href = result.checkout_url;
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : 'That payment could not be resumed. Open it to see more, or try again.',
      );
      setCompleting(null);
      listState.reload();
    }
  };

  const summary = summaryState.state.status === 'ready' ? summaryState.state.data.summary : null;
  const overTime = summaryState.state.status === 'ready' ? summaryState.state.data.over_time : [];
  const chartCurrency = useMemo(() => {
    const currencies = Object.keys(summary?.total_paid_minor_by_currency ?? {});
    if (currencies.length === 0) {
      return null;
    }
    return currencies.reduce((best, currency) =>
      (summary?.total_paid_minor_by_currency[currency] ?? 0) >
      (summary?.total_paid_minor_by_currency[best] ?? 0)
        ? currency
        : best,
    );
  }, [summary]);

  const build = useCallback(
    (palette: ChartPalette) => transactionsOverTimeOption(palette, overTime, chartCurrency ?? ''),
    [overTime, chartCurrency],
  );

  return (
    <OperatorShell active="billing">
      <PageHeader
        title="Transactions"
        description="Every payment you have made or started, and what happened to it."
      />
      <BillingTabs active="transactions" className="mb-6" />

      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={range === option.key}
            onClick={() => setRange(option.key)}
            className={
              range === option.key
                ? 'inline-flex items-center rounded-md bg-subtle px-3 py-1.5 text-sm font-medium text-ink'
                : 'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-fast ease-standard hover:text-ink'
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {range === 'custom' ? (
        <div className="mb-6 grid max-w-md grid-cols-2 gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">From</span>
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">To</span>
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
        </div>
      ) : null}

      {summaryState.state.status === 'loading' ? <Loading label="Loading your activity" /> : null}
      {summaryState.state.status === 'error' ? <ErrorNote error={summaryState.state.error} /> : null}
      {summary ? (
        <Card className="mb-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            label="Total Paid"
            value={
              Object.keys(summary.total_paid_minor_by_currency).length === 0
                ? formatMoney(0)
                : Object.entries(summary.total_paid_minor_by_currency)
                    .map(([currency, minor]) => formatMoney(minor, currency))
                    .join(' · ')
            }
          />
          <StatTile label="Successful" value={summary.successful_count} tone="success" />
          <StatTile label="Pending" value={summary.pending_count} tone="warning" />
          <StatTile label="Failed" value={summary.failed_count} tone="danger" />
          {summary.refunded_count > 0 ? (
            <StatTile
              label="Refunded"
              value={
                Object.entries(summary.refunded_minor_by_currency)
                  .map(([currency, minor]) => formatMoney(minor, currency))
                  .join(' · ') || summary.refunded_count
              }
            />
          ) : null}
          {summary.disputed_count > 0 ? (
            <StatTile label="Disputed" value={summary.disputed_count} tone="danger" />
          ) : null}
        </Card>
      ) : null}

      {summary && chartCurrency ? (
        <Card className="mb-6">
          <Text variant="h4" className="mb-3">
            Activity
          </Text>
          <LazyChart ariaLabel="Payment activity over time" build={build} height={220} />
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter transactions" className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={statusFilter === option.key}
              onClick={() => setStatusFilter(option.key)}
              className={
                statusFilter === option.key
                  ? 'inline-flex items-center rounded-md bg-subtle px-3 py-1.5 text-sm font-medium text-ink'
                  : 'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-fast ease-standard hover:text-ink'
              }
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
            }}
            className="relative"
          >
            <Search
              width={15}
              height={15}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Reference or plan"
              aria-label="Search your transactions"
              className="h-9 w-48 rounded-md border border-border bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </form>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(transactionsExportCSVURL(listFilter), '_blank')}
          >
            <Download width={14} height={14} aria-hidden />
            Export CSV
          </Button>
        </div>
      </div>

      {listState.state.status === 'loading' ? <Loading label="Loading your transactions" /> : null}
      {listState.state.status === 'error' ? <ErrorNote error={listState.state.error} /> : null}
      {listState.state.status === 'ready' ? (
        transactions.length === 0 ? (
          statusFilter === 'all' && !search ? (
            <EmptyState
              icon={CreditCard}
              title="No transactions yet"
              description="Your payment activity will appear here once you make your first purchase."
              action={
                <Button onClick={() => navigate('/app/billing')}>View Plans</Button>
              }
            />
          ) : (
            <EmptyState
              icon={Search}
              title="No transactions found"
              description="Try changing your filters or date range."
            />
          )
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border-x border-border">
              {transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.reference}
                  transaction={transaction}
                  onOpen={() => navigate(`/app/billing/transactions/${transaction.reference}`)}
                  onComplete={() => runComplete(transaction.reference)}
                  completing={completing === transaction.reference}
                />
              ))}
            </div>
            {hasMore ? (
              <div className="flex justify-center py-4">
                <Button variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore ? 'Loading' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </>
        )
      ) : null}
    </OperatorShell>
  );
}
