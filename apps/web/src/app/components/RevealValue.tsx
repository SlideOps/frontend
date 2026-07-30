import { Check, Copy, Eye, EyeOff } from '@slideops/icons';
import { useCallback, useEffect, useRef, useState } from 'react';

const MASK_CHARACTER = '•';
const MASK_MIN = 6;
const MASK_MAX = 24;

/**
 * The masked stand-in for a value. It never contains any character of the real
 * value, only a run of dots whose length is bounded so it neither leaks the
 * true length nor collapses to nothing for empty input.
 */
export function maskValue(value: string): string {
  const length = Math.min(Math.max(value.length, MASK_MIN), MASK_MAX);
  return MASK_CHARACTER.repeat(length);
}

export interface RevealValueProps {
  /**
   * The real value. It stays out of the DOM until revealed when `sensitive`.
   * When `onReveal` is supplied the plaintext is fetched lazily instead, and
   * this may be left unset because the value is not known until the first
   * reveal.
   */
  value?: string;
  /**
   * A lazy source for the plaintext. When present the real value is never in the
   * DOM until the Operator reveals or copies it: this is called once on the
   * first reveal (or copy), its result cached, with a loading and an error
   * state around it. When absent the component uses `value` as before.
   */
  onReveal?: () => Promise<string>;
  /** An accessible name for the value, used on the toggle and copy controls. */
  label?: string;
  /** Mask the value behind a reveal control. Defaults to true. */
  sensitive?: boolean;
  className?: string;
}

const COPIED_RESET_MS = 1500;
const REVEAL_ERROR = 'Could not reveal this value. Try again.';

/**
 * A secure value control: shows a value masked by default, an Eye toggle to
 * reveal or hide it, and a Copy control that writes the real value to the
 * clipboard and briefly confirms. Token styled and keyboard usable, so the
 * Credentials view can reuse it unchanged for real secrets. When `onReveal` is
 * given the plaintext is fetched lazily on the first reveal, so a stored secret
 * never enters the DOM until the Operator asks for it.
 */
export function RevealValue({
  value,
  onReveal,
  label,
  sensitive = true,
  className,
}: RevealValueProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<string | null> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const name = label ?? 'value';
  const eager = value ?? '';

  // Resolve the real plaintext, lazily and once when a source is given. Both the
  // reveal toggle and copy share this, so the secret is fetched at most once and
  // failures surface instead of being swallowed.
  const resolve = useCallback((): Promise<string | null> => {
    if (!onReveal) {
      return Promise.resolve(eager);
    }
    if (fetched !== null) {
      return Promise.resolve(fetched);
    }
    if (inflight.current) {
      return inflight.current;
    }
    setLoading(true);
    setError(null);
    const pending = onReveal()
      .then((plaintext) => {
        setFetched(plaintext);
        return plaintext;
      })
      .catch(() => {
        setError(REVEAL_ERROR);
        return null;
      })
      .finally(() => {
        setLoading(false);
        inflight.current = null;
      });
    inflight.current = pending;
    return pending;
  }, [onReveal, eager, fetched]);

  const toggle = useCallback(async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    const plaintext = await resolve();
    if (plaintext !== null) {
      setRevealed(true);
    }
  }, [revealed, resolve]);

  const copy = useCallback(async () => {
    const plaintext = await resolve();
    if (plaintext === null) {
      return;
    }
    try {
      await navigator.clipboard?.writeText(plaintext);
      setCopied(true);
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      // Clipboard access can be denied; fail quietly rather than surfacing noise.
      setCopied(false);
    }
  }, [resolve]);

  const plaintext = onReveal ? (fetched ?? '') : eager;
  const shown = !sensitive || revealed;
  const displayed = loading ? 'Revealing' : shown ? plaintext : maskValue(plaintext);

  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <span
        className={[
          'inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-subtle px-2 py-1',
          className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span
          className={[
            'min-w-0 truncate font-mono text-xs',
            loading ? 'text-ink-muted' : 'text-ink',
          ].join(' ')}
          aria-hidden={sensitive && !shown ? true : undefined}
        >
          {displayed}
        </span>

        {sensitive ? (
          <button
            type="button"
            onClick={toggle}
            disabled={loading}
            aria-label={revealed ? `Hide ${name}` : `Reveal ${name}`}
            aria-pressed={revealed}
            aria-busy={loading || undefined}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-fast ease-standard hover:bg-surface hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            {revealed ? (
              <EyeOff width={14} height={14} aria-hidden />
            ) : (
              <Eye width={14} height={14} aria-hidden />
            )}
          </button>
        ) : null}

        <button
          type="button"
          onClick={copy}
          disabled={loading}
          aria-label={copied ? `Copied ${name}` : `Copy ${name}`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors duration-fast ease-standard hover:bg-surface hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
        >
          {copied ? (
            <Check width={14} height={14} className="text-success" aria-hidden />
          ) : (
            <Copy width={14} height={14} aria-hidden />
          )}
        </button>

        <span aria-live="polite" className="sr-only">
          {copied
            ? `Copied ${name}`
            : loading
              ? `Revealing ${name}`
              : revealed
                ? `${name} revealed`
                : ''}
        </span>
      </span>

      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
