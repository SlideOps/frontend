import type { BillingArrangement } from '@slideops/api-client';
import { Button, Text, cn } from '@slideops/design-system';
import { ArrowRight, ArrowUpRight, Banknote, CalendarClock, Clock, Gift, X } from '@slideops/icons';
import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { transactionDetailPath } from '../billing-routes';
import {
  accessReading,
  amountReading,
  canComplete,
  conditionExplainer,
  conditionHeadline,
  deadlineReading,
  isOutstanding,
  nextStep,
  readDay,
  statusReading,
  termReading,
  tierName,
} from '../billing-arrangements';

/*
 * One arrangement, opened in full.
 *
 * The panel on Billing is a summary, and a summary is all it should be: a plan
 * name, a figure, a deadline, a button. Everything else about a grant lived
 * only in the email that announced it, so a customer who wanted to know what
 * they had actually been given -- how long the access runs, what the figure
 * covers, whether the date on screen was the access ending or the money being
 * due, which payment settles it -- had nowhere in the product to look. Those
 * are different questions from "what do I owe", and the card answers only that
 * one.
 *
 * It is a modal rather than a page on purpose. Every fact here is already in
 * the list the panel loaded, so opening one costs no request and cannot fail
 * on its own; and the action it leads to is the same button the card carries,
 * which the customer should not have to navigate away and back to reach.
 *
 * It decides nothing. Payability, the wording of every reading, and what to do
 * next all come from the same pure module the card reads, so the two surfaces
 * cannot disagree about what a customer owes.
 */

/** The tone classes a deadline reading maps onto, in semantic tokens only. */
const deadlineTone = {
  neutral: 'text-ink-muted',
  warning: 'text-warning',
  bad: 'text-danger',
} as const;

const statusTone = {
  neutral: 'bg-subtle text-ink-muted',
  info: 'bg-subtle text-info',
  success: 'bg-subtle text-success',
  warning: 'bg-subtle text-warning',
  danger: 'bg-subtle text-danger',
} as const;

/** One labelled fact. Absent values are not rendered as blanks: a row saying
 *  nothing is worse than no row, because it reads as a fact that is missing
 *  rather than one that was never recorded. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-2.5 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <div className="min-w-0 sm:max-w-[62%] sm:text-right">{children}</div>
    </div>
  );
}

/** The plain-text row, which is most of them. */
function DetailText({ label, value }: { label: string; value: string }) {
  return (
    <DetailRow label={label}>
      <Text variant="body-sm">{value}</Text>
    </DetailRow>
  );
}

/** What is owed, said the way the card says it, including the two ways of
 *  owing nothing that must never collapse into a zero. */
function AmountRow({ arrangement }: { arrangement: BillingArrangement }) {
  const reading = amountReading(arrangement);
  if (reading.kind === 'free') {
    return (
      <DetailRow label="Amount">
        <Text variant="body-sm" className="font-medium text-success">
          No charge
        </Text>
      </DetailRow>
    );
  }
  if (reading.kind === 'unstated') {
    return (
      <DetailRow label="Amount">
        <Text variant="body-sm" tone="secondary">
          Not stated yet
        </Text>
      </DetailRow>
    );
  }
  return (
    <DetailRow label={isOutstanding(arrangement) ? 'Amount outstanding' : 'Amount'}>
      <Text variant="body-sm" className="font-medium">
        {reading.text}
      </Text>
    </DetailRow>
  );
}

/**
 * Everything one arrangement is, with the action it allows.
 *
 * open and arrangement are separate props rather than one nullable one so the
 * modal can be told to close without the content vanishing from under the
 * closing frame.
 */
export function ArrangementDetail({
  open,
  arrangement,
  completing,
  onComplete,
  onClose,
}: {
  open: boolean;
  arrangement: BillingArrangement | null;
  /** Whether this arrangement's payment is being opened right now, so the one
   *  button cannot be pressed twice and the card and the modal agree about it. */
  completing: boolean;
  onComplete: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !arrangement) {
    return null;
  }

  const gift = arrangement.condition === 'free_grant';
  const Icon = gift ? Gift : Banknote;
  const status = statusReading(arrangement);
  const deadline = deadlineReading(arrangement);
  const access = accessReading(arrangement);
  const term = termReading(arrangement);
  const arranged = readDay(arrangement.created_at);
  const due = readDay(arrangement.payment_deadline);
  const completable = canComplete(arrangement);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle',
                gift ? 'text-success' : 'text-brand',
              )}
            >
              <Icon width={18} height={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <Text id={titleId} variant="h3">
                {tierName(arrangement.tier)} plan
              </Text>
              <Text variant="caption" tone="secondary" className="mt-0.5 block">
                {conditionHeadline[arrangement.condition]}
              </Text>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X width={18} height={18} aria-hidden />
          </button>
        </div>

        <Text variant="body-sm" tone="secondary">
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

        <div className="mt-5 rounded-md border border-border bg-subtle px-4">
          <DetailRow label="Status">
            <span
              className={cn(
                'inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium',
                statusTone[status.tone],
              )}
            >
              {status.label}
            </span>
          </DetailRow>
          <AmountRow arrangement={arrangement} />
          {term ? <DetailText label="Covers" value={term} /> : null}
          {access ? <DetailText label="Access period" value={access.period} /> : null}
          {due ? <DetailText label="Payment due" value={due} /> : null}
          {arranged ? <DetailText label="Arranged on" value={arranged} /> : null}
          {arrangement.payment_reference ? (
            <DetailRow label="Payment">
              <Link
                to={transactionDetailPath(arrangement.payment_reference)}
                className="inline-flex items-center gap-1.5 break-all text-sm font-medium text-brand underline transition-colors duration-fast ease-standard hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {arrangement.payment_reference}
                <ArrowUpRight width={14} height={14} className="shrink-0" aria-hidden />
              </Link>
            </DetailRow>
          ) : null}
          <DetailRow label="Reference">
            <Text variant="body-sm" tone="secondary" className="break-all font-mono">
              {arrangement.id}
            </Text>
          </DetailRow>
        </div>

        {access?.note ? (
          <div className="mt-3 flex items-center gap-2 text-ink-muted">
            <Clock width={15} height={15} className="shrink-0" aria-hidden />
            <Text as="span" variant="body-sm">
              {access.note}
            </Text>
          </div>
        ) : null}

        <div className="mt-5 rounded-md border border-border p-4">
          <div className="mb-1 flex items-center gap-2">
            <ArrowRight width={14} height={14} className="text-ink-muted" aria-hidden />
            <Text variant="caption" tone="secondary">
              What happens next
            </Text>
          </div>
          <Text variant="body-sm">{nextStep(arrangement)}</Text>
        </div>

        {completable ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button onClick={onComplete} disabled={completing}>
              <Banknote width={16} height={16} aria-hidden />
              {completing ? 'Opening your payment' : 'Complete this payment'}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="mt-5">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
