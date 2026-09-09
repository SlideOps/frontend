import { getDockerCrashAnalysis } from '@slideops/api-client';
import { Card, Text, cn } from '@slideops/design-system';
import { AlertTriangle, FileText, ScanSearch, Terminal } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { ErrorNote, Loading } from './Feedback';
import { crashEvidence, type CrashEvidenceItem, type CrashEvidenceTone } from '../docker-analysis';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * What Docker recorded about a container that keeps failing.
 *
 * The hard rule for this panel, and the reason it exists as its own file: it
 * never states a cause. Not "out of memory killed your app", not "the database
 * was unreachable", not "this looks like a configuration problem". It shows the
 * restart count, the last restart, the exit code, whether the kernel recorded
 * an OOM kill, what the healthcheck said, and whether the restarts form a loop
 * with the figures behind that judgement. Every one of those is something the
 * daemon recorded.
 *
 * The reason is not modesty. An exit code of 137 is consistent with an OOM
 * kill, with a `docker kill`, and with a process that chose to exit on SIGKILL
 * from something else entirely, and a tool that picks one of those and prints
 * it as the answer sends an Operator to rewrite memory limits during an
 * incident caused by a deploy script. Evidence, then the three places the
 * actual answer lives.
 *
 * Where a dimension has no evidence, it is absent from this panel. There is no
 * "Cause: unknown" row, because that sentence claims a search was made and
 * failed, when the truth is only that Docker recorded nothing there.
 */

const TONE_CLASS: Record<CrashEvidenceTone, string> = {
  neutral: 'text-ink',
  warning: 'text-warning',
  danger: 'text-danger',
};

/** One recorded fact, as a labelled tile. */
function EvidenceTile({ item }: { item: CrashEvidenceItem }) {
  // A timestamp is the one value crashEvidence hands over unformatted, since a
  // pure function cannot know the reader's timezone. Everything else is already
  // display ready.
  const value = item.at ? new Date(item.at).toLocaleString() : item.value;
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <Text variant="caption" tone="secondary" className="block">
        {item.label}
      </Text>
      <span className={cn('mt-1 block text-sm font-medium', TONE_CLASS[item.tone])}>{value}</span>
    </div>
  );
}

/** Where one of the three next steps goes. A step with neither is not rendered. */
export interface DockerCrashStep {
  /** A route to follow. */
  to?: string;
  /** Or something to do in place, such as switching a tab on this screen. */
  onSelect?: () => void;
}

export interface DockerCrashSteps {
  /** The container's output around the failure: where the reason usually is. */
  logs?: DockerCrashStep;
  /** The full inspect: limits, mounts, networks, the healthcheck definition. */
  inspect?: DockerCrashStep;
  /** A shell inside the container, for the questions the other two cannot answer. */
  terminal?: DockerCrashStep;
}

const STEP_ICON = {
  logs: FileText,
  inspect: ScanSearch,
  terminal: Terminal,
} as const;

const STEP_LABEL: Record<keyof DockerCrashSteps, string> = {
  logs: 'Read the logs around the failure',
  inspect: 'Inspect this container',
  terminal: 'Open a terminal in this container',
};

const linkClass =
  'inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

function NextStep({ kind, step }: { kind: keyof DockerCrashSteps; step: DockerCrashStep }) {
  const Icon = STEP_ICON[kind];
  const label = STEP_LABEL[kind];
  const content = (
    <>
      <Icon width={15} height={15} aria-hidden />
      {label}
    </>
  );
  if (step.to) {
    return (
      <Link to={step.to} className={linkClass}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={step.onSelect} className={linkClass}>
      {content}
    </button>
  );
}

export interface DockerCrashPanelProps {
  /** The Node the container is on. */
  nodeId: string;
  /** The container's id or name, as the daemon knows it. */
  containerRef: string;
  /** The name to say in the copy, when the caller has one. */
  containerName?: string;
  /**
   * Where the three next steps lead.
   *
   * Optional, and a step with no destination is not rendered at all. A link
   * that goes nowhere is worse than one fewer link on a page somebody is
   * reading because their production workload is down.
   */
  steps?: DockerCrashSteps;
}

/**
 * The restart evidence for one container.
 *
 * It reads, and only reads. Nothing on this panel changes the container, which
 * matters because it is opened at exactly the moment somebody is tempted to try
 * something.
 */
export function DockerCrashPanel({
  nodeId,
  containerRef,
  containerName,
  steps,
}: DockerCrashPanelProps) {
  const result = useAsyncData(
    (signal) => getDockerCrashAnalysis(nodeId, containerRef, signal),
    [nodeId, containerRef],
  );
  const name = containerName ?? containerRef;

  if (result.state.status === 'loading') {
    return (
      <Card>
        <Loading label={`Reading what Docker recorded about ${name}`} />
      </Card>
    );
  }
  if (result.state.status === 'error') {
    return (
      <Card>
        <ErrorNote error={result.state.error} />
      </Card>
    );
  }

  const analysis = result.state.data;
  const items = crashEvidence(analysis);
  const offered = (['logs', 'inspect', 'terminal'] as const).filter((kind) => steps?.[kind]);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {analysis.crash_loop ? (
          <AlertTriangle width={18} height={18} className="text-danger" aria-hidden />
        ) : null}
        <Text variant="h4">What Docker recorded about {name}</Text>
      </div>

      <Text variant="body-sm" tone="secondary">
        These are the facts Docker kept about this container. SlideOps does not work out why it
        stopped, because the daemon does not know either: the reason is in the container's own
        output, and the three places below are where an Operator finds it.
      </Text>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <EvidenceTile key={item.key} item={item} />
        ))}
      </div>

      {/* The backend's own observations, verbatim. Rewording evidence in the
          browser is how a report acquires claims nobody made. */}
      {analysis.observations.length > 0 ? (
        <ul className="rounded-md border border-border bg-surface">
          {analysis.observations.map((observation) => (
            <li
              key={observation.code}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border px-3 py-2 first:border-t-0"
            >
              <span className="shrink-0 rounded-md bg-subtle px-1.5 py-0.5 font-mono text-xs text-ink-muted">
                {observation.code}
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink">{observation.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {offered.length > 0 ? (
        <div className="border-t border-border pt-4">
          <Text variant="caption" tone="secondary" className="block">
            Where the reason will be
          </Text>
          <div className="mt-3 flex flex-wrap gap-2">
            {offered.map((kind) => (
              <NextStep key={kind} kind={kind} step={steps![kind]!} />
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
