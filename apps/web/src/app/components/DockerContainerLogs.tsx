import { openDockerContainerLogStream, type ServiceLogConnectionState } from '@slideops/api-client';
import { Button, Text, cn } from '@slideops/design-system';
import { Clock, RefreshCw, Search, Trash2, WrapText } from '@slideops/icons';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ansiSegmentStyle, parseAnsiLine } from './ansi';
import { CopyButton } from './CopyButton';
import { TerminalSurface } from './TerminalSurface';

/*
 * One container's live output.
 *
 * The stream is `docker logs --follow` on the Node, carried over the same
 * websocket a Service's logs already use: recent history once, then every new
 * line as the container prints it. Nothing here polls and nothing here refetches.
 *
 * The rule that governs every control below: none of them changes a single
 * character of what the container printed. Wrapping, search, the arrival-time
 * gutter and the tint on lines that look like failures are all things this view
 * draws around the text, never edits into it. Copy hands back the lines exactly
 * as they arrived, in the order they arrived, so what an Operator pastes into an
 * incident thread is the log and not this view's reading of it.
 *
 * Following and the stream are separate. Pausing stops the view chasing the
 * bottom; it does not stop the container, does not stop the socket, and does not
 * drop a line. Lines keep arriving underneath while an Operator reads something
 * further up, which is the whole reason to pause in the first place.
 */

interface LogEntry {
  id: number;
  // "line" is the container's own output; "diagnostic" is a marker about the
  // stream itself, shown inline but never mistaken for something it printed.
  kind: 'line' | 'diagnostic';
  text: string;
  /**
   * When this line reached the browser, or null for the history that was
   * already printed before anybody was watching.
   *
   * Deliberately not called a timestamp. Docker's log stream carries no clock
   * unless it was asked for one, so the only time SlideOps can honestly put
   * beside a line is the time it arrived here.
   */
  at: Date | null;
}

// Capped so a tab left open for hours does not grow the page without bound. An
// Operator debugging live wants the last several thousand lines, not the whole
// history of a long running process.
const MAX_LINES = 5000;
// How close to the bottom counts as being at the bottom. Exact equality drops
// out of following on the first sub-pixel layout jitter.
const NEAR_BOTTOM_PX = 32;

