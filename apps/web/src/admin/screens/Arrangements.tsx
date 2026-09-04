import {
  listAllArrangements,
  type ArrangementCondition,
  type ArrangementStatus,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ChevronLeft, ChevronRight, FileText } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { conditionLabel, deadlineUrgency } from '../arrangements';
import { AdminShell } from '../components/AdminShell';
import { ArrangementStatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { formatAmount } from '../subscribers';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * Every payment arrangement across every Operator, newest first -- the
 * Admin-wide activity feed. A Subscriber's own detail page already shows
 * their arrangements in context; this is the platform-wide view for
 * spotting a pattern (a run of grants nobody is completing, say) that a
 * one-Operator-at-a-time page can never show.
 */

const PAGE_SIZE = 25;

const selectClass =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const CONDITION_OPTIONS: { value: ArrangementCondition | ''; label: string }[] = [
  { value: '', label: 'All conditions' },
  { value: 'offline_settled', label: 'Offline payment' },
  { value: 'temporary_access', label: 'Temporary access' },
  { value: 'payment_required', label: 'Payment required' },
];

const STATUS_OPTIONS: { value: ArrangementStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function Arrangements() {
  const navigate = useNavigate();
  const [condition, setCondition] = useState<ArrangementCondition | ''>('');
  const [status, setStatus] = useState<ArrangementStatus | ''>('');
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

  const rows = state.status === 'ready' ? state.data.arrangements : [];
  const hasMore = state.status === 'ready' && state.data.has_more;

  return (
    <AdminShell active="arrangements">
      <PageHeader
        title="Arrangements"
        description="Every payment arrangement on the platform, newest first: offline payments recorded, temporary access granted ahead of payment, and checkouts started on a customer's behalf."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          className={selectClass}
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
      </div>

      {state.status === 'loading' ? <Loading label="Loading arrangements" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        rows.length === 0 && page === 0 && !condition && !status ? (
          <EmptyState
            icon={FileText}
            title="No arrangements yet"
            description="An offline payment recorded, temporary access granted, or a checkout started on a customer's behalf will appear here."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No arrangements found"
            description="Try a different filter, or go back to the first page."
          />
        ) : (
          <>
            <Table label="Payment arrangements">
              <THead>
                <TH>When</TH>
                <TH>Operator</TH>
                <TH>Condition</TH>
                <TH>Tier</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH>Deadline</TH>
              </THead>
              <TBody>
                {rows.map((a) => {
                  const urgency = deadlineUrgency(a);
                  return (
                    <TR
                      key={a.id}
                      interactive
                      onClick={() => navigate(`/admin/subscribers/${a.operator_id}`)}
                    >
                      <TD className="whitespace-nowrap text-ink-muted">
                        {new Date(a.created_at).toLocaleString()}
                      </TD>
                      <TD className="whitespace-nowrap font-medium">
                        {a.operator_email || a.operator_id}
                      </TD>
                      <TD className="whitespace-nowrap">{conditionLabel[a.condition]}</TD>
                      <TD className="capitalize">{a.tier}</TD>
                      <TD className="whitespace-nowrap">
                        {a.amount_minor ? formatAmount(a.amount_minor, a.currency) : '—'}
                      </TD>
                      <TD>
                        <ArrangementStatusBadge status={a.status} />
                      </TD>
                      <TD className="whitespace-nowrap">
                        {urgency ? (
                          <Text
                            as="span"
                            variant="body-sm"
                            className={
                              urgency.tone === 'bad'
                                ? 'text-danger'
                                : urgency.tone === 'warning'
                                  ? 'text-warning'
                                  : 'text-ink-muted'
                            }
                          >
                            {urgency.label}
                          </Text>
                        ) : a.payment_deadline ? (
                          <span className="text-ink-muted">
                            {new Date(a.payment_deadline).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <Text variant="body-sm" tone="secondary">
                Showing {offset + 1} to {offset + rows.length}
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
