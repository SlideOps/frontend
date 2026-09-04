import {
  ApiError,
  adminInvoiceURL,
  getSubscriber,
  recoverPayment,
  resendPaymentReceipt,
  sendPendingPaymentReminder,
  verifyPayment,
  type AdminPayment,
  type PaymentReconciliation,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  ListChecks,
  Mail,
  RefreshCw,
  Search,
  Users,
} from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatAmount, paymentStatusLabel, paymentStatusTone } from '../subscribers';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * One payment, in full, for an Admin: the source of truth this control
 * plane's own payment-management flow -- Inspect, Verify, Communicate,
 * Recover, Reconcile, Audit -- is meant to work from. The actions offered
 * come straight from the payment's own status, never a fixed list, the
 * same state-aware rule the Operator's own Transaction detail already
 * follows.
 */

const toneClass: Record<'good' | 'warning' | 'bad' | 'neutral', string> = {
  good: 'text-success',
  warning: 'text-warning',
  bad: 'text-danger',
  neutral: 'text-ink-muted',
};

function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (!value) {
    return null;
  }
  return (
    <div>
      <Text variant="caption" tone="secondary" className="block">
        {label}
      </Text>
      <Text variant="body-sm" className="font-medium">
        {value}
      </Text>
    </div>
  );
}

function when(value?: string): string {
  return value ? new Date(value).toLocaleString() : '';
}

