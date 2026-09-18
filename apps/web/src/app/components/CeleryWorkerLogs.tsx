import { openCeleryLogStream, type ServiceLogConnectionState } from '@slideops/api-client';
import { Button, Text, cn } from '@slideops/design-system';
import { Clock, RefreshCw, Search, Trash2, WrapText } from '@slideops/icons';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ansiSegmentStyle, parseAnsiLine } from './ansi';
import { CopyButton } from './CopyButton';
import { TerminalSurface } from './TerminalSurface';

/*
 * A Celery worker's live output: its systemd journal, followed.
 *
 * This is the same live-tail contract every other log view in SlideOps
 * already carries -- recent history once, then every new line as the
 * worker prints it, over a websocket that reconnects on its own -- pointed
 * at the worker's own stream instead of a Service's or a container's, and
 * now with the same search, arrival-time, wrapping, and severity-tinting
 * parity DockerContainerLogs already has: none of these edit, reorder, or
 * omit what the worker actually printed, they only draw around it.
 *
 * There is no "diagnostic" frame here the way a container's stream has one:
 * a systemd unit's journal has no container-replacement event to mark, so
 * every line this view ever shows is the worker's own output.
 */

interface LogLine {
  id: number;
  text: string;
  /** When this line reached the browser, or null for history that was
   * already printed before anybody was watching. */
  at: Date | null;
}

const MAX_LINES = 5000;
const NEAR_BOTTOM_PX = 32;

const STATE_LABEL: Record<ServiceLogConnectionState, string> = {
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  stopped: 'Stopped',
  disconnected: 'Disconnected',
  stream_ended: 'Stream ended',
};

const STATE_DOT: Record<ServiceLogConnectionState, string> = {
  connecting: 'bg-info',
  connected: 'bg-success',
  reconnecting: 'bg-warning',
  stopped: 'bg-ink-muted',
  disconnected: 'bg-danger',
  stream_ended: 'bg-ink-muted',
};

const STATE_TONE: Record<ServiceLogConnectionState, string> = {
  connecting: 'text-info',
  connected: 'text-success',
  reconnecting: 'text-warning',
  stopped: 'text-ink-muted',
  disconnected: 'text-danger',
  stream_ended: 'text-ink-muted',
};

/**
 * Lines that read like a failure, and lines that read like a caution.
 *
 * Presentation only, matching DockerContainerLogs' own reasoning: the worker
 * did not say "this is an error", these patterns are SlideOps recognising
 * words that usually mean one.
 */
const LOOKS_LIKE_ERROR = /\b(error|fatal|panic|exception|traceback|failed|failure)\b/i;
const LOOKS_LIKE_WARNING = /\b(warn|warning|deprecated)\b/i;

function toneFor(text: string): string | null {
  if (LOOKS_LIKE_ERROR.test(text)) {
    return 'border-l-2 border-danger pl-2';
  }
  if (LOOKS_LIKE_WARNING.test(text)) {
    return 'border-l-2 border-warning pl-2';
  }
  return null;
}

function ConnectionIndicator({ state }: { state: ServiceLogConnectionState }) {
  return (
    <span role="status" className="inline-flex items-center gap-1.5">
      <span className={cn('h-1.5 w-1.5 rounded-full', STATE_DOT[state])} aria-hidden />
      <Text variant="caption" className={cn('normal-case tracking-normal', STATE_TONE[state])}>
        {STATE_LABEL[state]}
      </Text>
    </span>
  );
}

/**
 * A run of text with every occurrence of the query marked. The marks wrap
 * the same characters that were already there; nothing is inserted into or
 * removed from the line, so a highlighted line copies back identical to an
 * unhighlighted one.
 */
