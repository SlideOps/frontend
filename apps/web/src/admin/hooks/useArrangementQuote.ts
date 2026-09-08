import { ApiError, quoteArrangement, type ArrangementQuote } from '@slideops/api-client';
import { useEffect, useRef, useState } from 'react';

/**
 * Ask the backend what an arrangement would cost, and keep asking as the admin
 * changes the plan, the term or the currency.
 *
 * Two things this has to get right, because it is money on a screen.
 *
 * It waits before asking. A term is a number the admin edits a digit at a time,
 * and firing a request per keystroke would put four answers in flight for a
 * question that was only asked once.
 *
 * A slow answer to an older question never wins. Every request takes a number
 * and only the newest number is allowed to write the state, so a quote for the
 * plan that was on screen a moment ago cannot replace the quote for the plan
 * that is on screen now. The request in flight is also aborted, which is the
 * cheaper half of the same guarantee; the number is the half that still holds
 * when an abort is not honoured.
 */

/** How long the inputs must sit still before the backend is asked. */
const quoteDebounceMs = 300;

export type ArrangementQuoteState =
  /** Nothing has been asked: no plan chosen yet, or the form is not open. */
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; quote: ArrangementQuote }
  | { status: 'error'; error: ApiError };

export interface ArrangementQuoteRequest {
  operatorId: string;
  tier: string;
  /** Months of access being arranged. */
  termMonths: number;
  /** What to charge in. Empty or undefined means the tier's own currency. */
  currency?: string;
  /**
   * Ask for this as a gift. The tier is then not priced at all, so no currency
   * is sent either: there is no charge for one to denominate.
   */
  free?: boolean;
  /**
   * A discount code to price this under. Empty or undefined means none, and
   * the backend is then never told about a code at all.
   */
  promoCode?: string;
  /** Ask at all. A closed dialog should not be quoting. */
  enabled?: boolean;
}

/** Normalize anything thrown into the typed error the screens render. */
function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(0, 'unknown_error', 'The amount could not be worked out. Try again.');
}

export function useArrangementQuote(
  request: ArrangementQuoteRequest,
): { state: ArrangementQuoteState } {
  const {
    operatorId,
    tier,
    termMonths,
    currency,
    free = false,
    promoCode = '',
    enabled = true,
  } = request;
  const [state, setState] = useState<ArrangementQuoteState>({ status: 'idle' });

  // The number every request is issued under. Compared on arrival, so a stale
  // answer is dropped rather than rendered.
  const issued = useRef(0);

  useEffect(() => {
    const askable =
      enabled &&
      operatorId !== '' &&
      tier !== '' &&
      Number.isFinite(termMonths) &&
      termMonths >= 1;

    if (!askable) {
      setState({ status: 'idle' });
      return;
    }

    const sequence = issued.current + 1;
    issued.current = sequence;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setState({ status: 'loading' });
      quoteArrangement(
        operatorId,
        {
          tier,
          termMonths,
          currency: free ? undefined : currency || undefined,
          free: free || undefined,
          // A gift is not priced at all, so there is nothing for a code to come
          // off. Sending one would ask for a discount on nothing.
          promoCode: free ? undefined : promoCode.trim() || undefined,
        },
        controller.signal,
      )
        .then((quote) => {
          if (issued.current === sequence) {
            setState({ status: 'ready', quote });
          }
        })
        .catch((error: unknown) => {
          if (issued.current === sequence && !controller.signal.aborted) {
            setState({ status: 'error', error: toApiError(error) });
          }
        });
    }, quoteDebounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [operatorId, tier, termMonths, currency, free, promoCode, enabled]);

  return { state };
}