const STATE_LABEL: Record<ServiceLogConnectionState, string> = {
  connecting: 'Connecting',
  connected: 'Connected',
  reconnecting: 'Reconnecting',
  stopped: 'Container stopped',
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

/**
 * Lines that read like a failure, and lines that read like a caution.
 *
 * This is presentation and nothing more. The container did not say "this is an
 * error"; these patterns are SlideOps recognising words that usually mean one,
 * and the caption under the toolbar says so. Nothing is hidden, reordered or
 * rewritten on the strength of a match.
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

/** The connection state, as a dot and a word. */
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
 * A run of text with every occurrence of the query marked.
 *
 * The marks wrap the same characters that were already there; nothing is
 * inserted into or removed from the line, so a highlighted line copies back
 * identical to an unhighlighted one.
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

function LogEntryRow({
  entry,
  wrap,
  showTimes,
  query,
}: {
  entry: LogEntry;
  wrap: boolean;
  showTimes: boolean;
  query: string;
}) {
  if (entry.kind === 'diagnostic') {
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
  const tone = toneFor(entry.text);

  return (
    <div className={cn('flex', tone ?? '')}>
      {showTimes ? <ArrivalTime at={entry.at} /> : null}
      {/* Both settings preserve whitespace exactly: a log's indentation is often
          the only structure it has. Neither touches the ANSI colouring, which is
          already resolved into per-segment styles. */}
      <span className={cn('min-w-0 flex-1', wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre')}>
        {segments.map((segment, index) => (
          <span key={index} style={ansiSegmentStyle(segment.style)}>
            {marked(segment.text, query, `${entry.id}-${index}`)}
          </span>
        ))}
        {segments.length === 0 ? ' ' : null}
      </span>
    </div>
  );
}

export interface DockerContainerLogsProps {
  nodeId: string;
  /** The container's id or name, as the daemon knows it. */
  containerRef: string;
  /** What to call the container in the copy around the log. */
  containerName: string;
}

/** The Logs tab: the container's own output, live, with nothing rewritten. */
export function DockerContainerLogs({
  nodeId,
  containerRef,
  containerName,
}: DockerContainerLogsProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [state, setState] = useState<ServiceLogConnectionState>('connecting');
  const [detail, setDetail] = useState<string | null>(null);
  const [following, setFollowing] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [showTimes, setShowTimes] = useState(false);
  const [query, setQuery] = useState('');
  // Bumped when the Operator reconnects, so the connect effect reruns without
  // the container changing and without the buffer being thrown away.
  const [generation, setGeneration] = useState(0);

  const seqRef = useRef(0);
  const containerElementRef = useRef<HTMLDivElement>(null);
  // The backend sends history again on every fresh connection, since each is a
  // new follow on its side. Applying it twice would stack the same recent lines
  // under themselves.
  const receivedHistoryRef = useRef(false);

  const append = (kind: LogEntry['kind'], text: string) => {
    setEntries((current) => {
      const next = current.concat({ id: seqRef.current++, kind, text, at: new Date() });
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
  };

  // Resets only when the Operator moves to a different container. A reconnect,
  // a restart or the socket dropping must never clear the buffer: the moment
  // the scrollback matters most is the moment something crashed.
  useEffect(() => {
    setEntries([]);
    seqRef.current = 0;
    receivedHistoryRef.current = false;
    setState('connecting');
    setDetail(null);
  }, [nodeId, containerRef]);

  useEffect(() => {
    const handle = openDockerContainerLogStream({
      nodeId,
      containerRef,
      onHistory: (history) => {
        if (receivedHistoryRef.current) {
          return;
        }
        receivedHistoryRef.current = true;
        setEntries((current) =>
          current.concat(
            history
              .split('\n')
              .map((text) => ({ id: seqRef.current++, kind: 'line' as const, text, at: null })),
          ),
        );
      },
      onLine: (line) => append('line', line),
      onDiagnostic: (message) => append('diagnostic', message),
      onStateChange: (nextState, nextDetail) => {
        setState(nextState);
        setDetail(nextDetail ?? null);
      },
    });
    return () => handle.close();
  }, [nodeId, containerRef, generation]);

  const shown = useMemo(() => {
    if (!query) {
      return entries;
    }
    const needle = query.toLowerCase();
    return entries.filter((entry) => entry.text.toLowerCase().includes(needle));
  }, [entries, query]);

  // Follows the bottom only while following is on: an Operator who scrolled up
  // to read something must never be yanked back down by the next line.
  useLayoutEffect(() => {
    if (!following) {
      return;
    }
    const element = containerElementRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [shown, following]);

  const handleScroll = () => {
    const element = containerElementRef.current;
    if (!element) {
      return;
    }
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    setFollowing(distance <= NEAR_BOTTOM_PX);
  };

  // Exactly what arrived, in the order it arrived, unfiltered and unmarked. An
  // Operator pasting this into a ticket wants the log, not this view's reading
  // of it, and not only the lines that happened to match a search.
  const fullText = useMemo(() => entries.map((entry) => entry.text).join('\n'), [entries]);

  return (
    <TerminalSurface
      label="the container log"
      expanded={expanded}
      onExpandedChange={setExpanded}
      contentRef={containerElementRef}
      onContentScroll={handleScroll}
      contentRole="log"
      contentLabel={`Live output from ${containerName}`}
      scrolls
      resizable
      contentClassName="min-h-32 font-mono text-xs leading-relaxed text-ink"
      toolbar={
        <span className="flex flex-wrap items-center gap-3">
          <Text variant="body-sm" tone="secondary">
            Live output from {containerName}.
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
              {shown.length} of {entries.length} lines match
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
            title={
              following
                ? 'Stop following. Lines keep arriving; the view stops chasing them.'
                : 'Follow new output again'
            }
          >
            {following ? 'Pause' : 'Follow'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTimes((was) => !was)}
            aria-pressed={showTimes}
            aria-label={showTimes ? 'Hide arrival times' : 'Show arrival times'}
            title="The time each line reached SlideOps, which is not a clock the container set"
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
          <CopyButton value={fullText} label="the container log" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEntries([])}
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
          SlideOps recognising the words, not the container labelling them. Clearing empties this
          view and leaves the container's own log untouched.
        </Text>
      }
      notice={
        <>
          {state === 'disconnected' && detail ? (
            <p role="alert" className="text-sm text-danger">
              {detail}
            </p>
          ) : null}
          {state === 'stopped' ? (
            <p className="text-sm text-ink-muted">
              {detail ?? `${containerName} is not running.`} Watching for it to start again.
            </p>
          ) : null}
        </>
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
        shown.map((entry) => (
          <LogEntryRow
            key={entry.id}
            entry={entry}
            wrap={wrap}
            showTimes={showTimes}
            query={query}
          />
        ))
      ) : (
        <Text variant="body-sm" tone="secondary">
          {query && entries.length > 0
            ? 'No line on screen contains that. Clearing the search shows everything again.'
            : state === 'connecting'
              ? 'Reading recent output'
              : 'This container has printed nothing yet.'}
        </Text>
      )}
    </TerminalSurface>
  );
}
