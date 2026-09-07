import {
  ApiError,
  applyRemedy,
  diagnoseService,
  type PreflightCheck,
  type Remedy,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { Stethoscope } from '@slideops/icons';
import { useState } from 'react';
import { CheckList } from './ServiceChecks';

/*
 * Why a Service that already deployed has stopped working.
 *
 * The deploy was fine. A week later the database moved, or its firewall was
 * rebuilt, or its engine came back bound to loopback -- and SlideOps' last word
 * on the subject was still "running", because nothing looked again after the
 * deploy succeeded. The Operator's only remaining move was an SSH session and
 * an afternoon.
 *
 * This is the second look, on demand: whether the container is actually up or
 * crash-looping (with its own last output, which is the line they would have
 * gone to the terminal to read), whether every dependency is still reachable
 * from its Node, and whether the hostname in front of it has anything
 * listening. Each failure comes back with the fix, applied from here.
 */
export function ServiceDiagnosePanel({
  serviceId,
  onFixed,
}: {
  serviceId: string;
  /** Called after a fix is applied, so the Service page can refresh. */
  onFixed?: () => void;
}) {
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; checks: PreflightCheck[] }
    | { status: 'error'; message: string }
  >({ status: 'idle' });
  /** What the last applied fix started, kept across the re-check that follows. */
  const [applied, setApplied] = useState<string | null>(null);

  async function run() {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', checks: await diagnoseService(serviceId) });
    } catch (cause) {
      setState({
        status: 'error',
        message: cause instanceof ApiError ? cause.message : 'The check could not run.',
      });
    }
  }

  const failing =
    state.status === 'ready' ? state.checks.filter((c) => c.status === 'fail').length : 0;

  return (
    <Section
      title="Diagnose"
      description="Checks a deployed Service against the things that break after a good deploy: a container that is crash-looping, a dependency it can no longer reach, or a hostname with nothing listening to answer it. It never changes the Node."
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void run()}
            disabled={state.status === 'loading'}
          >
            <Stethoscope width={14} height={14} aria-hidden />
            {state.status === 'loading' ? 'Checking' : 'Run checks'}
          </Button>
          {state.status === 'ready' ? (
            <Text variant="body-sm" tone="secondary">
              {failing === 0
                ? 'Nothing failing.'
                : `${failing} problem${failing === 1 ? '' : 's'} found.`}
            </Text>
          ) : null}
        </div>

        {applied !== null ? (
          <Text variant="body-sm" tone="secondary">
            {applied
              ? 'Fix started. Follow it in History, where it is planned, executed and verified like any other Operation.'
              : 'Fix applied. Redeploy this Service for it to take effect.'}
          </Text>
        ) : null}

        {state.status === 'error' ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}

        {state.status === 'ready' ? (
          <CheckList
            checks={state.checks}
            onApply={(remedy: Remedy) => applyRemedy(serviceId, remedy)}
            onApplied={(operationId) => {
              setApplied(operationId);
              onFixed?.();
              void run();
            }}
          />
        ) : null}
      </div>
    </Section>
  );
}
