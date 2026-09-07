import { ApiError, type PreflightCheck, type Remedy } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { AlertTriangle, CheckCircle2, XCircle, Wrench } from '@slideops/icons';
import { useState } from 'react';

/*
 * One check, and the fix for it.
 *
 * Preflight ("would this deploy work") and Diagnose ("why has this stopped
 * working") ask different questions and return the same shape, so they render
 * through the same component: an Operator should not have to learn two layouts
 * to read the same answer.
 *
 * The Fix button is the point. A check that explains an outage and then leaves
 * the Operator to open a terminal has moved the work rather than done it --
 * which is the moment the platform stops being the thing that operates their
 * infrastructure. When a check comes back with a remedy, pressing it runs the
 * Capability that fixes it, through the ordinary Operation lifecycle.
 */

/** The status icon for one check. */
export function CheckStatusIcon({ status }: { status: PreflightCheck['status'] }) {
  if (status === 'pass') {
    return (
      <CheckCircle2 width={16} height={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
    );
  }
  if (status === 'fail') {
    return <XCircle width={16} height={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />;
  }
  return (
    <AlertTriangle width={16} height={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
  );
}

export interface CheckListProps {
  checks: PreflightCheck[];
  /**
   * Applies a check's fix. Returning the Operation id lets the list say what to
   * go and watch; an empty string means the fix needed no Operation, which is
   * true of one that only corrects the Service's own configuration.
   *
   * Omit it and remedies render as an explanation with no button, which is the
   * honest thing to show where a fix cannot be applied from.
   */
  onApply?: (remedy: Remedy) => Promise<string>;
  /**
   * Called after a fix is applied, with the Operation to follow (empty for a
   * fix that needed none).
   *
   * The caller owns what to say about it. A screen that re-checks after a fix
   * replaces this list, which would take any confirmation rendered inside a
   * row down with it -- so the row reports nothing and the screen reports
   * everything.
   */
  onApplied?: (operationId: string) => void;
}

/** Every check from a Preflight or a Diagnose, each with its fix. */
export function CheckList({ checks, onApply, onApplied }: CheckListProps) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {checks.map((check) => (
        <li key={check.name} className="flex flex-col gap-2 py-2">
          <div className="flex items-start gap-2">
            <CheckStatusIcon status={check.status} />
            <div className="min-w-0">
              <Text variant="body-sm" className="font-medium text-ink">
                {check.name}
              </Text>
              <Text variant="body-sm" tone="secondary">
                {check.message}
              </Text>
            </div>
          </div>
          {check.remedy ? (
            <RemedyRow remedy={check.remedy} onApply={onApply} onApplied={onApplied} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The fix for one check: what it will do, and the button that does it. */
function RemedyRow({
  remedy,
  onApply,
  onApplied,
}: {
  remedy: Remedy;
  onApply?: (remedy: Remedy) => Promise<string>;
  onApplied?: (operationId: string) => void;
}) {
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'applying' }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  async function apply() {
    if (!onApply) return;
    setState({ status: 'applying' });
    try {
      onApplied?.(await onApply(remedy));
    } catch (cause) {
      setState({
        status: 'error',
        message: cause instanceof ApiError ? cause.message : 'The fix could not be applied.',
      });
    }
  }

  return (
    <div className="ml-6 flex flex-col gap-2 rounded-md border border-border bg-surface-muted p-3">
      <div className="flex items-start gap-2">
        <Wrench width={14} height={14} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
        <div className="min-w-0">
          <Text variant="body-sm" className="font-medium text-ink">
            {remedy.title}
          </Text>
          <Text variant="body-sm" tone="secondary">
            {remedy.detail}
          </Text>
        </div>
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      {onApply ? (
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void apply()}
            disabled={state.status === 'applying'}
          >
            {state.status === 'applying' ? 'Applying' : 'Fix this'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
