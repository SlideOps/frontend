import { Button, Text, type ButtonVariant } from '@slideops/design-system';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/*
 * A deliberate confirmation dialog for audited actions. It traps nothing the
 * platform depends on, but it does the accessible essentials: it labels itself,
 * moves focus to the dialog on open and restores it on close, closes on Escape
 * and on a backdrop click, and keeps Tab within its own controls. Every mutation
 * behind it (suspend, pause, resume) is confirmed here before it is sent.
 */

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  /**
   * Hold the confirm control until the dialog's own requirement is met, such as
   * a reason that has to be typed before an access can be taken away. The
   * backend still decides; this only stops a dialog being passed through before
   * it has been answered.
   */
  confirmDisabled?: boolean;
  /** Run the action. May be async; the dialog shows a working state until it settles. */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [working, setWorking] = useState(false);

  /*
   * Move focus into the dialog on open, and put it back on close.
   *
   * This runs on `open` alone. It used to depend on `onCancel` as well, and
   * every caller passes that as an inline arrow, so any state change in the
   * screen behind the dialog produced a new one and re-ran this: focus jumped
   * out of whatever the person was typing and onto the confirm button, one
   * character in. Every dialog here that asks for a reason before it will act
   * was unusable because of it.
   */
  useEffect(() => {
    if (!open) {
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // A dialog whose confirm is held until it has been answered cannot take
    // focus there, so the panel itself takes it and the keyboard still starts
    // inside the dialog rather than behind it.
    confirmRef.current?.focus();
    if (document.activeElement !== confirmRef.current) {
      panelRef.current?.focus();
    }
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Escape and the Tab cycle, kept in their own effect so the handler can
  // follow a changing onCancel without disturbing focus.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === 'Tab') {
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
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const confirm = async () => {
    setWorking(true);
    try {
      await onConfirm();
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-lg transition duration-base ease-entrance"
      >
        <Text id={titleId} variant="h3">
          {title}
        </Text>
        <div id={descId} className="mt-3">
          <Text variant="body-sm" tone="secondary" as="div">
            {description}
          </Text>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={working}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={confirmVariant}
            onClick={confirm}
            disabled={working || confirmDisabled}
          >
            {working ? 'Working' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
