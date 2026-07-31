import {
  ApiError,
  createOperation,
  downloadCapabilityAction,
  listCapabilityActions,
  runCapabilityAction,
  uploadToNode,
  type ActionTable,
  type CapabilityAction,
  type StagedUpload,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { Download, RefreshCw, Upload } from '@slideops/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  // Downloading reports like everything else here. It used to be a bare anchor,
  // so a refused export navigated the tab to a page of JSON instead of saying
  // what was wrong, which is indistinguishable from the button doing nothing.
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    setDownloaded(null);
    try {
      await downloadCapabilityAction(capabilityKey, action.key, {
        node_id: nodeId,
        service_id: serviceId,
        parameters: values,
      });
      setDownloaded('Saved to your downloads.');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'That export could not be produced. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

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
          <Button size="sm" variant="secondary" disabled={busy || missing} onClick={download}>
            <Download width={15} height={15} aria-hidden />
            {busy ? 'Preparing' : 'Download'}
          </Button>
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
      {downloaded ? (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          {downloaded}
        </p>
      ) : null}
      {result ? <div className="mt-3">{<ResultTable table={result} />}</div> : null}
    </div>
  );
}

/**
 * Restoring a database from a dump you upload.
 *
 * Two steps on purpose. The upload puts the file on the server and changes
 * nothing; the restore is an Operation with a plan to read and approve. A file
 * cannot travel as an Operation parameter, and a destructive change should not
 * happen without somebody seeing what it will destroy, so the split is what makes
 * both possible.
 *
 * The size the server measured is shown before anything else happens, because a
 * truncated upload restored as though it were whole is the failure that only
 * shows up much later.
 */
function RestoreFromUpload({
  nodeId,
  projectId,
  database,
}: {
  nodeId: string;
  projectId?: string;
  database?: string;
}) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState(database ?? '');
  const [staged, setStaged] = useState<StagedUpload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStaged(await uploadToNode(nodeId, file));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That upload did not complete.');
    } finally {
      setBusy(false);
    }
  };

  const planRestore = async () => {
    if (!staged || !target.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const operation = await createOperation({
        node_id: nodeId,
        project_id: projectId,
        capability_key: 'restore-postgresql',
        parameters: { database: target.trim(), upload_id: staged.id },
      });
      // Straight to the Operation, because nothing has happened yet: it is waiting
      // for its plan to be read and approved.
      navigate(`/app/operations/${operation.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That could not be prepared.');
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-border py-4 last:border-b-0">
      <Text variant="body-sm" className="font-medium">
        Restore from a dump
      </Text>
      <Text variant="body-sm" tone="secondary" className="mt-1 block max-w-2xl">
        Upload a SQL dump, then approve the restore. Uploading changes nothing: the database is
        untouched until you have read the plan and agreed to it. A copy of what is there now is
        taken first, so it can be put back.
      </Text>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-muted">Dump file</span>
          <input
            type="file"
            accept=".sql,.dump,text/plain,application/octet-stream"
            aria-label="Dump file"
            className="text-sm text-ink file:mr-2 file:h-9 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:text-sm file:text-ink"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setStaged(null);
            }}
          />
        </label>
        <Button size="sm" variant="secondary" disabled={!file || busy} onClick={send}>
          <Upload width={15} height={15} aria-hidden />
          {busy && !staged ? 'Uploading' : 'Upload'}
        </Button>
      </div>

      {staged ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Text variant="body-sm" tone="secondary" className="w-full">
            {staged.bytes.toLocaleString()} bytes arrived on the server. Check that against the file
            you meant to send before restoring it.
          </Text>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-muted">Restore into</span>
            <input
              className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink"
              aria-label="Restore into"
              placeholder="app"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </label>
          <Button
            size="sm"
            variant="danger"
            disabled={busy || !target.trim()}
            onClick={planRestore}
          >
            Plan the restore
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
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
  projectId,
  scopedDatabase,
  installed,
}: {
  capabilityKey: string;
  nodeId: string;
  /** The Project a restore Operation belongs to, since it is a Plugin Capability. */
  projectId?: string;
  /** Prefills the restore target on a Service page, where it is already known. */
  scopedDatabase?: string;
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
      collapsible
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
          {capabilityKey === 'install-postgresql' ? (
            <RestoreFromUpload nodeId={nodeId} projectId={projectId} database={scopedDatabase} />
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}
