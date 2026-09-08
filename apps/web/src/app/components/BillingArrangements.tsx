import {
  ApiError,
  TransactionActionError,
  completeArrangementPayment,
  listBillingArrangements,
  type BillingArrangement,
} from '@slideops/api-client';
import { Button, Card, Text, cn } from '@slideops/design-system';
import { ArrowUpRight, Banknote, CalendarClock, Gift } from '@slideops/icons';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { transactionDetailPath } from '../billing-routes';
import {
  amountReading,
  canComplete,
  conditionExplainer,
  conditionHeadline,
  deadlineReading,
  endedArrangements,
  endedSummary,
  isOutstanding,
  openArrangements,
  tierName,
} from '../billing-arrangements';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * What the Operator owes on access that was arranged for them, on the page
 * where they already come to deal with their plan and their payments.
 *
 * An Admin can grant access before payment. That decision used to live only in
 * the email announcing it, so the person who owed money had nowhere in the
 * product to see what for. The only control in front of them started a fresh
 * checkout, which would have raised a second charge beside the payment already
 * waiting for the same debt. This panel answers what they were given, what is
 * owed, by when, and what to do, and everything it offers leads to that one
 * existing payment: resuming it through the same path Transactions uses, and
 * opening it at the same detail page Transactions opens. Neither ever starts a
 * second payment.
 *
 * It is an addition to Billing and never a dependency of it: if the
 * arrangements endpoint is unavailable the panel renders nothing at all and
 * the rest of the page is untouched.
 */

/** The tone classes a deadline reading maps onto, in semantic tokens only. */
const deadlineTone = {
  neutral: 'text-ink-muted',
  warning: 'text-warning',
  bad: 'text-danger',
} as const;

/**
 * The failure to show when resuming is refused.
 *
 * The payment endpoints report a refusal as a TransactionActionError rather than
 * an ApiError, so matching on ApiError alone would throw away the backend's own
 * words for what went wrong and replace them with a guess.
 */
function resumeFailureMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof TransactionActionError) {
    return error.message;
  }
  return 'That payment could not be resumed.';
}

/** The money line, which is a different sentence for a gift and for a silence. */
function AmountLine({ arrangement }: { arrangement: BillingArrangement }) {
  const reading = amountReading(arrangement);
  const outstanding = isOutstanding(arrangement);

  if (reading.kind === 'free') {
    return (
      <div className="text-right">
        <Text variant="h4" className="text-success">
          No charge
        </Text>
        <Text variant="body-sm" tone="secondary" className="mt-0.5">
          Nothing to pay
        </Text>
      </div>
    );
  }

  if (reading.kind === 'unstated') {
    // An absent amount is not a zero. Saying so is the honest answer to "what
    // do I owe"; printing a zero would tell them they owe nothing.
    return outstanding ? (
      <Text variant="body-sm" tone="secondary">
        Amount not stated yet
      </Text>
    ) : null;
  }

  return (
    <div className="text-right">
      <Text variant="h4">{reading.text}</Text>
      {outstanding ? (
        <Text variant="body-sm" tone="secondary" className="mt-0.5">
          Outstanding
        </Text>
      ) : null}
    </div>
  );
}

/**
 * The way through to the payment itself.
 *
 * The panel used to print the reference and stop there, which named a payment
 * the Operator then had to go and find in Transactions by hand. This is the
 * same destination that list opens, reached from the arrangement that raised
 * it. It is an addition to completing, never a replacement: this one shows the
 * payment, the button beside it picks the payment back up.
 */
function PaymentLink({ reference }: { reference: string }) {
  return (
    <Link
      to={transactionDetailPath(reference)}
      className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium text-brand underline transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <ArrowUpRight width={16} height={16} aria-hidden />
      View payment {reference}
    </Link>
  );
}

