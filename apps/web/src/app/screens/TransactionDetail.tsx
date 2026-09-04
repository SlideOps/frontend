import {
  ApiError,
  cancelTransaction,
  emailTransactionReceipt,
  getTransaction,
  refreshTransactionStatus,
  resumeCheckout,
  transactionReceiptURL,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowLeft, Copy, Download, ExternalLink, Mail, RefreshCw } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatMoney } from '../billing-format';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { TransactionStatusBadge } from '../components/TransactionStatusBadge';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * One payment in full, and exactly the actions its own state allows -- the
 * available actions come straight from `transaction.status`, never a fixed
 * list, so a successful payment never shows Cancel and a pending one never
 * shows Download Receipt.
 */

/** One labelled fact in the detail layout. */
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

export function TransactionDetail() {
  const { reference = '' } = useParams();
  const navigate = useNavigate();
  const { state, reload } = useAsyncData(
    (signal) => getTransaction(reference, signal),
    [reference],
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  const transaction = state.status === 'ready' ? state.data : null;

  const runCopy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused by the browser; the reference is
      // still shown in full and selectable by hand.
    }
  };

  const runComplete = async () => {
    setWorking(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await resumeCheckout(reference);
      if (result.already_succeeded) {
        setActionMessage('This payment already succeeded.');
        reload();
        return;
      }
      window.location.href = result.checkout_url;
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : 'That payment could not be resumed. Try Try Payment Again below.',
      );
      reload();
    } finally {
      setWorking(false);
    }
  };

  const runCancel = async () => {
    setActionError(null);
    setActionMessage(null);
    try {
      const cancelled = await cancelTransaction(reference);
      if (cancelled.status === 'success') {
        setActionMessage('This payment already succeeded, so it was not cancelled.');
      } else {
        setActionMessage('Payment cancelled.');
      }
      setConfirmingCancel(false);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That cancellation did not go through.',
      );
      setConfirmingCancel(false);
    }
  };

  const runRefresh = async () => {
    setWorking(true);
    setActionError(null);
    try {
      await refreshTransactionStatus(reference);
      setLastChecked(new Date());
      reload();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Could not check right now.');
    } finally {
      setWorking(false);
    }
  };

  const runEmailReceipt = async () => {
    setWorking(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await emailTransactionReceipt(reference);
      setActionMessage('Receipt sent to your account email.');
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Could not send the receipt.');
    } finally {
      setWorking(false);
    }
  };

  const startNewPayment = () => navigate('/app/billing');

  return (
    <OperatorShell active="billing">
      <PageHeader
        title="Transaction"
        description="What happened to this payment, and what you can do next."
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/billing/transactions')}>
            <ArrowLeft width={15} height={15} aria-hidden />
            Transactions
          </Button>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading this transaction" /> : null}
      {state.status === 'error' ? (
        state.error.status === 404 ? (
          <EmptyState
            icon={ArrowLeft}
            title="Transaction not found"
            description="This reference does not match anything in your own payment history."
            action={
              <Button onClick={() => navigate('/app/billing/transactions')}>
                Back to Transactions
              </Button>
            }
          />
        ) : (
          <ErrorNote error={state.error} />
        )
      ) : null}

      {transaction ? (
        <div className="flex flex-col gap-6">
          <Card>
            <TransactionStatusBadge status={transaction.status} className="text-base" />
            <Text variant="h3" className="mt-2 capitalize">
              {transaction.tier} Plan
            </Text>
            <Text variant="h2" className="mt-1">
              {formatMoney(transaction.amount_minor, transaction.currency)}{' '}
              <Text as="span" variant="body-sm" tone="secondary">
                {transaction.currency}
              </Text>
            </Text>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Fact
                label="Payment Date"
                value={new Date(transaction.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              />
              <Fact
                label="Transaction ID"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-mono text-xs">{transaction.reference}</span>
                    <button
                      type="button"
                      onClick={runCopy}
                      aria-label="Copy transaction ID"
                      className="text-ink-muted hover:text-ink"
                    >
                      <Copy width={13} height={13} aria-hidden />
                    </button>
                    {copied ? <span className="text-xs text-success">Copied</span> : null}
                  </span>
                }
              />
              {transaction.provider_reference ? (
                <Fact label="Provider Reference" value={transaction.provider_reference} />
              ) : null}
              {transaction.provider ? <Fact label="Payment Provider" value={transaction.provider} /> : null}
              <Fact label="Subscription" value={<span className="capitalize">{transaction.tier}</span>} />
              {transaction.billing_period ? (
                <Fact label="Billing Period" value={transaction.billing_period} />
              ) : null}
              {transaction.status === 'success' ? (
                <Fact label="Receipt" value={transaction.receipt_available ? 'Available' : 'Not available'} />
              ) : null}
              {transaction.promo_code ? <Fact label="Promo Code" value={transaction.promo_code} /> : null}
            </div>

            {transaction.status === 'pending' ? (
              <Text variant="caption" tone="secondary" className="mt-4 block">
                Last checked: {lastChecked ? lastChecked.toLocaleTimeString() : 'not yet'}
              </Text>
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
              {transaction.status === 'pending' ? (
                <>
                  <Button onClick={runComplete} disabled={working}>
                    {working ? 'Opening' : 'Complete Payment'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmingCancel(true)}
                    disabled={working}
                  >
                    Cancel Payment
                  </Button>
                  <Button variant="ghost" onClick={runRefresh} disabled={working}>
                    <RefreshCw width={14} height={14} aria-hidden />
                    Check Payment Status
                  </Button>
                </>
              ) : null}

              {transaction.status === 'success' ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => window.open(transactionReceiptURL(reference), '_blank')}
                  >
                    <ExternalLink width={14} height={14} aria-hidden />
                    View Receipt
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => window.open(transactionReceiptURL(reference), '_blank')}
                  >
                    <Download width={14} height={14} aria-hidden />
                    Download Receipt
                  </Button>
                  <Button variant="ghost" onClick={runEmailReceipt} disabled={working}>
                    <Mail width={14} height={14} aria-hidden />
                    {working ? 'Sending' : 'Email Receipt'}
                  </Button>
                </>
              ) : null}

              {transaction.status === 'failed' ? (
                <Button onClick={startNewPayment}>Try Payment Again</Button>
              ) : null}

              {transaction.status === 'cancelled' ? (
                <Button onClick={startNewPayment}>Start Payment Again</Button>
              ) : null}
            </div>

            {transaction.status === 'failed' || transaction.status === 'cancelled' ? (
              <Text variant="caption" tone="secondary" className="mt-3 block">
                This starts a brand new payment. Nothing from this one carries over.
              </Text>
            ) : null}

            {transaction.status === 'refunded' ? (
              <Text variant="body-sm" tone="secondary" className="mt-2">
                This payment was refunded. Reach out to whoever runs this platform for the refund
                details behind it.
              </Text>
            ) : null}

            {transaction.status === 'disputed' ? (
              <Text variant="body-sm" tone="secondary" className="mt-2">
                This payment is under dispute with the payment provider. Reach out to whoever runs
                this platform for its current status.
              </Text>
            ) : null}
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancel this payment?"
        description={
          <>
            This will cancel the pending payment for the {transaction?.tier ?? ''} plan.
            <br />
            No successful payment has been recorded.
          </>
        }
        confirmLabel="Cancel Payment"
        cancelLabel="Keep Payment"
        confirmVariant="danger"
        onConfirm={runCancel}
        onCancel={() => setConfirmingCancel(false)}
      />
    </OperatorShell>
  );
}
