import {
  ApiError,
  cancelArrangement,
  createPaymentRequiredArrangement,
  extendArrangementDeadline,
  getSubscriber,
  grantTemporaryAccess,
  listArrangements,
  pauseSubscriber,
  recordOfflinePayment,
  recoverPayment,
  resendPaymentReceipt,
  resumeSubscriber,
  verifyPayment,
  type AdminPayment,
  type Arrangement,
  type PayCurrency,
  type PaymentProvider,
  type PaymentReconciliation,
  type PurchasableTier,
  type TierName,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  Copy,
  CreditCard,
  ExternalLink,
  Mail,
  Pause,
  Play,
  RefreshCw,
  Search,
  X,
} from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { ArrangementStatusBadge } from '../components/Badges';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { conditionDescription, conditionLabel, deadlineUrgency, isEditable } from '../arrangements';
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

const selectClass =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const urgencyTextTone: Record<'good' | 'warning' | 'bad' | 'neutral', string> = {
  good: 'text-success',
  warning: 'text-warning',
  bad: 'text-danger',
  neutral: 'text-ink-muted',
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

  // Payment arrangements: the situations self-serve checkout does not
  // cover. Loaded independently of the subscriber summary above so a slow
  // arrangements read never blocks the billing summary from showing.
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [arrangementsError, setArrangementsError] = useState<ApiError | null>(null);
  const [checkoutLink, setCheckoutLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const loadArrangements = () => {
    if (!id) {
      return;
    }
    listArrangements(id)
      .then((a) => {
        setArrangements(a);
        setArrangementsError(null);
      })
      .catch((error) => setArrangementsError(error instanceof ApiError ? error : null));
  };

  useEffect(loadArrangements, [id]);

  const [recordingOffline, setRecordingOffline] = useState(false);
  const [offlineTier, setOfflineTier] = useState<TierName>('starter');
  const [offlineAmountMinor, setOfflineAmountMinor] = useState('');
  const [offlineCurrency, setOfflineCurrency] = useState('USD');
  const [offlineReference, setOfflineReference] = useState('');
  const [offlinePaidAt, setOfflinePaidAt] = useState('');
  const [offlineNotes, setOfflineNotes] = useState('');

  const resetOfflineForm = () => {
    setOfflineTier('starter');
    setOfflineAmountMinor('');
    setOfflineCurrency('USD');
    setOfflineReference('');
    setOfflinePaidAt('');
    setOfflineNotes('');
  };

  const runRecordOffline = async () => {
    if (!id) {
      return;
    }
    setActionError(null);
    setActionMessage(null);
    try {
      await recordOfflinePayment(id, {
        tier: offlineTier,
        amountMinor: Math.trunc(Number(offlineAmountMinor)) || 0,
        currency: offlineCurrency,
        reference: offlineReference,
        paidAt: offlinePaidAt ? new Date(offlinePaidAt) : undefined,
        notes: offlineNotes,
      });
      setActionMessage('Offline payment recorded. The tier is active and a confirmation was sent.');
      setRecordingOffline(false);
      resetOfflineForm();
      loadArrangements();
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That payment did not record. Try again.',
      );
      setRecordingOffline(false);
    }
  };

  const [grantingAccess, setGrantingAccess] = useState(false);
  const [tempTier, setTempTier] = useState<TierName>('starter');
  const [tempDeadline, setTempDeadline] = useState('');
  const [tempAutoExpire, setTempAutoExpire] = useState(false);
  const [tempNotes, setTempNotes] = useState('');

  const resetTempAccessForm = () => {
    setTempTier('starter');
    setTempDeadline('');
    setTempAutoExpire(false);
    setTempNotes('');
  };

  const runGrantTempAccess = async () => {
    if (!id) {
      return;
    }
    setActionError(null);
    setActionMessage(null);
    try {
      await grantTemporaryAccess(id, {
        tier: tempTier,
        paymentDeadline: tempDeadline ? new Date(tempDeadline) : undefined,
        autoExpireOnDeadline: tempAutoExpire,
        notes: tempNotes,
      });
      setActionMessage('Temporary access granted. The tier is active now.');
      setGrantingAccess(false);
      resetTempAccessForm();
      loadArrangements();
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That access did not go through. Try again.',
      );
      setGrantingAccess(false);
    }
  };

  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [checkoutTier, setCheckoutTier] = useState<PurchasableTier>('starter');
  const [checkoutProvider, setCheckoutProvider] = useState<PaymentProvider>('paystack');
  const [checkoutCurrency, setCheckoutCurrency] = useState<PayCurrency>('USD');
  const [checkoutDeadline, setCheckoutDeadline] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');

  const resetCheckoutForm = () => {
    setCheckoutTier('starter');
    setCheckoutProvider('paystack');
    setCheckoutCurrency('USD');
    setCheckoutDeadline('');
    setCheckoutNotes('');
  };

  const runCreateCheckout = async () => {
    if (!id) {
      return;
    }
    setActionError(null);
    setActionMessage(null);
    setCheckoutLink(null);
    try {
      const result = await createPaymentRequiredArrangement(id, {
        tier: checkoutTier,
        provider: checkoutProvider,
        currency: checkoutCurrency,
        paymentDeadline: checkoutDeadline ? new Date(checkoutDeadline) : undefined,
        notes: checkoutNotes,
      });
      setActionMessage('Checkout started. The tier activates automatically once they pay.');
      setCheckoutLink(result.checkout_url);
      setCreatingCheckout(false);
      resetCheckoutForm();
      loadArrangements();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That checkout did not start. Try again.',
      );
      setCreatingCheckout(false);
    }
  };

  const runCopyCheckoutLink = async () => {
    if (!checkoutLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(checkoutLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard access can be refused by the browser; the link is still
      // shown in full and selectable by hand.
    }
  };

  const [cancellingArrangement, setCancellingArrangement] = useState<Arrangement | null>(null);
  const [cancelArrangementReason, setCancelArrangementReason] = useState('');

  const runCancelArrangement = async () => {
    if (!cancellingArrangement) {
      return;
    }
    setActionError(null);
    setActionMessage(null);
    try {
      await cancelArrangement(cancellingArrangement.id, cancelArrangementReason);
      setActionMessage('Arrangement cancelled.');
      setCancellingArrangement(null);
      setCancelArrangementReason('');
      loadArrangements();
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : 'That cancellation did not go through. Try again.',
      );
      setCancellingArrangement(null);
    }
  };

  const [extendingArrangement, setExtendingArrangement] = useState<Arrangement | null>(null);
  const [extendDeadlineValue, setExtendDeadlineValue] = useState('');

  const runExtendDeadline = async () => {
    if (!extendingArrangement || !extendDeadlineValue) {
      return;
    }
    setActionError(null);
    setActionMessage(null);
    try {
      await extendArrangementDeadline(extendingArrangement.id, new Date(extendDeadlineValue));
      setActionMessage('Deadline extended.');
      setExtendingArrangement(null);
      setExtendDeadlineValue('');
      loadArrangements();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That extension did not go through. Try again.',
      );
      setExtendingArrangement(null);
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
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                resetOfflineForm();
                setRecordingOffline(true);
              }}
            >
              <Banknote width={15} height={15} aria-hidden />
              Record offline payment
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                resetTempAccessForm();
                setGrantingAccess(true);
              }}
            >
              <CalendarClock width={15} height={15} aria-hidden />
              Grant temporary access
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                resetCheckoutForm();
                setCreatingCheckout(true);
              }}
            >
              <CreditCard width={15} height={15} aria-hidden />
              Start a checkout
            </Button>
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
      {checkoutLink ? (
        <Card className="mb-4">
          <Text variant="body-sm" className="font-medium">
            Checkout link ready
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-1">
            Share this with the customer. The tier activates on its own once they pay, through the
            normal payment webhook.
          </Text>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-subtle px-2.5 py-1.5 text-xs text-ink">
              {checkoutLink}
            </code>
            <Button variant="secondary" size="sm" onClick={runCopyCheckoutLink}>
              <Copy width={14} height={14} aria-hidden />
              {linkCopied ? 'Copied' : 'Copy'}
            </Button>
            <a
              href={checkoutLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <ExternalLink width={14} height={14} aria-hidden />
              Open
            </a>
          </div>
        </Card>
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

          <div className="mb-3 mt-6 flex items-center gap-2">
            <Text variant="h4">Payment arrangements</Text>
            <Text variant="caption" tone="secondary">
              For an offline payment already made, temporary access ahead of payment, or a real
              checkout started on this customer's behalf. Every arrangement is written to the audit
              trail and sends its own email.
            </Text>
          </div>
          {arrangementsError ? <ErrorNote error={arrangementsError} /> : null}
          {arrangements.length === 0 ? (
            <Card>
              <Text variant="body-sm" tone="secondary">
                No payment arrangements for this Operator.
              </Text>
            </Card>
          ) : (
            <Table label="Payment arrangements">
              <THead>
                <TH>Type</TH>
                <TH>Tier</TH>
                <TH className="text-right">Amount</TH>
                <TH>Status</TH>
                <TH>Deadline</TH>
                <TH>Notes</TH>
                <TH className="text-right">Action</TH>
              </THead>
              <TBody>
                {arrangements.map((arrangement) => {
                  const urgency = deadlineUrgency(arrangement);
                  return (
                    <TR key={arrangement.id}>
                      <TD>
                        <div className="font-medium">{conditionLabel[arrangement.condition]}</div>
                        <Text variant="caption" tone="secondary" className="block">
                          {conditionDescription[arrangement.condition]}
                        </Text>
                      </TD>
                      <TD className="capitalize">{arrangement.tier}</TD>
                      <TD className="text-right tabular-nums">
                        {arrangement.amount_minor
                          ? formatAmount(arrangement.amount_minor, arrangement.currency)
                          : ''}
                      </TD>
                      <TD>
                        <ArrangementStatusBadge status={arrangement.status} />
                      </TD>
                      <TD className="text-ink-muted">
                        {when(arrangement.payment_deadline)}
                        {urgency ? (
                          <Text
                            variant="caption"
                            className={`block ${urgencyTextTone[urgency.tone]}`}
                          >
                            {urgency.label}
                          </Text>
                        ) : null}
                      </TD>
                      <TD className="max-w-xs text-ink-muted">
                        {arrangement.notes || arrangement.external_reference || ''}
                      </TD>
                      <TD className="text-right">
                        {isEditable(arrangement) ? (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setExtendDeadlineValue('');
                                setExtendingArrangement(arrangement);
                              }}
                            >
                              <CalendarClock width={14} height={14} aria-hidden />
                              Extend
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCancelArrangementReason('');
                                setCancellingArrangement(arrangement);
                              }}
                            >
                              <X width={14} height={14} aria-hidden />
                              Cancel
                            </Button>
                          </div>
                        ) : null}
                      </TD>
                    </TR>
                  );
                })}
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
              {state.status === 'ready'
                ? (state.data.paused_previous_tier ?? 'the prior tier')
                : ''}
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

      <ConfirmDialog
        open={recordingOffline}
        title="Record an offline payment?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              For a payment already made outside SlideOps — an offline arrangement, a bank transfer,
              cash. Activates the tier immediately under an explicit manual payment source, never a
              fabricated online transaction, and sends a confirmation email. This is written to the
              audit trail.
            </p>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink">Tier</span>
              <select
                className={selectClass}
                value={offlineTier}
                onChange={(event) => setOfflineTier(event.target.value as TierName)}
              >
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Amount (minor units)"
                type="number"
                min={1}
                value={offlineAmountMinor}
                onChange={(event) => setOfflineAmountMinor(event.target.value)}
                hint={
                  offlineAmountMinor
                    ? `= ${formatAmount(Math.trunc(Number(offlineAmountMinor)) || 0, offlineCurrency)}`
                    : 'e.g. 750000 for $7,500.00'
                }
              />
              <Field
                label="Currency"
                value={offlineCurrency}
                onChange={(event) => setOfflineCurrency(event.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>
            <Field
              label="Reference"
              hint="The Admin's own paper trail: a bank reference, a receipt number."
              value={offlineReference}
              onChange={(event) => setOfflineReference(event.target.value)}
              placeholder="bank-transfer-9921"
            />
            <Field
              label="Paid on"
              hint="Optional. Leave blank to record it as paid just now."
              type="date"
              value={offlinePaidAt}
              onChange={(event) => setOfflinePaidAt(event.target.value)}
            />
            <Field
              label="Notes"
              value={offlineNotes}
              onChange={(event) => setOfflineNotes(event.target.value)}
              placeholder="Paid via bank transfer, confirmed by phone on Sept 2"
            />
          </div>
        }
        confirmLabel="Record payment"
        confirmVariant="primary"
        onConfirm={runRecordOffline}
        onCancel={() => {
          setRecordingOffline(false);
          resetOfflineForm();
        }}
      />

      <ConfirmDialog
        open={grantingAccess}
        title="Grant temporary access?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              Activates the tier immediately, ahead of payment, expected to complete by the deadline
              below. No payment is created or implied — this is access on trust, tracked openly as
              exactly that, and sends a notice with the deadline. This is written to the audit
              trail.
            </p>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink">Tier</span>
              <select
                className={selectClass}
                value={tempTier}
                onChange={(event) => setTempTier(event.target.value as TierName)}
              >
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            <Field
              label="Payment deadline"
              hint="Optional. Leave blank to leave the deadline open ended."
              type="date"
              value={tempDeadline}
              onChange={(event) => setTempDeadline(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={tempAutoExpire}
                onChange={(event) => setTempAutoExpire(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Automatically expire access if the deadline passes with no payment
            </label>
            <Field
              label="Notes"
              value={tempNotes}
              onChange={(event) => setTempNotes(event.target.value)}
              placeholder="Customer is finalizing a wire transfer, access granted in the meantime"
            />
          </div>
        }
        confirmLabel="Grant access"
        confirmVariant="primary"
        onConfirm={runGrantTempAccess}
        onCancel={() => {
          setGrantingAccess(false);
          resetTempAccessForm();
        }}
      />

      <ConfirmDialog
        open={creatingCheckout}
        title="Start a payment-required checkout?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              Starts a real checkout on the customer's behalf, through the exact same pipeline a
              self-serve checkout already uses. No access changes: the tier activates only once they
              complete it, through the normal payment webhook. Sends the checkout link by email, and
              the link is also shown here to copy or open directly. This is written to the audit
              trail.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-ink">Tier</span>
                <select
                  className={selectClass}
                  value={checkoutTier}
                  onChange={(event) => setCheckoutTier(event.target.value as PurchasableTier)}
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-ink">Provider</span>
                <select
                  className={selectClass}
                  value={checkoutProvider}
                  onChange={(event) => setCheckoutProvider(event.target.value as PaymentProvider)}
                >
                  <option value="paystack">Paystack</option>
                  <option value="flutterwave">Flutterwave</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink">Currency</span>
              <select
                className={selectClass}
                value={checkoutCurrency}
                onChange={(event) => setCheckoutCurrency(event.target.value as PayCurrency)}
              >
                <option value="USD">USD</option>
                <option value="NGN">NGN</option>
              </select>
            </label>
            <Field
              label="Payment deadline"
              hint="Optional. Leave blank to leave the deadline open ended."
              type="date"
              value={checkoutDeadline}
              onChange={(event) => setCheckoutDeadline(event.target.value)}
            />
            <Field
              label="Notes"
              value={checkoutNotes}
              onChange={(event) => setCheckoutNotes(event.target.value)}
              placeholder="Customer requested a checkout link by email after the support call"
            />
          </div>
        }
        confirmLabel="Start checkout"
        confirmVariant="primary"
        onConfirm={runCreateCheckout}
        onCancel={() => {
          setCreatingCheckout(false);
          resetCheckoutForm();
        }}
      />

      <ConfirmDialog
        open={cancellingArrangement !== null}
        title="Cancel this arrangement?"
        description={
          <div className="flex flex-col gap-3">
            <p>
              Calls off this arrangement. Only its own record changes — access already granted under
              it is not automatically revoked, since undoing access is a separate, deliberate
              decision. This is written to the audit trail.
            </p>
            <Field
              label="Reason"
              hint="Why this arrangement is being cancelled. Required."
              value={cancelArrangementReason}
              onChange={(event) => setCancelArrangementReason(event.target.value)}
              placeholder="Customer changed their mind, paid through self-serve checkout instead"
            />
          </div>
        }
        confirmLabel="Cancel arrangement"
        confirmVariant="danger"
        onConfirm={runCancelArrangement}
        onCancel={() => {
          setCancellingArrangement(null);
          setCancelArrangementReason('');
        }}
      />

      <ConfirmDialog
        open={extendingArrangement !== null}
        title="Extend this arrangement's deadline?"
        description={
          <div className="flex flex-col gap-3">
            <p>Moves the payment deadline out. This is written to the audit trail.</p>
            <Field
              label="New deadline"
              type="date"
              value={extendDeadlineValue}
              onChange={(event) => setExtendDeadlineValue(event.target.value)}
            />
          </div>
        }
        confirmLabel="Extend deadline"
        confirmVariant="primary"
        onConfirm={runExtendDeadline}
        onCancel={() => {
          setExtendingArrangement(null);
          setExtendDeadlineValue('');
        }}
      />
    </AdminShell>
  );
}
