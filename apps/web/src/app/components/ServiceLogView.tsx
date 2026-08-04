import { openServiceLogStream, type ServiceLogConnectionState } from '@slideops/api-client';
import { Button, Text, cn } from '@slideops/design-system';
import { RefreshCw } from '@slideops/icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ansiSegmentStyle, parseAnsiLine } from './ansi';

/*
 * The Service's live output: `docker logs --follow`, `docker compose logs
 * --follow`, or `journalctl --follow`, whichever the Service's own recorded
 * runtime calls for, chosen on the backend rather than guessed here.
 *
 * One websocket carries the whole thing. It opens showing recent history --
 * the last of what the workload already printed -- and then every new line
 * arrives as its own message, in order, for as long as this stays mounted.
 * There is nothing to poll and nothing to refetch: the backend pushes, this
 * appends.
 *
 * Reconnecting is mostly not this component's problem. The backend already
 * follows through a Service being restarted and through the ordinary bounds on
 * how long one SSH command may run, on its side of the same socket, so an
 * Operator watching rarely sees either. What this reconnects is the socket
 * itself going away -- a real network drop -- with the same backoff every other
 * live connection in this app already uses.
 */

interface LogLine {
  id: number;
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

/** One line, ANSI colour preserved where the workload sent it, every other
 * escape sequence stripped. */
function LogLineRow({ text }: { text: string }) {
  const segments = parseAnsiLine(text);
  return (
    <div className="whitespace-pre-wrap break-all">
      {segments.map((segment, index) => (
        <span key={index} style={ansiSegmentStyle(segment.style)}>
          {segment.text}
        </span>
      ))}
      {segments.length === 0 ? ' ' : null}
    </div>
  );
}

export function ServiceLogView({ id }: { id: string }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [state, setState] = useState<ServiceLogConnectionState>('connecting');
  const [detail, setDetail] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  // Bumped on every manual reconnect, so the connect effect below reruns
  // without id itself needing to change.
  const [generation, setGeneration] = useState(0);

  const seqRef = useRef(0);
  const pendingRef = useRef<LogLine[]>([]);
  const flushHandleRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const nextLine = (text: string): LogLine => ({ id: seqRef.current++, text });

  // Incoming lines are buffered and flushed on the next animation frame rather
  // than on every message. A chatty workload can print dozens of lines in a
  // single tick, and a state update -- and a re-render -- per line is what
  // "flickering" and "a complete rerender every message" both mean in practice.
  const scheduleFlush = () => {
    if (flushHandleRef.current !== null) {
      return;
    }
    flushHandleRef.current = window.requestAnimationFrame(() => {
      flushHandleRef.current = null;
      if (pendingRef.current.length === 0) {
        return;
      }
      const incoming = pendingRef.current;
      pendingRef.current = [];
      setLines((current) => {
        const next = current.concat(incoming);
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    });
  };

  useEffect(() => {
    setLines([]);
    setState('connecting');
    setDetail(null);
    seqRef.current = 0;
    pendingRef.current = [];

    const handle = openServiceLogStream({
      serviceId: id,
      onHistory: (history) => {
        const historyLines = history.split('\n').map(nextLine);
        setLines(historyLines);
      },
      onLine: (line) => {
        pendingRef.current.push(nextLine(line));
        scheduleFlush();
      },
      onStateChange: (nextState, nextDetail) => {
        setState(nextState);
        setDetail(nextDetail ?? null);
      },
    });

    return () => {
      if (flushHandleRef.current !== null) {
        window.cancelAnimationFrame(flushHandleRef.current);
        flushHandleRef.current = null;
      }
      handle.close();
    };
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
  }, [lines, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distanceFromBottom <= NEAR_BOTTOM_PX);
  };

  const reconnect = () => {
    setAutoScroll(true);
    setGeneration((value) => value + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <Text variant="body-sm" tone="secondary">
            Live output from the running workload.
          </Text>
          <ConnectionIndicator state={state} />
        </span>
        <Button variant="ghost" size="sm" onClick={reconnect}>
          <RefreshCw width={14} height={14} aria-hidden />
          Reconnect
        </Button>
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
        {lines.length > 0 ? (
          lines.map((line) => <LogLineRow key={line.id} text={line.text} />)
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