/** One live arrangement, in full, with whatever it actually allows. */
function OpenArrangement({
  arrangement,
  completing,
  onComplete,
}: {
  arrangement: BillingArrangement;
  completing: boolean;
  onComplete: () => void;
}) {
  const deadline = deadlineReading(arrangement);
  const gift = arrangement.condition === 'free_grant';
  const Icon = gift ? Gift : Banknote;
  const completable = canComplete(arrangement);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Icon
            width={18}
            height={18}
            className={cn('mt-0.5 shrink-0', gift ? 'text-success' : 'text-brand')}
            aria-hidden
          />
          <div className="min-w-0">
            <Text variant="h4">{tierName(arrangement.tier)} plan</Text>
            <Text variant="body-sm" tone="secondary" className="mt-0.5">
              {conditionHeadline[arrangement.condition]}
            </Text>
          </div>
        </div>
        <AmountLine arrangement={arrangement} />
      </div>

      <Text variant="body-sm" tone="secondary" className="mt-3">
        {conditionExplainer[arrangement.condition]}
      </Text>

      {deadline ? (
        <div className={cn('mt-3 flex items-center gap-2', deadlineTone[deadline.tone])}>
          <CalendarClock width={15} height={15} className="shrink-0" aria-hidden />
          <Text as="span" variant="body-sm" className="font-medium">
            {deadline.label}
          </Text>
        </div>
      ) : null}

      {completable ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onComplete} disabled={completing}>
              <Banknote width={16} height={16} aria-hidden />
              {completing ? 'Opening your payment' : 'Complete this payment'}
            </Button>
            {/* Only when one exists. A payable arrangement need not have one:
                the checkout for a price an Admin has since corrected is voided,
                and the new one is made when the customer chooses to pay. */}
            {arrangement.payment_reference ? (
              <PaymentLink reference={arrangement.payment_reference} />
            ) : null}
          </div>
          <Text variant="body-sm" tone="secondary" className="mt-2">
            Completing takes you to the payment for this arrangement, at the amount shown here. It
            never starts a second payment for the same thing, and you will not be charged twice.
          </Text>
        </div>
      ) : arrangement.payment_reference ? (
        // Nothing left to settle, but the payment still exists and is still the
        // answer to what happened, so it stays reachable. Only paying is
        // withheld, and the reason is the server's own words rather than a
        // guess made from the status.
        <div className="mt-4">
          {arrangement.unpayable_reason ? (
            <Text variant="body-sm" tone="secondary" className="mb-2 block">
              {arrangement.unpayable_reason}
            </Text>
          ) : null}
          <PaymentLink reference={arrangement.payment_reference} />
        </div>
      ) : arrangement.unpayable_reason ? (
        <Text variant="body-sm" tone="secondary" className="mt-4">
          {arrangement.unpayable_reason}
        </Text>
      ) : isOutstanding(arrangement) ? (
        <Text variant="body-sm" tone="secondary" className="mt-4">
          There is no payment open for this yet, so there is nothing to complete here. Ask whoever
          arranged this to send you one.
        </Text>
      ) : null}
    </Card>
  );
}

/** The Operator's own arrangements, or nothing at all when there are none. */
export function BillingArrangements() {
  const { state, reload } = useAsyncData((signal) => listBillingArrangements(signal), []);
  const [completing, setCompleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const runComplete = async (arrangement: BillingArrangement) => {
    // One call, and the server decides what it means: returning to the checkout
    // already open, or opening one at terms an Admin has since changed. The
    // panel used to resume a reference itself, which could only ever do the
    // first, so an arrangement whose price had been corrected had its old
    // checkout voided and nothing to offer in its place.
    //
    // Nothing here can start a second debt for the same arrangement. That is a
    // property of the endpoint rather than of this button, which is what makes
    // it true of every other caller too.
    if (completing) {
      return;
    }
    setCompleting(arrangement.id);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await completeArrangementPayment(arrangement.id);
      if (result.already_succeeded) {
        setActionNotice(
          'That payment already went through. Your plan is being brought up to date.',
        );
        setCompleting(null);
        reload();
        return;
      }
      if (result.superseded) {
        // The customer is told before they are sent anywhere. Being taken to a
        // checkout showing a number other than the one just on screen, with no
        // explanation, reads as the platform having got it wrong.
        setActionNotice(
          'The terms of this were updated, so a new payment was prepared at the current amount. Taking you there now.',
        );
      }
      window.location.href = result.checkout_url;
    } catch (error) {
      setActionError(resumeFailureMessage(error));
      setCompleting(null);
      reload();
    }
  };

  // Anything other than a loaded list leaves Billing exactly as it was. A
  // customer whose arrangements cannot be read still has a working plan page.
  if (state.status !== 'ready') {
    return null;
  }

  const open = openArrangements(state.data);
  const ended = endedArrangements(state.data);
  if (open.length === 0 && ended.length === 0) {
    return null;
  }

  return (
    <div>
      <Text variant="h4" className="mb-3">
        Access arranged for you
      </Text>

      {actionNotice ? (
        <p role="status" className="mb-3 text-sm text-success">
          {actionNotice}
        </p>
      ) : null}
      {actionError ? (
        <div role="alert" className="mb-3">
          <p className="text-sm text-danger">{actionError}</p>
          <p className="mt-1 text-sm text-ink-muted">
            Try again, or open Transactions to see where that payment stands.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {open.map((arrangement) => (
          <OpenArrangement
            key={arrangement.id}
            arrangement={arrangement}
            completing={completing === arrangement.id}
            onComplete={() => runComplete(arrangement)}
          />
        ))}
      </div>

      {ended.length > 0 ? (
        <div className="mt-4">
          <Text variant="caption" tone="secondary" className="block">
            Earlier arrangements
          </Text>
          <ul className="mt-2 flex flex-col gap-1.5">
            {ended.map((arrangement) => {
              const reading = amountReading(arrangement);
              return (
                <li key={arrangement.id}>
                  <Text variant="body-sm" tone="secondary">
                    {tierName(arrangement.tier)} plan
                    {reading.kind === 'amount' ? `, ${reading.text}` : ''}
                    {reading.kind === 'free' ? ', at no charge' : ''}. {endedSummary(arrangement)}
                  </Text>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
