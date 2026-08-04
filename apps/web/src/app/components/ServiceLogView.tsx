import { openServiceLogStream, type ServiceLogConnectionState } from '@slideops/api-client';
import { Button, Text, cn } from '@slideops/design-system';
import { RefreshCw } from '@slideops/icons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ansiSegmentStyle, parseAnsiLine } from './ansi';
import { CopyButton } from './CopyButton';

/*
 * The Service's live output: `docker logs --follow`, `docker compose logs
 * --follow`, or `journalctl --follow`, whichever the Service's own recorded
 * runtime calls for, chosen on the backend rather than guessed here.
 *
 * One websocket carries the whole thing. It opens showing recent history --
 * the last of what the workload already printed -- and then every new line
 * arrives as its own message, in order, for as long as this stays mounted.
 * There is nothing to poll and nothing to refetch: the backend pushes, this
 * appends, immediately, as each message arrives.
 *
 * The backend keeps following through a Service being restarted and through
 * the ordinary bounds on how long one SSH command may run, on its side of the
 * same socket, so an Operator watching rarely sees either. What this
 * reconnects is the socket itself going away -- a real network drop -- with
 * the same backoff every other live connection in this app already uses. A
 * reconnect, from either side, never clears what is already on screen: the
 * backend never resends history once it has already followed once, and this
 * view never throws away a line it has already shown. A crash is exactly the
 * moment this matters most, so nothing here is allowed to clear the buffer on
 * its own.
 */

interface LogEntry {
  id: number;
  // "line" is the workload's own output; "diagnostic" is a marker about the
  // stream itself (attached, reconnected, a replacement container), shown
  // inline but never confused for something the workload printed.
  kind: 'line' | 'diagnostic';
  text: string;
}

// Capped so a tab left open for hours does not grow the page's memory without
// bound. An Operator debugging something live wants the last several thousand
// lines, not the whole history of a long running process.
const MAX_LINES = 5000;
// How close to the bottom counts as "at the bottom" for auto-scroll purposes.
// Exact equality would drop out of auto-scroll on the first sub-pixel layout
// jitter, which reads as the viewer randomly refusing to follow.
const NEAR_BOTTOM_PX = 32;

const STATE_LABEL: Record<ServiceLogConnectionState, string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  stopped: 'Service stopped',
  disconnected: 'Disconnected',
  stream_ended: 'Stream ended',
};

const STATE_TONE: Record<ServiceLogConnectionState, string> = {
  connecting: 'text-info',
  connected: 'text-success',
  reconnecting: 'text-warning',
  stopped: 'text-ink-muted',
  disconnected: 'text-danger',
  stream_ended: 'text-ink-muted',
};

const STATE_DOT: Record<ServiceLogConnectionState, string> = {
  connecting: 'bg-info',
  connected: 'bg-success',
  reconnecting: 'bg-warning',
  stopped: 'bg-ink-muted',
  disconnected: 'bg-danger',
  stream_ended: 'bg-ink-muted',
};

/** The connection state, as a small dot and a word -- the same shape every
 * status badge in this app already uses. */
function ConnectionIndicator({ state }: { state: ServiceLogConnectionState }) {
  return (
    <span role="status" className="inline-flex items-center gap-1.5">
      <span className={cn('h-1.5 w-1.5 rounded-full', STATE_DOT[state])} aria-hidden />
      <Text variant="caption" className={STATE_TONE[state]}>
        {STATE_LABEL[state]}
      </Text>
    </span>
  );
}

/** One entry: the workload's own line, ANSI colour preserved and every other
 * escape sequence stripped, or a dimmed marker about the stream itself. */
function LogEntryRow({ entry }: { entry: LogEntry }) {
  if (entry.kind === 'diagnostic') {
    // A diagnostic can carry more than one line -- a replacement container's
    // id and start time alongside the marker itself -- so line breaks are
    // preserved rather than collapsed into one run-on sentence.
    return (
      <div
        role="status"
        className="my-1.5 whitespace-pre-line border-y border-border/60 py-1 text-center text-[11px] italic text-ink-muted"
      >
        {entry.text}
      </div>
    );
  }
  const segments = parseAnsiLine(entry.text);
  return (
    <div className="whitespace-pre-wrap break-all">
      {segments.map((segment, index) => (
        <span key={index} style={ansiSegmentStyle(segment.style)}>
          {segment.text}
        </span>
      ))}
      {segments.length === 0 ? ' ' : null}
    </div>
  );
}

