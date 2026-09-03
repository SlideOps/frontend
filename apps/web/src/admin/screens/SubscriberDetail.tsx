import {
  ApiError,
  getSubscriber,
  pauseSubscriber,
  recoverPayment,
  resendPaymentReceipt,
  resumeSubscriber,
  verifyPayment,
  type AdminPayment,
  type PaymentReconciliation,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { ArrowLeft, CreditCard, Mail, Pause, Play, RefreshCw, Search } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
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
 *
 * A payment that never recorded correctly is recovered here rather than by
 * editing a row: recovery asks the provider to confirm the transaction fresh,
 * then runs it through the same activation path a real webhook would have,
 * so the tier, subscription, and receipt all move together. Every recovery
 * and resend is written to the audit trail.
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
  const { state, reload } = useAsyncData((signal) => getSubscriber(id, signal), [id]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);
  const [reconciliation, setReconciliation] = useState<PaymentReconciliation | null>(null);

  const [recovering, setRecovering] = useState<AdminPayment | null>(null);
  const [recoverReason, setRecoverReason] = useState('');

  const [resending, setResending] = useState<AdminPayment | null>(null);

  const [pausing, setPausing] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseResumeAt, setPauseResumeAt] = useState('');
  const [resuming, setResuming] = useState(false);

  const runVerify = async (payment: AdminPayment) => {
    setActionError(null);
    setActionMessage(null);
    setReconciliation(null);
    setVerifyingRef(payment.reference);
    try {
      const report = await verifyPayment(payment.reference);
      setReconciliation(report);
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'Could not verify that payment. Try again.',
      );
    } finally {
      setVerifyingRef(null);
    }
  };

  const runRecover = async () => {
    if (!recovering) {
      return;
    }
    setActionError(null);
    setActionMessage(null);
    try {
      await recoverPayment(recovering.reference, recoverReason);
      setActionMessage(`Payment ${recovering.reference} recovered. The subscription is active.`);
      setRecovering(null);
      setRecoverReason('');
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That recovery did not go through. Try again.',
      );
      setRecovering(null);
    }
  };

  const runResend = async () => {
    if (!resending) {
      return;
    }
    setActionError(null);
    setActionMessage(null);
    try {
      await resendPaymentReceipt(resending.reference);
      setActionMessage(`Receipt for ${resending.reference} sent again.`);
      setResending(null);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'The receipt was not sent. Try again.',
      );
      setResending(null);
    }
  };

  const runPause = async () => {
    setActionError(null);
    setActionMessage(null);
    try {
      await pauseSubscriber(id, pauseReason, pauseResumeAt ? new Date(pauseResumeAt) : undefined);
      setActionMessage('Subscription paused. The Account has moved to Free until it is resumed.');
      setPausing(false);
      setPauseReason('');
      setPauseResumeAt('');
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'The pause did not go through. Try again.',
      );
      setPausing(false);
    }
  };

  const runResume = async () => {
    setActionError(null);
    setActionMessage(null);
    try {
      const sub = await resumeSubscriber(id);
      setActionMessage(`Subscription resumed. The Account is back on ${sub.tier}.`);
      setResuming(false);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'The resume did not go through. Try again.',
      );
      setResuming(false);
    }
  };

  const subscriptionStatus = state.status === 'ready' ? state.data.status : undefined;
  const isPaused = subscriptionStatus === 'paused';
  // Pause only makes sense while there is a live subscription to hold; a
  // lapsed or cancelled one has nothing left to pause.
  const canPause = subscriptionStatus === 'active';

  return (
    <AdminShell active="subscribers">
      <PageHeader
        title={state.status === 'ready' ? state.data.email : 'Subscriber'}
        description="What this account is subscribed to, and every payment attempt behind it. Each payment carries the provider's own reference, so a disputed charge can be found in the provider's dashboard."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isPaused ? (
              <Button variant="primary" size="sm" onClick={() => setResuming(true)}>
                <Play width={15} height={15} aria-hidden />
                Resume subscription
              </Button>
            ) : null}
            {canPause ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPauseReason('');
                  setPauseResumeAt('');
                  setPausing(true);
                }}
              >
                <Pause width={15} height={15} aria-hidden />
                Pause subscription
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/subscribers')}>
              <ArrowLeft width={15} height={15} aria-hidden />
              All subscribers
            </Button>
          </div>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading the subscriber" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {actionError}
        </p>
      ) : null}
      {actionMessage ? (
        <p role="status" className="mb-4 text-sm text-success">
          {actionMessage}
        </p>
      ) : null}
      {reconciliation ? (
        <Card className="mb-4">
          <Text variant="body-sm" className="font-medium">
            Payment {reconciliation.reference}
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-1">
            SlideOps has this at <strong className="text-ink">{reconciliation.local_status}</strong>
            . The provider reports{' '}
            <strong className="text-ink">{reconciliation.provider_status}</strong>.{' '}
            {reconciliation.match
              ? 'These agree, nothing to recover.'
              : 'These disagree — Recover below to correct it.'}
          </Text>
        </Card>
      ) : null}

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
              {isPaused ? (
                <>
                  <Fact label="Paused reason" value={state.data.pause_reason ?? ''} />
                  <Fact
                    label="Resumes"
                    value={state.data.resume_at ? when(state.data.resume_at) : 'Manually'}
                  />
                </>
              ) : null}
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
                <TH>Annual discount</TH>
                <TH>Provider reference</TH>
                <TH className="text-right">Recovery</TH>
              </THead>
              <TBody>
                {state.data.payment_history.map((payment) => (
                  <TR key={payment.id}>
                    <TD className="text-ink-muted">{when(payment.created_at)}</TD>
                    <TD>
                      <span className={`font-medium ${paymentTone[payment.status] ?? ''}`}>
                        {payment.status}
                      </span>
                      {payment.recovered_at ? (
                        <Text variant="caption" tone="secondary" className="block">
                          Recovered {when(payment.recovered_at)}
                        </Text>
                      ) : null}
                    </TD>
                    <TD className="capitalize">{payment.tier}</TD>
                    <TD className="text-right tabular-nums">
                      {formatAmount(payment.amount_minor, payment.currency)}
                    </TD>
                    <TD className="text-ink-muted">
                      {payment.term_months} {payment.term_months === 1 ? 'month' : 'months'}
                    </TD>
                    <TD className="text-ink-muted">{payment.promo_code || ''}</TD>
                    <TD className="text-ink-muted">
                      {payment.annual_discount_minor
                        ? `-${formatAmount(payment.annual_discount_minor, payment.currency)}`
                        : ''}
                    </TD>
                    <TD className="font-mono text-xs text-ink-muted">{payment.reference}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {payment.provider_ref ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => runVerify(payment)}
                            disabled={verifyingRef === payment.reference}
                          >
                            <Search width={14} height={14} aria-hidden />
                            {verifyingRef === payment.reference ? 'Checking' : 'Verify'}
                          </Button>
                        ) : null}
                        {payment.status !== 'success' && payment.provider_ref ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setRecoverReason('');
                              setRecovering(payment);
                            }}
                          >
                            <RefreshCw width={14} height={14} aria-hidden />
                            Recover
                          </Button>
                        ) : null}
                        {payment.status === 'success' ? (
                          <Button variant="ghost" size="sm" onClick={() => setResending(payment)}>
                            <Mail width={14} height={14} aria-hidden />
                            Resend receipt
                          </Button>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
      ) : null}

      <ConfirmDialog
        open={recovering !== null}
        title="Recover this payment?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              The provider is asked to confirm{' '}
              <strong className="text-ink">{recovering?.reference}</strong> fresh, right now. Only
              if it agrees the payment succeeded does this grant the tier, activate the
              subscription, redeem any promo, and send the receipt — the same path a real webhook
              takes. This is written to the audit trail.
            </p>
            <Field
              label="Reason"
              hint="Why this is being recovered by hand. Required."
              value={recoverReason}
              onChange={(event) => setRecoverReason(event.target.value)}
              placeholder="Provider confirmed successful transaction, webhook never arrived"
            />
          </div>
        }
        confirmLabel="Recover payment"
        confirmVariant="primary"
        onConfirm={runRecover}
        onCancel={() => {
          setRecovering(null);
          setRecoverReason('');
        }}
      />

      <ConfirmDialog
        open={resending !== null}
        title="Resend this receipt?"
        description={
          <>
            Sends the receipt for <strong className="text-ink">{resending?.reference}</strong>{' '}
            again. This only resends the email: no tier is granted again, no promo is redeemed
            again, no subscription state changes. This is written to the audit trail.
          </>
        }
        confirmLabel="Resend receipt"
        confirmVariant="primary"
        onConfirm={runResend}
        onCancel={() => setResending(null)}
      />

      <ConfirmDialog
        open={pausing}
        title="Pause this subscription?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              The Account moves to Free immediately, the same way a cancel would, but the current
              tier is recorded so resuming restores it exactly. Existing Nodes, Projects, and
              Services keep running unaffected — this only holds billing and entitlements. This is
              written to the audit trail.
            </p>
            <Field
              label="Reason"
              hint="Why this subscription is being paused. Required."
              value={pauseReason}
              onChange={(event) => setPauseReason(event.target.value)}
              placeholder="Payment dispute under investigation"
            />
            <Field
              label="Resume on"
              hint="Optional. Leave blank to resume only when an Admin does it by hand."
              type="date"
              value={pauseResumeAt}
              onChange={(event) => setPauseResumeAt(event.target.value)}
            />
          </div>
        }
        confirmLabel="Pause subscription"
        confirmVariant="danger"
        onConfirm={runPause}
        onCancel={() => {
          setPausing(false);
          setPauseReason('');
          setPauseResumeAt('');
        }}
      />

      <ConfirmDialog
        open={resuming}
        title="Resume this subscription?"
        description={
          <>
            Restores{' '}
            <strong className="text-ink">
              {state.status === 'ready' ? (state.data.paused_previous_tier ?? 'the prior tier') : ''}
            </strong>
            , the tier this subscription was on before it was paused, through the same path a real
            subscribe already uses. This is written to the audit trail.
          </>
        }
        confirmLabel="Resume subscription"
        confirmVariant="primary"
        onConfirm={runResume}
        onCancel={() => setResuming(false)}
      />
    </AdminShell>
  );
}
