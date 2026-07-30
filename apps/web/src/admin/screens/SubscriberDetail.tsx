import { getSubscriber } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowLeft, CreditCard } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatAmount, standingOf } from '../subscribers';

/*
 * One subscriber, and every payment attempt behind them.
 *
 * Failed and pending attempts are shown alongside successful ones. A history of
 * only what worked cannot answer the question this page exists for, which is
 * usually why somebody is not on the tier they believe they paid for.
 */

const paymentTone: Record<string, string> = {
  success: 'text-success',
  failed: 'text-danger',
  pending: 'text-warning',
};

/** One labelled fact in the summary. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text variant="caption" tone="secondary" className="block">
        {label}
      </Text>
      <Text variant="body-sm" className="font-medium">
        {value || 'Not set'}
      </Text>
    </div>
  );
}

function when(value?: string): string {
  return value ? new Date(value).toLocaleString() : '';
}

export function SubscriberDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => getSubscriber(id, signal), [id]);

  return (
    <AdminShell active="subscribers">
      <PageHeader
        title={state.status === 'ready' ? state.data.email : 'Subscriber'}
        description="What this account is subscribed to, and every payment attempt behind it. Each payment carries the provider's own reference, so a disputed charge can be found in the provider's dashboard."
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/subscribers')}>
            <ArrowLeft width={15} height={15} aria-hidden />
            All subscribers
          </Button>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading the subscriber" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {state.status === 'ready' ? (
        <>
          <Card className="mb-6">
            <Text variant="body-sm" tone="secondary" className="mb-4 block">
              {standingOf(state.data).detail}
            </Text>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact label="Standing" value={standingOf(state.data).label} />
              <Fact label="Account tier" value={state.data.account_tier} />
              <Fact label="Subscription tier" value={state.data.subscription_tier ?? ''} />
              <Fact label="Provider" value={state.data.provider ?? ''} />
              <Fact label="Subscribed" value={when(state.data.started_at)} />
              <Fact label="Period ends" value={when(state.data.current_period_end)} />
              <Fact label="Last successful payment" value={when(state.data.last_paid_at)} />
              <Fact
                label="Taken in total"
                value={formatAmount(state.data.paid_minor, state.data.currency)}
              />
            </div>
          </Card>

          {state.data.payment_history.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No payment attempts"
              description="This account has a subscription record but nothing has been charged through it."
            />
          ) : (
            <Table label="Payment history">
              <THead>
                <TH>When</TH>
                <TH>Status</TH>
                <TH>Tier</TH>
                <TH className="text-right">Amount</TH>
                <TH>Term</TH>
                <TH>Promo</TH>
                <TH>Provider reference</TH>
              </THead>
              <TBody>
                {state.data.payment_history.map((payment) => (
                  <TR key={payment.id}>
                    <TD className="text-ink-muted">{when(payment.created_at)}</TD>
                    <TD>
                      <span className={`font-medium ${paymentTone[payment.status] ?? ''}`}>
                        {payment.status}
                      </span>
                    </TD>
                    <TD className="capitalize">{payment.tier}</TD>
                    <TD className="text-right tabular-nums">
                      {formatAmount(payment.amount_minor, payment.currency)}
                    </TD>
                    <TD className="text-ink-muted">
                      {payment.term_months} {payment.term_months === 1 ? 'month' : 'months'}
                    </TD>
                    <TD className="text-ink-muted">{payment.promo_code || ''}</TD>
                    <TD className="font-mono text-xs text-ink-muted">{payment.reference}</TD>
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
