import {
  listAllArrangements,
  type ArrangementCondition,
  type ArrangementStatus,
  type ArrangementWithOperator,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ChevronLeft, ChevronRight, FileText, Settings } from '@slideops/icons';
import { EmptyState, PageHeader, SearchBar, Toolbar } from '@slideops/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  accessReading,
  conditionLabel,
  factsOfRow,
  lifecycleFilterOptions,
  matchesArrangementSearch,
  matchesLifecycleFilter,
  obligationOf,
  obligationReason,
  obligationText,
  obligationTone,
  paymentReading,
  type ArrangementLifecycleFilter,
} from '../arrangements';
import { AdminShell } from '../components/AdminShell';
import { ReadingBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * Every payment arrangement across every Operator, newest first: the customer
 * access operations console.
 *
 * The list answers three separate questions on every row, because they have
 * three separate answers and all three matter. Whether the customer has access
 * right now. Whether the money arrived. What they owe and by when. A row that
 * reads Active, Pending, and a sum due next week is not confused, it is the
 * ordinary shape of temporary access, and an admin who can see that on the list
 * does not have to open anything to know where to start.
 *
 * A Subscriber's own detail page still shows their arrangements in context.
 * This is the platform-wide view, and Manage opens one arrangement's own
 * lifecycle: correct it, extend it, write to the customer, take access back.
 */

const PAGE_SIZE = 25;

const selectClass =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const CONDITION_OPTIONS: { value: ArrangementCondition | ''; label: string }[] = [
  { value: '', label: 'All conditions' },
  { value: 'offline_settled', label: 'Offline payment' },
  { value: 'temporary_access', label: 'Temporary access' },
  { value: 'payment_required', label: 'Payment required' },
  { value: 'free_grant', label: 'Free grant' },
];

const STATUS_OPTIONS: { value: ArrangementStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

const obligationToneClass: Record<'good' | 'warning' | 'bad' | 'neutral', string> = {
  good: 'text-success',
  warning: 'text-warning',
  bad: 'text-danger',
  neutral: 'text-ink-muted',
};

function shortDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString() : 'Never';
}

function fullMoment(value?: string): string {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

/**
 * What is owed, in its own currency, with the date it is owed by.
 *
 * An unknown amount is named as unknown. Rendering a zero in its place would
 * say the customer owes nothing, which is a statement about their account that
 * the backend never made.
 */
function OwedCell({ row }: { row: ArrangementWithOperator }) {
  const facts = factsOfRow(row);
  const obligation = obligationOf(facts);
  const tone = obligationTone(obligation, facts);
  return (
    <div className="min-w-0">
      <Text as="span" variant="body-sm" className={`font-medium ${obligationToneClass[tone]}`}>
        {obligationText(obligation)}
      </Text>
      {obligationReason(obligation) ? (
        <Text variant="caption" tone="secondary" className="block">
          {obligationReason(obligation)}
        </Text>
      ) : null}
    </div>
  );
}

export function Arrangements() {
  const navigate = useNavigate();
  const [condition, setCondition] = useState<ArrangementCondition | ''>('');
  const [status, setStatus] = useState<ArrangementStatus | ''>('');
  const [lifecycle, setLifecycle] = useState<ArrangementLifecycleFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  const query = useMemo(
    () => ({
      condition: condition || undefined,
      status: status || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [condition, status, offset],
  );
  const { state } = useAsyncData((signal) => listAllArrangements(query, signal), [query]);

  const loaded = useMemo(
    () => (state.status === 'ready' ? state.data.arrangements : []),
    [state],
  );
  const hasMore = state.status === 'ready' && state.data.has_more;

  // The lifecycle filter and the search narrow the page already loaded. The
  // condition and status selects go to the server and page with it, so the two
  // kinds are kept visibly separate rather than pretending to be one filter.
  const rows = useMemo(
    () =>
      loaded.filter(
        (row) =>
          matchesLifecycleFilter(factsOfRow(row), lifecycle) &&
          matchesArrangementSearch(row, search),
      ),
    [loaded, lifecycle, search],
  );

  const narrowed = lifecycle !== 'all' || search.trim() !== '';
  const filtered = narrowed || Boolean(condition) || Boolean(status);

  const openArrangement = (row: ArrangementWithOperator) => {
    // The row travels with the navigation so the detail can show the three
    // readings straight away, and can still show them if the deployment does
    // not have the detail endpoint yet.
    navigate(`/admin/arrangements/${row.id}`, { state: { arrangement: row } });
  };

  return (
    <AdminShell active="arrangements">
      <PageHeader
        title="Arrangements"
        description="Every payment arrangement on the platform, newest first: offline payments recorded, temporary access granted ahead of payment, and checkouts started on a customer's behalf. Access, payment, and what is owed are read separately, because an arrangement answers those three questions differently."
      />

      <Toolbar
        className="mb-4"
        actions={
          <>
            <select
              className={selectClass}
              aria-label="Filter by condition"
              value={condition}
              onChange={(event) => {
                setPage(0);
                setCondition(event.target.value as ArrangementCondition | '');
              }}
            >
              {CONDITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              aria-label="Filter by status"
              value={status}
              onChange={(event) => {
                setPage(0);
                setStatus(event.target.value as ArrangementStatus | '');
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        }
      >
        <SearchBar
          value={search}
          onChange={setSearch}
          label="Search arrangements"
          placeholder="Customer, email, plan or amount"
        />
        <select
          className={selectClass}
          aria-label="Filter by lifecycle"
          value={lifecycle}
          onChange={(event) => setLifecycle(event.target.value as ArrangementLifecycleFilter)}
        >
          {lifecycleFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Toolbar>

      {state.status === 'loading' ? <Loading label="Loading arrangements" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        rows.length === 0 && page === 0 && !filtered ? (
          <EmptyState
            icon={FileText}
            title="No arrangements yet"
            description="An offline payment recorded, temporary access granted, or a checkout started on a customer's behalf will appear here."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No arrangements found"
            description="Nothing on this page matches. Try a different filter, clear the search, or go back to the first page."
          />
        ) : (
          <>
            <Table label="Payment arrangements">
              <THead>
                <TH>Customer</TH>
                <TH className="hidden md:table-cell">Plan</TH>
                <TH>Access</TH>
                <TH>Payment</TH>
                <TH>Owed</TH>
                <TH className="hidden xl:table-cell">Last contact</TH>
                <TH className="hidden lg:table-cell">Updated</TH>
                <TH className="text-right">Manage</TH>
              </THead>
              <TBody>
                {rows.map((row) => {
                  const facts = factsOfRow(row);
                  return (
                    <TR key={row.id} interactive onClick={() => openArrangement(row)}>
                      <TD className="max-w-[16rem]">
                        <div className="truncate font-medium">
                          {row.operator_email || row.operator_id}
                        </div>
                        {/* On a narrow screen the columns below are hidden, so
                            the facts they carry are stacked here instead of
                            being lost. */}
                        <Text variant="caption" tone="secondary" className="block md:hidden">
                          <span className="capitalize">{row.tier}</span>
                          {', '}
                          {conditionLabel[row.condition]}
                        </Text>
                        <Text variant="caption" tone="secondary" className="block xl:hidden">
                          Last contact {shortDate(row.last_communication_at)}
                        </Text>
                      </TD>
                      <TD className="hidden md:table-cell">
                        <div className="capitalize">{row.tier}</div>
                        <Text variant="caption" tone="secondary" className="block">
                          {conditionLabel[row.condition]}
                        </Text>
                      </TD>
                      <TD>
                        <ReadingBadge reading={accessReading(facts)} />
                      </TD>
                      <TD>
                        <ReadingBadge reading={paymentReading(facts)} />
                      </TD>
                      <TD>
                        <OwedCell row={row} />
                      </TD>
                      <TD className="hidden whitespace-nowrap text-ink-muted xl:table-cell">
                        {shortDate(row.last_communication_at)}
                      </TD>
                      <TD className="hidden whitespace-nowrap text-ink-muted lg:table-cell">
                        {fullMoment(row.updated_at ?? row.created_at)}
                      </TD>
                      <TD className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openArrangement(row)}
                          aria-label={`Manage the arrangement for ${row.operator_email || row.operator_id}`}
                        >
                          <Settings width={14} height={14} aria-hidden />
                          Manage
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <Text variant="body-sm" tone="secondary">
                {narrowed
                  ? `Showing ${rows.length} of ${loaded.length} on this page`
                  : `Showing ${offset + 1} to ${offset + rows.length}`}
              </Text>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft width={16} height={16} aria-hidden />
                  Newer
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((value) => value + 1)}
                  disabled={!hasMore}
                >
                  Older
                  <ChevronRight width={16} height={16} aria-hidden />
                </Button>
              </div>
            </div>
          </>
        )
      ) : null}
    </AdminShell>
  );
}
