import type { OperationEvent, OperationStatus, PlanStep } from '@slideops/api-client';
import { cn, Text } from '@slideops/design-system';
import { CheckCircle2, Circle, Loader2, XCircle } from '@slideops/icons';
import { RiskBadge } from './Badges';

/*
 * The step timeline. It shows every planned step and advances as the live step
 * events arrive, so an Operator watches progress move down the plan they
 * approved. The state of each step is derived from the event log, which is the
 * same log whether replayed from History or streamed live.
 */

export type StepState = 'pending' | 'running' | 'done' | 'failed';

const DONE_WORDS = ['done', 'completed', 'complete', 'success', 'ok', 'passed', 'finished'];
const FAILED_WORDS = ['failed', 'failure', 'error'];
const RUNNING_WORDS = ['running', 'started', 'start', 'in_progress', 'active', 'begin'];

function normalizeState(raw: unknown): StepState | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const value = raw.toLowerCase();
  if (DONE_WORDS.includes(value)) {
    return 'done';
  }
  if (FAILED_WORDS.includes(value)) {
    return 'failed';
  }
  if (RUNNING_WORDS.includes(value)) {
    return 'running';
  }
  return undefined;
}

function stepIdOf(data: Record<string, unknown>): string | undefined {
  for (const key of ['step_id', 'stepId', 'id', 'step']) {
    const value = data[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

/**
 * Work out the state of each plan step from the event log and the Operation
 * status. It matches step events to steps by id when the backend supplies one,
 * and falls back to advancing one step per event when it does not, so the
 * timeline stays sensible either way.
 */
export function deriveStepStates(
  steps: readonly PlanStep[],
  events: readonly OperationEvent[],
  status: OperationStatus,
): StepState[] {
  const result: StepState[] = steps.map(() => 'pending');
  const indexById = new Map(steps.map((step, index) => [step.id, index] as const));
  const stepEvents = events.filter((event) => event.type === 'operation.step');

  let matchedAny = false;
  for (const event of stepEvents) {
    const id = stepIdOf(event.data);
    const index = id === undefined ? undefined : indexById.get(id);
    if (index !== undefined) {
      matchedAny = true;
      result[index] = normalizeState(event.data.state ?? event.data.status) ?? 'running';
    }
  }

  if (matchedAny) {
    let lastActive = -1;
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      if (result[i] !== 'pending') {
        lastActive = i;
        break;
      }
    }
    for (let i = 0; i < lastActive; i += 1) {
      if (result[i] === 'pending') {
        result[i] = 'done';
      }
    }
  } else {
    const count = stepEvents.length;
    for (let i = 0; i < steps.length; i += 1) {
      if (i < count - 1) {
        result[i] = 'done';
      } else if (i === count - 1) {
        result[i] = 'running';
      }
    }
  }

  if (status === 'completed') {
    for (let i = 0; i < steps.length; i += 1) {
      if (result[i] !== 'failed') {
        result[i] = 'done';
      }
    }
  } else if (status === 'failed') {
    for (let i = 0; i < steps.length; i += 1) {
      if (result[i] === 'running') {
        result[i] = 'failed';
      }
    }
  } else if (status === 'cancelled') {
    for (let i = 0; i < steps.length; i += 1) {
      if (result[i] === 'running') {
        result[i] = 'pending';
      }
    }
  }

  return result;
}

function StepMarker({ state }: { state: StepState }) {
  if (state === 'done') {
    return <CheckCircle2 width={20} height={20} className="text-success" aria-hidden />;
  }
  if (state === 'failed') {
    return <XCircle width={20} height={20} className="text-danger" aria-hidden />;
  }
  if (state === 'running') {
    return <Loader2 width={20} height={20} className="animate-spin text-info" aria-hidden />;
  }
  return <Circle width={20} height={20} className="text-ink-muted" aria-hidden />;
}

const stateLabel: Record<StepState, string> = {
  pending: 'Pending',
  running: 'In progress',
  done: 'Done',
  failed: 'Failed',
};

export interface StepTimelineProps {
  steps: readonly PlanStep[];
  events: readonly OperationEvent[];
  status: OperationStatus;
}

export function StepTimeline({ steps, events, status }: StepTimelineProps) {
  const states = deriveStepStates(steps, events, status);

  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const state = states[index] ?? 'pending';
        const isLast = index === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[9px] top-6 h-full w-px',
                  state === 'done' ? 'bg-success' : 'bg-border',
                )}
              />
            ) : null}
            <span className="relative z-10 mt-0.5 shrink-0">
              <StepMarker state={state} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Text variant="body-sm" className="font-medium">
                  {step.title}
                </Text>
                <span className="text-xs text-ink-muted">{stateLabel[state]}</span>
              </div>
              <Text variant="body-sm" tone="secondary" className="mt-1">
                {step.description}
              </Text>
              <div className="mt-2">
                <RiskBadge risk={step.risk} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
