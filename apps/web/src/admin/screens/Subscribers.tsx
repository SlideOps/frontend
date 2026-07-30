import { listSubscribers, type AdminSubscriber } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { AlertTriangle, CreditCard } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useNavigate } from 'react-router-dom';
import { Refreshing } from '../../app/components/Refreshing';
import { AdminShell } from '../components/AdminShell';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatAmount, standingOf, tierMismatch, type SubscriberStanding } from '../subscribers';

/*
 * Subscribers: who is paying, what for, and what it has been worth.
 *
 * Read only, and that is a decision rather than an omission. Changing what
 * somebody pays belongs to the payment provider; where SlideOps must intervene it
 * moves their tier, which already exists on the Operator screen, is audited, and
 * does not pretend to have taken money. A control here that edited a subscription
 * would create a record of a payment that never happened.
 */

const toneClass: Record<SubscriberStanding['tone'], string> = {
  good: 'bg-subtle text-success',
  warning: 'bg-subtle text-warning',
  bad: 'bg-subtle text-danger',
  neutral: 'bg-subtle text-ink-muted',
};

/** A subscriber's standing, with the reason behind it available on hover. */
function StandingBadge({ standing }: { standing: SubscriberStanding }) {
  return (
    <span
      title={standing.detail}
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium ${toneClass[standing.tone]}`}
    >
      {standing.label}
    </span>
  );
}

/** One figure in the headline row. */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="h3" className="tabular-nums">
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

function when(value?: string): string {
  return value ? new Date(value).toLocaleDateString() : '';
}

/** The tier a row is on, with the subscription's tier beside it when they differ. */
function TierCell({ subscriber }: { subscriber: AdminSubscriber }) {
  if (!tierMismatch(subscriber)) {
    return <span className="capitalize">{subscriber.account_tier}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="capitalize">{subscriber.account_tier}</span>
      <AlertTriangle width={13} height={13} className="text-warning" aria-hidden />
      <span className="text-xs text-ink-muted">
        subscription says {subscriber.subscription_tier}
      </span>
    </span>
  );
}

export function Subscribers() {
  const navigate = useNavigate();
  const { state, refreshing } = useAsyncData((signal) => listSubscribers(signal), []);

  return (
    <AdminShell active="subscribers">
      <PageHeader
        title="Subscribers"
        description="Everyone who has ever paid or tried to, across the platform. Lapsed and cancelled accounts are included, and so is anyone whose payment failed: a list of only active subscribers cannot tell you why revenue moved. Open a row for the payment history behind it."
        actions={<Refreshing show={refreshing} />}
      />

      {state.status === 'loading' ? <Loading label="Loading subscribers" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {state.status === 'ready' ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Active" value={String(state.data.totals.active)} />
            <Stat
              label="Ending within 30 days"
              value={String(state.data.totals.expiring_within_30_days)}
              hint="Each one renews or lapses"
            />
            <Stat
              label="Taken"
              value={formatAmount(state.data.totals.paid_minor, state.data.totals.currency)}
              hint="Successful payments only"
            />
            <Stat
              label="Failed payments"
              value={String(state.data.totals.failed_payments)}
              hint="People trying to pay and not managing to"
            />
          </div>

          {state.data.subscribers.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Nobody has subscribed yet"
              description="When an Operator subscribes, or attempts a payment, they appear here with what they are paying for and what it has been worth."
            />
          ) : (
            <Table label="Subscribers">
              <THead>
                <TH>Operator</TH>
                <TH>Standing</TH>
                <TH>Tier</TH>
                <TH>Provider</TH>
                <TH>Period ends</TH>
                <TH className="text-right">Payments</TH>
                <TH className="text-right">Paid</TH>
              </THead>
              <TBody>
                {state.data.subscribers.map((subscriber) => (
                  <TR
                    key={subscriber.operator_id}
                    interactive
                    onClick={() => navigate(`/admin/subscribers/${subscriber.operator_id}`)}
                  >
                    <TD className="font-medium">{subscriber.email}</TD>
                    <TD>
                      <StandingBadge standing={standingOf(subscriber)} />
                    </TD>
                    <TD>
                      <TierCell subscriber={subscriber} />
                    </TD>
                    <TD className="text-ink-muted">{subscriber.provider || ''}</TD>
                    <TD className="text-ink-muted">{when(subscriber.current_period_end)}</TD>
                    <TD className="text-right tabular-nums">{subscriber.payments}</TD>
                    <TD className="text-right tabular-nums">
                      {formatAmount(subscriber.paid_minor, subscriber.currency)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
      ) : null}
    </AdminShell>
  );
}
