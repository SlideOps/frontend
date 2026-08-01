import { Button } from '@slideops/design-system';
import { Check, Copy } from '@slideops/icons';
import { useEffect, useState } from 'react';

/*
 * Copying a value without selecting it by hand.
 *
 * A setup secret shown as selectable text asks somebody to drag across a
 * thirty two character string without missing a character at either end, on a
 * phone as often as not. They then find out whether they got it right only when
 * the code they type back is rejected, which reads as the setup being broken
 * rather than the selection being short.
 *
 * So there is a button. It says what happened afterwards, because a copy that
 * gives no feedback leaves somebody pressing it again to be sure.
 */

export function CopyButton({
  value,
  label,
  className,
}: {
  /** The text to put on the clipboard. */
  value: string;
  /** What is being copied, for the accessible name: "Copy the setup secret". */
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  // The confirmation is temporary: a button reading "Copied" forever is a button
  // that has stopped telling you anything.
  useEffect(() => {
    if (state === 'idle') {
      return;
    }
    const timer = window.setTimeout(() => setState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      /*
       * The clipboard API needs a secure context and a permission that can be
       * refused, so this genuinely fails sometimes: an http origin, an older
       * browser, a locked down profile. Saying so matters more than usual here,
       * because the value is still on screen and can be selected by hand; a
       * button that silently did nothing would leave somebody believing they had
       * copied a secret they had not.
       */
      setState('failed');
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={copy}
      className={className}
      aria-label={state === 'copied' ? `${label}: copied` : `Copy ${label}`}
      title={state === 'failed' ? 'Could not reach the clipboard. Select the text instead.' : `Copy ${label}`}
    >
      {state === 'copied' ? (
        <Check width={14} height={14} className="text-success" aria-hidden />
      ) : (
        <Copy width={14} height={14} aria-hidden />
      )}
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select it instead' : 'Copy'}
    </Button>
  );
}
