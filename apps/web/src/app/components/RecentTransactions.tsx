import { listTransactions, resumeCheckout, type Transaction } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowRight } from '@slideops/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '../billing-format';
import { useAsyncData } from '../hooks/useAsyncData';
import { TransactionStatusBadge } from './TransactionStatusBadge';

/*
 * The compact activity strip at the bottom of Billing Overview: the five
 * most recent payments, so an Operator who left a checkout half-finished
 * sees it right there without a trip to the full Transactions page. Shows
 * nothing at all -- no heading, no empty table -- until at least one
 * transaction exists; a first-time Operator with no payment history yet
 * should not see a meaningless empty section.
 */

const RECENT_LIMIT = 5;

export function RecentTransactions() {
  const navigate = useNavigate();
  const { state } = useAsyncData(
    (signal) => listTransactions({ limit: RECENT_LIMIT }, signal),
    [],
  );
  const [resuming, setResuming] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  if (state.status !== 'ready' || state.data.transactions.length === 0) {
    return null;
  }

  const runComplete = async (reference: string) => {
    setResuming(reference);
    setResumeError(null);
    try {
      const result = await resumeCheckout(reference);
      if (result.already_succeeded) {
        navigate('/app/billing/transactions');
        return;
      }
      window.location.href = result.checkout_url;
    } catch {
      setResumeError('That payment could not be resumed. Open it from Transactions to try again.');
      setResuming(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Text variant="h4">Recent Transactions</Text>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/billing/transactions')}>
          View All Transactions
          <ArrowRight width={14} height={14} aria-hidden />
        </Button>
      </div>
      {resumeError ? (
        <p role="alert" className="mb-3 text-sm text-danger">
          {resumeError}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {state.data.transactions.map((tx: Transaction) => (
          <Card key={tx.reference} className="flex flex-col gap-2">
            <TransactionStatusBadge status={tx.status} />
            <div className="flex items-baseline justify-between">
              <Text variant="body-sm" className="font-medium capitalize">
                {tx.tier} plan
              </Text>
              <Text variant="body-sm" className="font-semibold">
                {formatMoney(tx.amount_minor, tx.currency)}
              </Text>
            </div>
            <Text variant="caption" tone="secondary">
              {new Date(tx.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <div className="mt-1 flex gap-2">
              {tx.status === 'pending' ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => runComplete(tx.reference)}
                  disabled={resuming === tx.reference}
                >
                  {resuming === tx.reference ? 'Opening' : 'Complete Payment'}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/app/billing/transactions/${tx.reference}`)}
                >
                  View
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
