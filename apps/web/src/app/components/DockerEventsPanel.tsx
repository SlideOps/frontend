import {
  openDockerEventStream,
  type DockerEvent,
  type DockerEventConnectionState,
} from '@slideops/api-client';
import { Button, Card, Text, cn } from '@slideops/design-system';
import { Activity, Pause, Play, RefreshCw } from '@slideops/icons';
import { SearchBar, Toolbar } from '@slideops/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

/*
 * What Docker on this server is doing, as it does it.
 *
 * One websocket, every event the daemon reports, newest at the top. There is
 * no history: the daemon streams what happens from the moment something
 * listens, so this panel shows what has happened since it was opened and says
 * so, rather than looking like an empty log of a quiet server.
 *
 * Docker's own words are kept throughout. A "die" event says die, not
 * "stopped"; a "health_status: unhealthy" action says exactly that. Renaming
 * Docker's vocabulary would make this page disagree with `docker events` in a
 * terminal, and an Operator comparing the two would have to work out which one
 * to believe. The rule is: report, never rephrase.
 *
 * A stream error is terminal and looks like it. The backend sends one when the
 * daemon cannot be followed at all, and this stops, says why, and offers to
 * try again. A live view that quietly stops updating is the worst outcome
 * available here, because a still page and a quiet server look identical.
 */

/**
 * How many events are kept.
 *
 * A busy server with a Compose stack restarting can emit hundreds of events a
 * minute, and a tab left open all afternoon must not grow without bound. Five
 * hundred covers what an Operator is scrolling back through while watching
 * something happen; anything older belongs to History, not to a live view.
 */
const MAX_EVENTS = 500;

/**
 * How many attributes one row shows before it stops.
 *
 * Docker attaches every one of a container's labels to some events, which for
 * a Compose workload is a dozen entries nobody reads. Six is enough for the
 * ones that carry meaning (an exit code, a signal, an image) while keeping a
 * row a row. The rest stay reachable through the row's title.
 */
const MAX_ATTRIBUTES_SHOWN = 6;

/**
 * The attributes worth putting first, in this order.
 *
 * These are the ones that answer the question the event raises: a container
 * died, with what code and what signal, running what image. Everything else is
 * shown after them, alphabetically, so the same event always reads the same
 * way.
 */
const NOTABLE_ATTRIBUTES = [
  'exitCode',
  'signal',
  'image',
  'health_status',
  'destination',
  'driver',
  'container',
];

const STATE_LABEL: Record<DockerEventConnectionState, string> = {
  connecting: 'Connecting',
  connected: 'Live',
  reconnecting: 'Reconnecting',
  stopped: 'Stopped',
};

const STATE_TONE: Record<DockerEventConnectionState, string> = {
  connecting: 'text-info',
  connected: 'text-success',
  reconnecting: 'text-warning',
  stopped: 'text-danger',
};

const STATE_DOT: Record<DockerEventConnectionState, string> = {
  connecting: 'bg-info',
  connected: 'bg-success',
  reconnecting: 'bg-warning',
  stopped: 'bg-danger',
};

const selectClass =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** The connection state, as the small dot and word every live view here uses. */
function ConnectionIndicator({ state }: { state: DockerEventConnectionState }) {
  return (
    <span role="status" className="inline-flex items-center gap-1.5">
      <span className={cn('h-1.5 w-1.5 rounded-full', STATE_DOT[state])} aria-hidden />
      <Text variant="caption" className={STATE_TONE[state]}>
        {STATE_LABEL[state]}
      </Text>
    </span>
  );
}

