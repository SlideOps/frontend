import {
  ApiError,
  capabilityActionDownloadUrl,
  listCapabilityActions,
  runCapabilityAction,
  type ActionTable,
  type CapabilityAction,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { Download, RefreshCw } from '@slideops/icons';
import { useState } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { ErrorNote, Loading } from './Feedback';

/*
 * The management surface of a Capability that is already installed.
 *
 * A Capability's page described what it would do, in the past tense, forever.
 * Once a database was installed the page had nothing further to say: what is in
 * it, how big it is, how to get a copy of it, all lived outside the platform,
 * which meant reaching for ssh and psql and leaving no record behind.
 *
 * It is deliberately adaptive rather than a separate screen. Before a Capability
 * is installed there is nothing to manage and this renders nothing at all, so the
 * page stays the description it always was. Once it is installed the same page
 * becomes where the work happens, which is where somebody looking at a database
 * would think to look for it.
 *
 * Everything here is a read. Anything that changes a server is a Capability and
 * goes through the plan and approval it always has, so nothing on this surface
 * can alter anything without the lifecycle.
 */

/** One Action's result, kept per Action so opening one does not clear another. */
type Results = Record<string, ActionTable | undefined>;

function ResultTable({ table }: { table: ActionTable }) {
  if (table.rows.length === 0) {
    return (
      <Text variant="body-sm" tone="secondary">
        {table.empty ?? 'Nothing to show.'}
      </Text>
    );
  }
  return (
    // Its own scroll container: a wide table must not make the page scroll
    // sideways.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {table.columns.map((column) => (
              <th key={column} className="py-2 pr-4 font-medium text-ink-muted">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index} className="border-b border-border last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-2 pr-4 font-mono text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One Action: what it is, its inputs, and what it gives back. */
function ActionRow({
  capabilityKey,
  action,
  nodeId,
  serviceId,
  result,
  onResult,
}: {
  capabilityKey: string;
  action: CapabilityAction;
  nodeId: string;
  serviceId?: string;
  result?: ActionTable;
  onResult: (key: string, table: ActionTable | undefined) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = action.parameters.some(
    (parameter) => parameter.required && !(values[parameter.key] ?? '').trim(),
  );

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      onResult(
        action.key,
        await runCapabilityAction(capabilityKey, action.key, {
          node_id: nodeId,
          service_id: serviceId,
          parameters: values,
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That could not be read. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const downloadHref = capabilityActionDownloadUrl(capabilityKey, action.key, {
    node_id: nodeId,
    service_id: serviceId,
    parameters: values,
  });

  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <Text variant="body-sm" className="font-medium">
        {action.label}
      </Text>
      <Text variant="body-sm" tone="secondary" className="mt-1 block max-w-2xl">
        {action.description}
      </Text>

      {action.parameters.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {action.parameters.map((parameter) => (
            <label key={parameter.key} className="flex flex-col gap-1">
              <span className="text-xs text-ink-muted">{parameter.label}</span>
              <input
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink"
                placeholder={parameter.placeholder}
                value={values[parameter.key] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [parameter.key]: event.target.value }))
                }
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {action.produces === 'file' ? (
          // A plain anchor, not a fetch: the browser streams it to disk with its
          // own progress and never holds a whole database dump in the tab's
          // memory, which a dump larger than a gigabyte would not survive.
          <a
            href={missing ? undefined : downloadHref}
            aria-disabled={missing}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus${
              missing ? ' pointer-events-none opacity-50' : ''
            }`}
          >
            <Download width={15} height={15} aria-hidden />
            Download
          </a>
        ) : (
          <Button size="sm" variant="secondary" disabled={busy} onClick={run}>
            <RefreshCw
              width={15}
              height={15}
              className={busy ? 'animate-spin' : undefined}
              aria-hidden
            />
            {busy ? 'Reading' : result ? 'Read again' : 'Show'}
          </Button>
        )}
        {missing ? (
          <Text variant="caption" tone="secondary">
            Fill in the fields above first.
          </Text>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {result ? <div className="mt-3">{<ResultTable table={result} />}</div> : null}
    </div>
  );
}

/**
 * Management for an installed Capability, or nothing at all.
 *
 * Renders nothing when the Capability offers no Actions, or when it is not
 * installed here, so the page it sits on is unchanged for every Capability that
 * has nothing to manage.
 */
export function CapabilityManagement({
  capabilityKey,
  nodeId,
  serviceId,
  installed,
}: {
  capabilityKey: string;
  nodeId: string;
  /**
   * Narrows everything to one Service. A database server usually carries a
   * database per application, so a Service page that showed all of them is how
   * somebody acts on another application's data by picking the wrong row.
   */
  serviceId?: string;
  /** Whether this Capability's outcome is already in place on this Node. */
  installed: boolean;
}) {
  // Not fetched at all until there is something to manage. A hook cannot be
  // called conditionally, so the condition lives in the loader: asking what a
  // Capability offers before it is installed is a request whose answer is thrown
  // away, on a page an Operator may only be reading.
  const actions = useAsyncData(
    (signal) =>
      installed && nodeId ? listCapabilityActions(capabilityKey, signal) : Promise.resolve([]),
    [capabilityKey, installed, nodeId],
  );
  const [results, setResults] = useState<Results>({});

  // Nothing to manage, or nothing installed to manage yet. Either way this is
  // not the moment to put controls in front of somebody.
  if (!installed || !nodeId) {
    return null;
  }
  if (actions.state.status === 'ready' && actions.state.data.length === 0) {
    return null;
  }

  return (
    <Section
      title="Manage"
      description={
        serviceId
          ? 'Scoped to this Service: only what it actually uses is shown, so nothing here can reach another application on the same server. Nothing here changes anything either.'
          : 'This is installed on the selected server, so you can read what it holds and take a copy of it. Nothing here changes anything: every change is still a Capability you approve.'
      }
    >
      {actions.state.status === 'loading' ? <Loading label="Reading what this offers" /> : null}
      {actions.state.status === 'error' ? <ErrorNote error={actions.state.error} /> : null}
      {actions.state.status === 'ready' ? (
        <div className="flex flex-col">
          {actions.state.data.map((action) => (
            <ActionRow
              key={action.key}
              capabilityKey={capabilityKey}
              action={action}
              nodeId={nodeId}
              serviceId={serviceId}
              result={results[action.key]}
              onResult={(key, table) => setResults((current) => ({ ...current, [key]: table }))}
            />
          ))}
        </div>
      ) : null}
    </Section>
  );
}
