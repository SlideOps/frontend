import {
  ApiError,
  createSnippet,
  deleteSnippet,
  listSnippets,
  updateSnippet,
  type Snippet,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { ListChecks, Pencil, Plus, Trash2 } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** Save a new command to the library. */
function SaveForm({ onSaved }: { onSaved: (snippet: Snippet) => void }) {
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const snippet = await createSnippet({ name: name.trim(), command });
      setName('');
      setCommand('');
      onSaved(snippet);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That snippet could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Plus width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Save a command</Text>
      </div>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field
          label="Name"
          placeholder="Tail app logs"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="new-snippet-command" className="text-sm font-medium text-ink">
            Command
          </label>
          <textarea
            id="new-snippet-command"
            rows={3}
            spellCheck={false}
            autoComplete="off"
            placeholder="tail -f /var/log/app.log"
            className={`resize-y py-2 font-mono ${inputClass}`}
            value={command}
            onChange={(event) => setCommand(event.target.value)}
          />
          <Text variant="body-sm" tone="secondary">
            Typed into the terminal exactly as written. It is never run for you.
          </Text>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={saving || !name.trim() || !command.trim()}>
            {saving ? 'Saving' : 'Save snippet'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** One saved snippet: its command, an inline editor, and delete. */
function SnippetRow({
  snippet,
  onSaved,
  onDeleted,
}: {
  snippet: Snippet;
  onSaved: (snippet: Snippet) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(snippet.name);
  const [command, setCommand] = useState(snippet.command);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !command.trim() || (trimmedName === snippet.name && command === snippet.command)) {
      setEditing(false);
      setName(snippet.name);
      setCommand(snippet.command);
      return;
    }
    setBusy(true);
    try {
      const updated = await updateSnippet(snippet.id, { name: trimmedName, command });
      onSaved(updated);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That snippet could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteSnippet(snippet.id);
      onDeleted();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That snippet could not be removed.');
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-surface px-4 py-3">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
        <ListChecks width={16} height={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              className={`h-8 ${inputClass}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
            <textarea
              rows={2}
              spellCheck={false}
              className={`resize-y py-2 font-mono ${inputClass}`}
              value={command}
              onChange={(event) => setCommand(event.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={save} disabled={busy}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setName(snippet.name);
                  setCommand(snippet.command);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Text variant="body-sm" className="font-medium">
              {snippet.name}
            </Text>
            <Text variant="caption" tone="secondary" className="block break-all font-mono">
              {snippet.command}
            </Text>
          </>
        )}
        {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
      </div>
      {!editing ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${snippet.name}`}
            className="rounded-md p-2 text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Pencil width={15} height={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Remove ${snippet.name}`}
            className="rounded-md p-2 text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Trash2 width={15} height={15} aria-hidden />
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title={`Remove "${snippet.name}"?`}
        description="This removes the snippet from your library. It cannot be undone."
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/** The snippet library: commands an Operator can pick into any open terminal. */
export function Snippets() {
  const { state, reload } = useAsyncData((signal) => listSnippets(signal), []);

  return (
    <OperatorShell active="snippets">
      <PageHeader
        title="Snippets"
        description="Commands you have saved for reuse. Pick one from any open terminal instead of retyping it -- it is typed in, never run for you."
        guidanceKey="snippets.overview"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-2">
          {state.status === 'loading' ? <Loading label="Loading your snippets" /> : null}
          {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
          {state.status === 'ready' ? (
            state.data.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No snippets saved yet"
                description="Save a command once and pick it from any terminal instead of typing it again."
              />
            ) : (
              state.data.map((snippet) => (
                <SnippetRow
                  key={snippet.id}
                  snippet={snippet}
                  onSaved={() => reload()}
                  onDeleted={() => reload()}
                />
              ))
            )
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Guidance for="snippets.save" />
          </div>
          <SaveForm onSaved={() => reload()} />
        </div>
      </div>
    </OperatorShell>
  );
}