function marked(text: string, query: string, keyPrefix: string): ReactNode {
  if (!query) {
    return text;
  }
  const needle = query.toLowerCase();
  const haystack = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let found = haystack.indexOf(needle, cursor);
  while (found !== -1) {
    if (found > cursor) {
      parts.push(text.slice(cursor, found));
    }
    parts.push(
      <mark key={`${keyPrefix}-${found}`} className="rounded-sm bg-warning/30 text-ink">
        {text.slice(found, found + query.length)}
      </mark>,
    );
    cursor = found + query.length;
    found = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return parts;
}

/** The arrival-time gutter. History has no arrival time, so it shows a dash. */
function ArrivalTime({ at }: { at: Date | null }) {
  return (
    <span className="mr-2 inline-block w-[4.5rem] shrink-0 select-none text-right text-ink-muted">
      {at ? at.toLocaleTimeString([], { hour12: false }) : '--'}
    </span>
  );
}

function LogLineRow({
  line,
  wrap,
  showTimes,
  query,
}: {
  line: LogLine;
  wrap: boolean;
  showTimes: boolean;
  query: string;
}) {
  const segments = parseAnsiLine(line.text);
  const tone = toneFor(line.text);

  return (
    <div className={cn('flex', tone ?? '')}>
      {showTimes ? <ArrivalTime at={line.at} /> : null}
      <span className={cn('min-w-0 flex-1', wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre')}>
        {segments.map((segment, index) => (
          <span key={index} style={ansiSegmentStyle(segment.style)}>
            {marked(segment.text, query, `${line.id}-${index}`)}
          </span>
        ))}
        {segments.length === 0 ? ' ' : null}
      </span>
    </div>
  );
}

export interface CeleryWorkerLogsProps {
  serviceId: string;
  /** The worker's configured working directory, which is how the backend
   * resolves which systemd unit to follow -- the same identifier every
   * lifecycle Capability uses. */
  workingDirectory: string;
}

/** The Celery worker's own live journal, on the Service's Capability page. */
export function CeleryWorkerLogs({ serviceId, workingDirectory }: CeleryWorkerLogsProps) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [state, setState] = useState<ServiceLogConnectionState>('connecting');
  const [detail, setDetail] = useState<string | null>(null);
  const [following, setFollowing] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [showTimes, setShowTimes] = useState(false);
  const [query, setQuery] = useState('');
  const [generation, setGeneration] = useState(0);

  const seqRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const receivedHistoryRef = useRef(false);

  const append = (text: string) => {
    setLines((current) => {
      const next = current.concat({ id: seqRef.current++, text, at: new Date() });
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  };

  useEffect(() => {
    setLines([]);
    seqRef.current = 0;
    receivedHistoryRef.current = false;
    setState('connecting');
    setDetail(null);
  }, [serviceId, workingDirectory]);

  useEffect(() => {
    const handle = openCeleryLogStream({
      serviceId,
      workingDirectory,
      onHistory: (history) => {
        if (receivedHistoryRef.current) {
          return;
        }
        receivedHistoryRef.current = true;
        setLines((current) =>
          current.concat(
            history.split('\n').map((text) => ({ id: seqRef.current++, text, at: null })),
          ),
        );
      },
      onLine: append,
      onStateChange: (nextState, nextDetail) => {
        setState(nextState);
        setDetail(nextDetail ?? null);
      },
    });
    return () => handle.close();
  }, [serviceId, workingDirectory, generation]);

  const shown = useMemo(() => {
    if (!query) {
      return lines;
    }
    const needle = query.toLowerCase();
    return lines.filter((line) => line.text.toLowerCase().includes(needle));
  }, [lines, query]);

  useLayoutEffect(() => {
    if (!following) {
      return;
    }
    const element = contentRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [shown, following]);

  const handleScroll = () => {
    const element = contentRef.current;
    if (!element) {
      return;
    }
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    setFollowing(distance <= NEAR_BOTTOM_PX);
  };

  // Exactly what arrived, in the order it arrived, unfiltered and unmarked --
  // an Operator pasting this into an incident thread wants the log, not this
  // view's reading of it, and not only the lines that happened to match a
  // search.
  const fullText = useMemo(() => lines.map((line) => line.text).join('\n'), [lines]);

  return (
    <TerminalSurface
      label="the worker log"
      expanded={expanded}
      onExpandedChange={setExpanded}
      contentRef={contentRef}
      onContentScroll={handleScroll}
      contentRole="log"
      contentLabel="Live output from this Celery worker"
      scrolls
      resizable
      contentClassName="min-h-32 font-mono text-xs leading-relaxed text-ink"
      toolbar={
        <span className="flex flex-wrap items-center gap-3">
          <Text variant="body-sm" tone="secondary">
            Live output from this worker&apos;s own journal.
          </Text>
          <ConnectionIndicator state={state} />
          <label className="flex items-center gap-1.5">
            <Search width={13} height={13} className="text-ink-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search these logs"
              placeholder="Search these logs"
              className="h-8 w-44 rounded-md border border-border bg-surface px-2 text-xs text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
          {query ? (
            <Text variant="caption" tone="secondary" className="normal-case tracking-normal">
              {shown.length} of {lines.length} lines match
            </Text>
          ) : null}
        </span>
      }
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFollowing((was) => !was)}
            aria-pressed={following}
            title={following ? 'Stop following. Lines keep arriving underneath.' : 'Follow new output again'}
          >
            {following ? 'Pause' : 'Follow'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTimes((was) => !was)}
            aria-pressed={showTimes}
            aria-label={showTimes ? 'Hide arrival times' : 'Show arrival times'}
            title="The time each line reached SlideOps, which is not a clock the worker set"
          >
            <Clock width={14} height={14} aria-hidden />
            Times
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWrap((was) => !was)}
            aria-pressed={wrap}
            aria-label={wrap ? 'Stop wrapping long lines' : 'Wrap long lines'}
            title={wrap ? 'Stop wrapping long lines' : 'Wrap long lines'}
          >
            <WrapText width={14} height={14} aria-hidden />
            Wrap
          </Button>
          <CopyButton value={fullText} label="the worker log" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLines([])}
            aria-label="Clear what is on screen"
            title="Clears this view only. Nothing is deleted on the server."
          >
            <Trash2 width={14} height={14} aria-hidden />
            Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setGeneration((value) => value + 1)}>
            <RefreshCw width={14} height={14} aria-hidden />
            Reconnect
          </Button>
        </>
      }
      caption={
        <Text variant="body-sm" tone="secondary">
          Nothing here changes the log. Lines that read like errors or warnings are tinted, which is
          SlideOps recognising the words, not the worker labelling them. A network blip reconnects and
          keeps following on its own.
        </Text>
      }
      notice={
        state === 'disconnected' && detail ? (
          <p role="alert" className="text-sm text-danger">
            {detail}
          </p>
        ) : null
      }
      footer={
        !following ? (
          <button
            type="button"
            onClick={() => setFollowing(true)}
            className="self-end text-xs text-ink-muted underline decoration-dotted underline-offset-2 hover:text-ink"
          >
            Following is paused. Jump to latest.
          </button>
        ) : null
      }
    >
      {shown.length > 0 ? (
        shown.map((line) => (
          <LogLineRow key={line.id} line={line} wrap={wrap} showTimes={showTimes} query={query} />
        ))
      ) : (
        <Text variant="body-sm" tone="secondary">
          {query && lines.length > 0
            ? 'No line on screen contains that. Clearing the search shows everything again.'
            : state === 'connecting'
              ? 'Reading recent output'
              : 'This worker has printed nothing yet.'}
        </Text>
      )}
    </TerminalSurface>
  );
}