/** A labelled dropdown, with a visible label a screen reader also reads. */
function Picker({
  label,
  value,
  options,
  anyLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  anyLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <select
        aria-label={label}
        className={selectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * One event with the key it is rendered under.
 *
 * Docker sends no id of its own, and two identical events a second apart are a
 * real thing that really happens, so the key is arrival order rather than
 * anything about the event's content.
 */
interface EventEntry {
  key: number;
  event: DockerEvent;
}

/** The clock time, in the reader's own timezone, with the full instant behind it. */
function timeText(at: string): { short: string; full: string } {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) {
    // An unparseable timestamp is shown as Docker sent it. Substituting "now"
    // would be inventing the one field the whole row is ordered by.
    return { short: at, full: at };
  }
  return { short: when.toLocaleTimeString(), full: when.toLocaleString() };
}

/** The attributes worth showing on the row, notable ones first. */
function shownAttributes(event: DockerEvent): { key: string; value: string }[] {
  const entries = Object.entries(event.attributes ?? {}).filter(
    // Docker repeats the actor's name in the attributes; the row already shows
    // it, and printing it twice crowds out something that says more.
    ([key, value]) => !(key === 'name' && value === event.actor_name),
  );
  const notable = NOTABLE_ATTRIBUTES.flatMap((key) => {
    const found = entries.find(([candidate]) => candidate === key);
    return found ? [{ key: found[0], value: found[1] }] : [];
  });
  const rest = entries
    .filter(([key]) => !NOTABLE_ATTRIBUTES.includes(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ key, value }));
  return [...notable, ...rest];
}

/** Everything on an event a search should match. */
function eventHaystack(event: DockerEvent): string {
  const parts = [event.type, event.action, event.actor_name, event.actor_id];
  for (const [key, value] of Object.entries(event.attributes ?? {})) {
    parts.push(key, value);
  }
  return parts.join('\n').toLowerCase();
}

function EventRow({ event }: { event: DockerEvent }) {
  const time = timeText(event.at);
  const attributes = shownAttributes(event);
  const shown = attributes.slice(0, MAX_ATTRIBUTES_SHOWN);
  const hidden = attributes.length - shown.length;

  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border px-3 py-2 first:border-t-0">
      <time
        dateTime={event.at}
        title={time.full}
        className="shrink-0 font-mono text-xs text-ink-muted"
      >
        {time.short}
      </time>
      <span className="shrink-0 rounded-md bg-subtle px-1.5 py-0.5 font-mono text-xs text-ink-muted">
        {event.type}
      </span>
      {/* Docker's own action, unrenamed. */}
      <span className="shrink-0 font-mono text-xs font-medium text-ink">{event.action}</span>
      <span className="min-w-0 truncate text-sm text-ink" title={event.actor_id}>
        {event.actor_name || event.actor_id || '--'}
      </span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {shown.map((attribute) => (
          <span key={attribute.key} className="truncate font-mono text-xs text-ink-muted">
            {attribute.key}={attribute.value}
          </span>
        ))}
        {hidden > 0 ? (
          <span
            className="text-xs text-ink-muted"
            title={attributes.map((entry) => `${entry.key}=${entry.value}`).join('\n')}
          >
            +{hidden} more
          </span>
        ) : null}
      </span>
    </li>
  );
}

export interface DockerEventsPanelProps {
  /** The Node whose daemon to follow. */
  nodeId: string;
}

/**
 * Docker's own event stream for one server.
 *
 * Pausing holds new events rather than dropping them: an Operator who pauses to
 * read a line is not asking to lose everything that happens while they read it.
 * Resuming puts the held events back at the top, in order.
 */
