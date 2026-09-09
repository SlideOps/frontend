import {
  ApiError,
  applyDockerComposeFile,
  diffDockerComposeFile,
  getDockerComposeFile,
  refusalExplanation,
  validateDockerComposeFile,
  type DockerComposeDiff,
  type DockerComposeValidation,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { AlertTriangle, CheckCircle2, Database, GitBranch } from '@slideops/icons';
import { useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { composeApplyGate, summariseComposeDiff } from '../docker-compose-view';
import { useAsyncData } from '../hooks/useAsyncData';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';

/*
 * Editing the file a stack is built from.
 *
 * The order of the controls is the whole design: read, check, see what it would
 * do, and only then apply. Apply is unreachable until a diff for this exact
 * text has come back, because "I edited the file and pressed the button" is how
 * a production database gets deleted by somebody who meant to change a port.
 *
 * Editing after a diff throws that diff away. It described text that no longer
 * exists, and a diff that is one keystroke out of date is worse than no diff:
 * it is a screen full of reassurance about a change nobody asked it about.
 *
 * The editor is a textarea. A syntax-highlighting code editor is a large
 * dependency to load into a desktop app so that a fifteen line YAML file can be
 * yellow, and the thing that actually catches a mistake here is Validate, which
 * asks the Node's own Compose to parse it.
 */

const EDITOR_ROWS = 18;

function messageFor(error: unknown): string {
  const refusal = refusalExplanation(error);
  if (refusal) {
    return refusal;
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'That did not run. Try again.';
}

export function DockerComposeEditor({
  nodeId,
  project,
  onApplied,
}: {
  nodeId: string;
  project: string;
  /** Told after a successful apply, so the surrounding stack view re-reads. */
  onApplied?: () => void;
}) {
  const canWrite = useCanWrite();
  const { state } = useAsyncData(
    (signal) => getDockerComposeFile(nodeId, project, signal),
    [nodeId, project],
  );

  if (state.status === 'loading') {
    return <Loading label="Reading the Compose file" />;
  }
  if (state.status === 'error') {
    return <ErrorNote error={state.error} />;
  }

  return (
    <ComposeFileForm
      key={state.data.path}
      nodeId={nodeId}
      project={project}
      path={state.data.path}
      original={state.data.content}
      canWrite={canWrite}
      onApplied={onApplied}
    />
  );
}

function ComposeFileForm({
  nodeId,
  project,
  path,
  original,
  canWrite,
  onApplied,
}: {
  nodeId: string;
  project: string;
  path: string;
  original: string;
  canWrite: boolean;
  onApplied?: () => void;
}) {
  const [content, setContent] = useState(original);
  const [busy, setBusy] = useState<'validate' | 'diff' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Both results are stored with the text they were computed from. Anything
  // else lets a stale answer describe text that is no longer on screen.
  const [validated, setValidated] = useState<{ content: string; result: DockerComposeValidation } | null>(null);
  const [diffed, setDiffed] = useState<{ content: string; result: DockerComposeDiff } | null>(null);
  // Ticked against one specific diff. Editing the file clears the diff, which
  // clears this with it, so a confirmation can never outlive what it agreed to.
  const [dataLossConfirmed, setDataLossConfirmed] = useState(false);

  const validation = validated?.content === content ? validated.result : null;
  const diff = diffed?.content === content ? diffed.result : null;
  const summary = diff ? summariseComposeDiff(diff) : null;
  const gate = composeApplyGate({ diff, dataLossConfirmed, canWrite });
  const knownInvalid = validation !== null && !validation.valid;

  const edit = (next: string) => {
    setContent(next);
    setApplied(false);
    setError(null);
    setDataLossConfirmed(false);
  };

  const validate = async () => {
    setBusy('validate');
    setError(null);
    try {
      const result = await validateDockerComposeFile(nodeId, project, content);
      setValidated({ content, result });
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(null);
    }
  };

  const runDiff = async () => {
    setBusy('diff');
    setError(null);
    setDataLossConfirmed(false);
    try {
      const result = await diffDockerComposeFile(nodeId, project, content);
      setDiffed({ content, result });
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    // Re-checked here and not only at the control, because this is the last
    // point before the request and the request is the irreversible part.
    const check = composeApplyGate({ diff, dataLossConfirmed, canWrite });
    if (!check.allowed) {
      setError(check.reason);
      setConfirmOpen(false);
      return;
    }
    setBusy('apply');
    setError(null);
    try {
      await applyDockerComposeFile(nodeId, project, {
        content,
        // Sent only when this diff removes a volume and the Operator said so.
        confirm_data_loss: summary?.destroysData ? true : undefined,
      });
      setApplied(true);
      setConfirmOpen(false);
      setDiffed(null);
      setDataLossConfirmed(false);
      onApplied?.();
    } catch (caught) {
      setError(messageFor(caught));
      setConfirmOpen(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Text variant="caption" tone="secondary" className="font-mono">
        {path}
      </Text>

      <label htmlFor={`compose-editor-${project}`} className="text-sm font-medium text-ink">
        Compose file
      </label>
      <textarea
        id={`compose-editor-${project}`}
        value={content}
        onChange={(event) => edit(event.target.value)}
        rows={EDITOR_ROWS}
        spellCheck={false}
        readOnly={!canWrite}
        aria-describedby={`compose-editor-hint-${project}`}
        className="w-full rounded-md border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      />
      <Text id={`compose-editor-hint-${project}`} variant="caption" tone="secondary">
        {canWrite
          ? 'Nothing here reaches the server until you apply. Check it, then see what it would change.'
          : 'Your role in this Workspace is read only, so this file can be read here but not changed.'}
      </Text>

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void validate()}>
            {busy === 'validate' ? 'Checking' : 'Validate'}
          </Button>
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void runDiff()}>
            <GitBranch width={14} height={14} aria-hidden />
            {busy === 'diff' ? 'Comparing' : 'Diff'}
          </Button>
          <Button
            size="sm"
            variant={summary?.destroysData ? 'danger' : 'primary'}
            disabled={busy !== null || !gate.allowed || knownInvalid}
            onClick={() => setConfirmOpen(true)}
          >
            {busy === 'apply' ? 'Applying' : 'Apply'}
          </Button>
        </div>
      ) : null}

      {canWrite && !gate.allowed ? (
        <Text variant="body-sm" tone="secondary">
          {gate.reason}
        </Text>
      ) : null}
      {knownInvalid ? (
        <Text variant="body-sm" tone="secondary">
          Fix the problems below before applying.
        </Text>
      ) : null}

      {validation ? <ValidationResult validation={validation} /> : null}
      {summary ? (
        <ComposeDiffView
          summary={summary}
          dataLossConfirmed={dataLossConfirmed}
          onConfirmDataLoss={setDataLossConfirmed}
          canWrite={canWrite}
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {applied ? (
        <Text variant="body-sm" tone="secondary">
          Applied. The stack now matches this file.
        </Text>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title={summary?.destroysData ? 'Apply, and delete data?' : `Apply this file to ${project}?`}
        confirmLabel={summary?.destroysData ? 'Apply and delete the volumes' : 'Apply'}
        confirmVariant={summary?.destroysData ? 'danger' : 'primary'}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={apply}
        description={
          summary?.destroysData ? (
            <span className="flex flex-col gap-2">
              <span>
                This writes the file and brings the stack to match it. It removes{' '}
                {summary.volumesRemoved.length} volumes and everything stored in them:{' '}
                <span className="font-mono">{summary.volumesRemoved.join(', ')}</span>.
              </span>
              <span>That data cannot be brought back, by this app or by anything else.</span>
            </span>
          ) : (
            <span>
              This writes the file and brings the stack to match it.{' '}
              {summary ? `${summary.changeCount} things change.` : ''} No volume is removed, so
              nothing stored is lost.
            </span>
          )
        }
      />
    </div>
  );
}

function ValidationResult({ validation }: { validation: DockerComposeValidation }) {
  if (validation.valid) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-border bg-subtle px-4 py-3">
        <CheckCircle2 width={18} height={18} className="mt-0.5 shrink-0 text-success" aria-hidden />
        <Text variant="body-sm">
          Compose parsed this file without complaint. That says it is well formed, not that it does
          what you meant.
        </Text>
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-md border border-danger bg-surface px-4 py-3">
      <Text variant="body-sm" className="font-medium">
        This file has {validation.errors.length} problems
      </Text>
      <ul className="mt-1 flex flex-col gap-1">
        {validation.errors.map((problem, index) => (
          <li key={`${problem.line ?? 'file'}-${index}`}>
            <Text variant="body-sm" tone="secondary">
              {problem.line !== undefined ? `Line ${problem.line}: ` : 'This file: '}
              {problem.message}
            </Text>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What applying would do, with the one part that destroys data pulled out in
 * front of everything else.
 *
 * The removed volumes get their own panel, their own colour and their own
 * acknowledgement, above the ordinary changes rather than among them. A list of
 * nine bullets in which the fourth deletes a database is a list somebody skims.
 */
function ComposeDiffView({
  summary,
  dataLossConfirmed,
  onConfirmDataLoss,
  canWrite,
}: {
  summary: ReturnType<typeof summariseComposeDiff>;
  dataLossConfirmed: boolean;
  onConfirmDataLoss: (confirmed: boolean) => void;
  canWrite: boolean;
}) {
  if (summary.empty) {
    return (
      <Text variant="body-sm" tone="secondary">
        Nothing changes. This file matches what is already running.
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {summary.destroysData ? (
        <div
          role="alert"
          className="rounded-md border-2 border-danger bg-surface px-4 py-3"
          data-testid="compose-data-loss"
        >
          <div className="flex items-start gap-3">
            <Database width={18} height={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
            <div className="flex flex-col gap-2">
              <Text variant="body-sm" className="font-medium">
                Applying this deletes {summary.volumesRemoved.length} volumes and everything stored
                in them
              </Text>
              <ul className="flex flex-col gap-0.5">
                {summary.volumesRemoved.map((volume) => (
                  <li key={volume} className="font-mono text-sm text-ink">
                    {volume}
                  </li>
                ))}
              </ul>
              <Text variant="body-sm" tone="secondary">
                Databases, uploads, anything a service wrote to one of these. It cannot be undone,
                and re-adding the volume to the file creates an empty one.
              </Text>
              {canWrite ? (
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={dataLossConfirmed}
                    onChange={(event) => onConfirmDataLoss(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  />
                  I understand this deletes the data in these volumes
                </label>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {summary.groups.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3">
          {!summary.destroysData ? (
            <div className="flex items-center gap-2">
              <AlertTriangle width={16} height={16} className="text-warning" aria-hidden />
              <Text variant="body-sm" className="font-medium">
                {summary.changeCount} things change. Nothing stored is lost.
              </Text>
            </div>
          ) : null}
          {summary.groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-0.5">
              <Text variant="body-sm" className="font-medium">
                {group.heading}
              </Text>
              <Text variant="caption" tone="secondary">
                {group.description}
              </Text>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {group.entries.map((entry) => (
                  <li key={entry} className="font-mono text-xs text-ink-muted">
                    {entry}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