export function ServiceLogView({ id }: { id: string }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [state, setState] = useState<ServiceLogConnectionState>('connecting');
  const [detail, setDetail] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  // Bumped when the Operator asks to reconnect, so the connect effect below
  // reruns without id itself needing to change -- and, deliberately, without
  // the entries effect above it rerunning, so a manual reconnect never clears
  // what is already on screen.
  const [generation, setGeneration] = useState(0);

  const seqRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // Whether history has already been shown once for this Service. The backend
  // sends it again on every fresh connection -- including a reconnect after
  // the socket itself dropped -- since each is a new follow from its side.
  // Applying it a second time would duplicate the same recent lines under
  // themselves; skipping it here is what "only append" means for the one
  // frame that is not itself a new line.
  const receivedHistoryRef = useRef(false);

  const append = (kind: LogEntry['kind'], text: string) => {
    setEntries((current) => {
      const next = current.concat({ id: seqRef.current++, kind, text });
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  };

  // Resets only when the Operator switches to a different Service. Nothing
  // else -- not a reconnect, not a restart, not the websocket dropping and
  // coming back -- may clear the buffer, or the one moment an Operator needs
  // the scrollback most is exactly the moment something would erase it.
  useEffect(() => {
    setEntries([]);
    seqRef.current = 0;
    receivedHistoryRef.current = false;
    setState('connecting');
    setDetail(null);
  }, [id]);

  useEffect(() => {
    const handle = openServiceLogStream({
      serviceId: id,
      onHistory: (history) => {
        if (receivedHistoryRef.current) {
          return;
        }
        receivedHistoryRef.current = true;
        const historyLines = history.split('\n');
        setEntries((current) =>
          current.concat(historyLines.map((text) => ({ id: seqRef.current++, kind: 'line', text }))),
        );
      },
      // Appended the instant it arrives: no buffering, no batching, so an
      // Operator watching a crash happen sees the traceback the moment the
      // backend forwards it, not on the next animation frame or the next
      // refresh.
      onLine: (line) => append('line', line),
      onDiagnostic: (message) => append('diagnostic', message),
      onStateChange: (nextState, nextDetail) => {
        setState(nextState);
        setDetail(nextDetail ?? null);
      },
    });

    return () => handle.close();
  }, [id, generation]);

  // Follows the bottom while auto-scroll is on, and only then: an Operator who
  // scrolled up to read something must never be yanked back down by the next
  // line arriving underneath them.
  useLayoutEffect(() => {
    if (!autoScroll) {
      return;
    }
    const el = containerRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [entries, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distanceFromBottom <= NEAR_BOTTOM_PX);
  };

  // A fresh socket, not a fresh view: the scrollback stays exactly as it was.
  const reconnect = () => {
    setAutoScroll(true);
    setGeneration((value) => value + 1);
  };

  // Exactly what is on screen, in the same order: the workload's own lines
  // and the stream diagnostics between them, joined the way they are already
  // read top to bottom. An Operator pasting this into a support ticket wants
  // the whole picture, restarts included, not a guess at which lines were the
  // real output.
  const fullText = useMemo(() => entries.map((entry) => entry.text).join('\n'), [entries]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <Text variant="body-sm" tone="secondary">
            Live output from the running workload.
          </Text>
          <ConnectionIndicator state={state} />
        </span>
        <span className="flex items-center gap-2">
          <CopyButton value={fullText} label="the log output" />
          <Button variant="ghost" size="sm" onClick={reconnect}>
            <RefreshCw width={14} height={14} aria-hidden />
            Reconnect
          </Button>
        </span>
      </div>

      {/* A permanent refusal -- the Service does not exist, or never created a
          workload -- is the actual reason, not a generic failure. */}
      {state === 'disconnected' && detail ? (
        <p role="alert" className="text-sm text-danger">
          {detail}
        </p>
      ) : null}

      {/* A stopped Service is not an error: this view keeps watching for it to
          run again on its own, and says so rather than reading as broken. */}
      {state === 'stopped' ? (
        <p className="text-sm text-ink-muted">
          {detail ?? 'Service stopped.'} Watching for it to start again.
        </p>
      ) : null}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Live Service output"
        className="max-h-80 w-full min-w-0 max-w-full overflow-auto rounded-md border border-border bg-app p-3 font-mono text-xs leading-relaxed text-ink"
      >
        {entries.length > 0 ? (
          entries.map((entry) => <LogEntryRow key={entry.id} entry={entry} />)
        ) : (
          <Text variant="body-sm" tone="secondary">
            {state === 'connecting' ? 'Reading recent output…' : 'No logs yet.'}
          </Text>
        )}
      </div>

      {!autoScroll ? (
        <button
          type="button"
          onClick={() => setAutoScroll(true)}
          className="self-end text-xs text-ink-muted underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          Scrolled up — new output is arriving below. Jump to latest.
        </button>
      ) : null}
    </div>
  );
}