export function DockerEventsPanel({ nodeId }: DockerEventsPanelProps) {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [state, setState] = useState<DockerEventConnectionState>('connecting');
  const [detail, setDetail] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [action, setAction] = useState('');
  // Bumped when the Operator asks to try a stopped stream again, so the effect
  // below reconnects without the Node itself having to change.
  const [generation, setGeneration] = useState(0);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const heldRef = useRef<EventEntry[]>([]);
  const sequenceRef = useRef(0);

  useEffect(() => {
    const handle = openDockerEventStream({
      nodeId,
      onEvent: (event) => {
        const entry: EventEntry = { key: sequenceRef.current++, event };
        if (pausedRef.current) {
          heldRef.current = [entry, ...heldRef.current].slice(0, MAX_EVENTS);
          setHeldCount(heldRef.current.length);
          return;
        }
        setEvents((current) => [entry, ...current].slice(0, MAX_EVENTS));
      },
      onStateChange: (next, why) => {
        setState(next);
        setDetail(why ?? null);
      },
    });
    return () => handle.close();
  }, [nodeId, generation]);

  const resume = () => {
    // Read out of the buffer before emptying it. A state updater runs at the
    // next render, by which point the ref would already have been cleared and
    // every held event would be dropped by the very control meant to release
    // them.
    const held = heldRef.current;
    heldRef.current = [];
    setEvents((current) => [...held, ...current].slice(0, MAX_EVENTS));
    setHeldCount(0);
    setPaused(false);
  };

  const retry = () => {
    setState('connecting');
    setDetail(null);
    setGeneration((value) => value + 1);
  };

  // The filter options are whatever has actually arrived. Docker's set of event
  // types is longer than what any one server produces, and offering types this
  // daemon has never emitted would be a list of filters that find nothing.
  const types = useMemo(
    () => Array.from(new Set(events.map((entry) => entry.event.type))).sort(),
    [events],
  );
  const actions = useMemo(
    () => Array.from(new Set(events.map((entry) => entry.event.action))).sort(),
    [events],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter(({ event }) => {
      if (type && event.type !== type) {
        return false;
      }
      if (action && event.action !== action) {
        return false;
      }
      return !needle || eventHaystack(event).includes(needle);
    });
  }, [events, query, type, action]);

  const filtering = query !== '' || type !== '' || action !== '';

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity width={18} height={18} className="text-brand" aria-hidden />
          <Text variant="h4">Live activity</Text>
          <ConnectionIndicator state={state} />
        </div>
        <div className="flex items-center gap-2">
          {paused ? (
            <Button variant="secondary" size="sm" onClick={resume}>
              <Play width={14} height={14} aria-hidden />
              Resume
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setPaused(true)}>
              <Pause width={14} height={14} aria-hidden />
              Pause
            </Button>
          )}
        </div>
      </div>

      <Text variant="body-sm" tone="secondary">
        Everything the Docker daemon on this server reports doing, in Docker's own words, from the
        moment this panel opened. Docker keeps no history of it, so nothing before that appears
        here.
      </Text>

      {/* The stream cannot continue, and says so where it cannot be missed. A
          live view that stops updating silently is indistinguishable from a
          server with nothing happening on it. */}
      {state === 'stopped' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-danger/40 bg-subtle px-3 py-2.5">
          <p role="alert" className="min-w-0 flex-1 text-sm text-danger">
            {detail ?? 'Docker events could not be streamed from this server.'}
          </p>
          <Button variant="secondary" size="sm" onClick={retry}>
            <RefreshCw width={14} height={14} aria-hidden />
            Try again
          </Button>
        </div>
      ) : null}

      {paused ? (
        <Text variant="body-sm" tone="secondary">
          Paused. {heldCount === 0 ? 'Nothing new has arrived yet.' : null}
          {heldCount > 0
            ? `${heldCount} ${heldCount === 1 ? 'event is' : 'events are'} held and will appear when you resume.`
            : null}
        </Text>
      ) : null}

      <Toolbar
        actions={
          <Text variant="body-sm" tone="secondary">
            {filtering ? `${shown.length} of ${events.length}` : `${events.length} events`}
          </Text>
        }
      >
        <SearchBar
          value={query}
          onChange={setQuery}
          label="Search events"
          placeholder="Name, id, image, exit code..."
          className="sm:max-w-xs"
        />
        <Picker label="Type" value={type} options={types} anyLabel="Any type" onChange={setType} />
        <Picker
          label="Action"
          value={action}
          options={actions}
          anyLabel="Any action"
          onChange={setAction}
        />
      </Toolbar>

      {shown.length > 0 ? (
        <ul className="max-h-96 overflow-y-auto rounded-md border border-border bg-surface">
          {shown.map((entry) => (
            <EventRow key={entry.key} event={entry.event} />
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-surface px-4 py-6">
          <Text variant="body-sm" tone="secondary">
            {events.length === 0
              ? 'Nothing has happened on this server since this panel opened. Starting, stopping or pulling anything will appear here as Docker reports it.'
              : 'No event matches what you are looking for.'}
          </Text>
        </div>
      )}
    </Card>
  );
}
