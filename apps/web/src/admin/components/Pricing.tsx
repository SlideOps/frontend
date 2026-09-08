import { Field, Text } from '@slideops/design-system';
import { Banknote } from '@slideops/icons';
import { useId } from 'react';
import {
  billingPeriodMonths,
  freeGrantReason,
  noChargeReason,
  quoteConversionNote,
  quoteFailureText,
  quoteLines,
  quoteUnavailableMessage,
} from '../arrangements';
import type { ArrangementQuoteState } from '../hooks/useArrangementQuote';

/*
 * How an arrangement's price is asked for and shown.
 *
 * The three inputs an amount follows from are the plan, how long for, and what
 * to charge in. None of them is an amount, and that is the point: the figure is
 * worked out by the same pricing the customer's own checkout uses and shown
 * back, never typed into the obligation.
 */

const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export interface TermMonthsFieldProps {
  label: string;
  hint?: string;
  /** The month count as typed, so a half-finished number is not rewritten. */
  value: string;
  onChange: (value: string) => void;
  /**
   * The smallest month count this question accepts. One where a term is being
   * granted, since granting nothing is not a thing to ask for; zero where an
   * existing term is being corrected, since zero is how an arrangement says it
   * records no term at all.
   */
  min?: number;
  /** Said under the box when what was typed cannot be used. */
  error?: string;
}

/**
 * How long the arrangement runs for, in months.
 *
 * A plain month count rather than a fixed list, because an arrangement made by
 * hand is not obliged to match a self serve billing period. The periods the
 * product does sell are offered as suggestions so the common ones stay one
 * keystroke away.
 */
export function TermMonthsField({
  label,
  hint,
  value,
  onChange,
  min = 1,
  error,
}: TermMonthsFieldProps) {
  const listId = useId();
  return (
    <div>
      <Field
        label={label}
        type="number"
        min={min}
        step={1}
        inputMode="numeric"
        list={listId}
        hint={hint ?? 'The number of months this covers.'}
        error={error}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {billingPeriodMonths.map((months) => (
          <option key={months} value={months} />
        ))}
      </datalist>
    </div>
  );
}

export interface CurrencySelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** What this deployment can actually charge in, as the backend named them. */
  options: string[];
  /**
   * Offer charging in whatever the tier is priced in, which is what the backend
   * does when no currency is named. Not offered where a currency has to be
   * stated outright, such as recording a payment that already happened.
   */
  hint?: string;
}

/** What to charge in, from the list the deployment published. */
export function CurrencySelect({
  id,
  label,
  value,
  onChange,
  options,
  hint,
}: CurrencySelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {/* Never a list written here. What this deployment can charge in
            depends on which providers are configured and whether a live
            exchange rate is available, and only the backend knows that.

            And never an empty choice either. "The plan's own currency" was an
            option once, which asked the Admin to know what a plan is priced in
            before they could answer, and read as a currency in its own right
            beside real ones. Every choice here is now a currency somebody can
            actually be charged in. */}
        {options.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
      {hint ? (
        <Text variant="body-sm" tone="secondary">
          {hint}
        </Text>
      ) : null}
    </div>
  );
}

export interface QuoteBreakdownProps {
  state: ArrangementQuoteState;
  /** Named back to the admin when the backend refuses the chosen currency. */
  availableCurrencies: string[];
  /** What this figure is, said above it. */
  caption?: string;
}

/**
 * The figure, and everything it was made of.
 *
 * A total on its own cannot be checked or explained, so the monthly price, the
 * term, the discount, the tax and any conversion rate are all shown. A tier
 * with no self serve price reads as no charge, which is an answer; a refused
 * currency reads as what the backend said, which is also an answer. Neither is
 * a blank.
 */
export function QuoteBreakdown({ state, availableCurrencies, caption }: QuoteBreakdownProps) {
  return (
    <div className="rounded-md border border-border bg-subtle px-4 py-3">
      <div className="flex items-center gap-2">
        <Banknote width={14} height={14} className="text-ink-muted" aria-hidden />
        <Text variant="caption" tone="secondary">
          {caption ?? 'What the customer is expected to pay'}
        </Text>
      </div>

      {state.status === 'idle' ? (
        <Text variant="body-sm" tone="secondary" className="mt-2 block">
          Choose a plan and a term and the amount is worked out from the price table.
        </Text>
      ) : null}

      {state.status === 'loading' ? (
        <Text variant="body-sm" tone="secondary" className="mt-2 block" role="status">
          Working out the amount
        </Text>
      ) : null}

      {state.status === 'error' ? (
        <div role="alert" className="mt-2">
          <Text variant="body-sm" className="block text-danger">
            {quoteFailureText(state.error, availableCurrencies)}
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-1 block">
            {quoteUnavailableMessage}
          </Text>
        </div>
      ) : null}

      {state.status === 'ready' ? (
        <>
          <dl className="mt-2 flex flex-col gap-1">
            {quoteLines(state.quote).map((line) => (
              <div key={line.label} className="flex items-baseline justify-between gap-4">
                <Text as="dt" variant="body-sm" tone="secondary">
                  {line.label}
                </Text>
                <Text
                  as="dd"
                  variant="body-sm"
                  className={line.total ? 'font-semibold tabular-nums' : 'tabular-nums'}
                >
                  {line.value}
                </Text>
              </div>
            ))}
          </dl>
          {state.quote.free_grant ? (
            <Text variant="body-sm" tone="secondary" className="mt-2 block">
              {freeGrantReason(state.quote)}
            </Text>
          ) : null}
          {!state.quote.free_grant && !state.quote.purchasable ? (
            <Text variant="body-sm" tone="secondary" className="mt-2 block">
              {noChargeReason(state.quote)}
            </Text>
          ) : null}
          {quoteConversionNote(state.quote) ? (
            <Text variant="body-sm" tone="secondary" className="mt-2 block">
              {quoteConversionNote(state.quote)}
            </Text>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