/** How long a pending payment has been sitting, for "Pending for 14 minutes". */
function pendingFor(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} hour${hours === 1 ? '' : 's'}${rest ? ` ${rest} minute${rest === 1 ? '' : 's'}` : ''}`;
}

export function PaymentDetail() {
  const { id = '', reference = '' } = useParams();
  const navigate = useNavigate();
  const { state, reload } = useAsyncData((signal) => getSubscriber(id, signal), [id]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [reconciliation, setReconciliation] = useState<PaymentReconciliation | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoverReason, setRecoverReason] = useState('');

  const payment: AdminPayment | undefined =
    state.status === 'ready'
      ? state.data.payment_history.find((p) => p.reference === reference)
      : undefined;

  const runVerify = async () => {
    if (!payment) return;
    setActionError(null);
    setActionMessage(null);
    setWorking(true);
    try {
      setReconciliation(await verifyPayment(payment.reference));
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Could not verify. Try again.');
    } finally {
      setWorking(false);
    }
  };

  const runRecover = async () => {
    if (!payment) return;
    setActionError(null);
    setActionMessage(null);
    try {
      await recoverPayment(payment.reference, recoverReason);
      setActionMessage('Payment recovered. The subscription is active.');
      setRecovering(false);
      setRecoverReason('');
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That recovery did not go through. Try again.',
      );
      setRecovering(false);
    }
  };

  const runResend = async () => {
    if (!payment) return;
    setActionError(null);
    setActionMessage(null);
    setWorking(true);
    try {
      await resendPaymentReceipt(payment.reference);
      setActionMessage('Receipt sent again.');
      reload();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'The receipt was not sent.');
    } finally {
      setWorking(false);
    }
  };

  const runSendPendingReminder = async () => {
    if (!payment) return;
    setActionError(null);
    setActionMessage(null);
    setWorking(true);
    try {
      await sendPendingPaymentReminder(payment.reference);
      setActionMessage('Pending Payment email sent.');
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'The Pending Payment email was not sent.',
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <AdminShell active="subscribers">
      <PageHeader
        title="Payment Details"
        description="Inspect, verify, communicate, recover, and audit -- everything about one payment, in one place."
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/subscribers/${id}`)}>
            <ArrowLeft width={15} height={15} aria-hidden />
            Subscriber
          </Button>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading this payment" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' && !payment ? (
        <EmptyState
          icon={ListChecks}
          title="Payment not found"
          description="This reference does not match anything in this subscriber's payment history."
        />
      ) : null}

      {payment ? (
        <Card>
          <span className={`text-base font-semibold ${toneClass[paymentStatusTone[payment.status]]}`}>
            {paymentStatusLabel[payment.status]}
          </span>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Fact label="User" value={state.status === 'ready' ? state.data.email : ''} />
            <Fact label="Plan" value={<span className="capitalize">{payment.tier}</span>} />
            <Fact label="Amount" value={formatAmount(payment.amount_minor, payment.currency)} />
            <Fact label="Reference" value={<span className="font-mono text-xs">{payment.reference}</span>} />
            <Fact label="Provider" value={payment.provider} />
            <Fact label="Provider Reference" value={payment.provider_ref} />
            <Fact label="Created" value={when(payment.created_at)} />
            {payment.status === 'pending' ? (
              <Fact label="Pending for" value={pendingFor(payment.created_at)} />
            ) : null}
            {payment.recovered_at ? <Fact label="Recovered" value={when(payment.recovered_at)} /> : null}
            {payment.receipt_sent_at ? (
              <Fact label="Payment Success Email" value={`Sent ${when(payment.receipt_sent_at)}`} />
            ) : null}
            {payment.pending_reminder_sent_at ? (
              <Fact label="Automatic reminder" value={`Sent ${when(payment.pending_reminder_sent_at)}`} />
            ) : null}
            {payment.manual_reminder_sent_at ? (
              <Fact
                label="Last manual reminder"
                value={`Sent by ${payment.manual_reminder_sent_by || 'an admin'}, ${when(payment.manual_reminder_sent_at)}`}
              />
            ) : null}
          </div>

          {reconciliation ? (
            <div className="mt-4 rounded-md border border-border bg-subtle px-4 py-3">
              <Text variant="body-sm" className="font-medium">
                Provider Status: {reconciliation.provider_status}
              </Text>
              <Text variant="body-sm" tone="secondary" className="mt-0.5">
                SlideOps has this at {reconciliation.local_status}.{' '}
                {reconciliation.match ? 'These agree.' : 'These disagree.'}
              </Text>
            </div>
          ) : null}

          {actionMessage ? (
            <p role="status" className="mt-4 text-sm text-success">
              {actionMessage}
            </p>
          ) : null}
          {actionError ? (
            <p role="alert" className="mt-4 text-sm text-danger">
              {actionError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {payment.status === 'pending' ? (
              <>
                <Button onClick={runSendPendingReminder} disabled={working}>
                  <Mail width={14} height={14} aria-hidden />
                  Send Pending Payment Email
                </Button>
                {payment.provider_ref ? (
                  <Button variant="secondary" onClick={runVerify} disabled={working}>
                    <Search width={14} height={14} aria-hidden />
                    Verify Payment
                  </Button>
                ) : null}
                {payment.provider_ref ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRecoverReason('');
                      setRecovering(true);
                    }}
                  >
                    <RefreshCw width={14} height={14} aria-hidden />
                    Recover Payment
                  </Button>
                ) : null}
              </>
            ) : null}

            {payment.status === 'success' ? (
              <>
                <Button variant="secondary" onClick={() => window.open(adminInvoiceURL(payment.reference), '_blank')}>
                  <ExternalLink width={14} height={14} aria-hidden />
                  View Receipt
                </Button>
                <Button variant="secondary" onClick={() => window.open(adminInvoiceURL(payment.reference), '_blank')}>
                  <Download width={14} height={14} aria-hidden />
                  Download Receipt
                </Button>
                <Button variant="ghost" onClick={runResend} disabled={working}>
                  <Mail width={14} height={14} aria-hidden />
                  Resend Payment Success Email
                </Button>
              </>
            ) : null}

            {payment.status === 'failed' && payment.provider_ref ? (
              <Button variant="secondary" onClick={runVerify} disabled={working}>
                <Search width={14} height={14} aria-hidden />
                Verify Payment
              </Button>
            ) : null}

            <Button variant="ghost" onClick={() => navigate(`/admin/subscribers/${id}`)}>
              <Users width={14} height={14} aria-hidden />
              View Subscription
            </Button>
            <Button variant="ghost" onClick={() => navigate('/admin/audit')}>
              <ListChecks width={14} height={14} aria-hidden />
              View Audit History
            </Button>
          </div>

          {payment.status === 'refunded' ? (
            <Text variant="body-sm" tone="secondary" className="mt-4">
              This payment was refunded. Its own record above is what SlideOps has on file for it.
            </Text>
          ) : null}
          {payment.status === 'disputed' ? (
            <Text variant="body-sm" tone="secondary" className="mt-4">
              This payment is under dispute with the payment provider. Check the provider's own
              dashboard for its current status.
            </Text>
          ) : null}
          {payment.status === 'cancelled' ? (
            <Text variant="body-sm" tone="secondary" className="mt-4">
              The Operator cancelled this payment before it was ever charged.
            </Text>
          ) : null}
        </Card>
      ) : null}

      <ConfirmDialog
        open={recovering}
        title="Recover this payment?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              Runs this payment through the exact same activation path a real webhook would have:
              the provider is asked to confirm the transaction fresh, right now, and only then is
              the tier granted, the subscription activated, and the receipt sent.
            </p>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink">Reason</span>
              <textarea
                className="min-h-20 rounded-md border border-border bg-surface p-2.5 text-sm text-ink"
                value={recoverReason}
                onChange={(event) => setRecoverReason(event.target.value)}
                placeholder="Provider confirmed the charge succeeded by phone"
              />
            </label>
          </div>
        }
        confirmLabel="Recover Payment"
        confirmVariant="primary"
        onConfirm={runRecover}
        onCancel={() => setRecovering(false)}
      />
    </AdminShell>
  );
}
