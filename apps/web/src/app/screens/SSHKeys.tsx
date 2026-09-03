import {
  ApiError,
  deleteSSHKey,
  importSSHKey,
  listSSHKeys,
  renameSSHKey,
  sshKeyUsage,
  type SSHKey,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { Fingerprint, Pencil, Plus, Trash2 } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** Import a new key into the library. */
function ImportForm({ onImported }: { onImported: (key: SSHKey) => void }) {
  const [name, setName] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const key = await importSSHKey({ name: name.trim(), private_key: privateKey });
      setName('');
      setPrivateKey('');
      onImported(key);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That key could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Plus width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Save a key</Text>
      </div>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field
          label="Name"
          placeholder="prod-deploy"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="new-ssh-key" className="text-sm font-medium text-ink">
            Private key
          </label>
          <textarea
            id="new-ssh-key"
            rows={6}
            spellCheck={false}
            autoComplete="off"
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            className={`resize-y py-2 font-mono ${inputClass}`}
            value={privateKey}
            onChange={(event) => setPrivateKey(event.target.value)}
          />
          <Text variant="body-sm" tone="secondary">
            Stored encrypted the moment it arrives. It is never shown again.
          </Text>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={saving || !name.trim() || !privateKey.trim()}>
            {saving ? 'Saving' : 'Save key'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** One saved key: its fingerprint, a rename control, and delete. */
function KeyRow({ sshKey, onRenamed, onDeleted }: { sshKey: SSHKey; onRenamed: (key: SSHKey) => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sshKey.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rename = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === sshKey.name) {
      setEditing(false);
      setName(sshKey.name);
      return;
    }
    setBusy(true);
    try {
      const updated = await renameSSHKey(sshKey.id, trimmed);
      onRenamed(updated);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That name could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const askDelete = async () => {
    try {
      setUsage(await sshKeyUsage(sshKey.id));
    } catch {
      setUsage(null);
    }
    setConfirmDelete(true);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteSSHKey(sshKey.id);
      onDeleted();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That key could not be removed.');
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
        <Fingerprint width={16} height={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              className={`h-8 ${inputClass}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
            <Button size="sm" onClick={rename} disabled={busy}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(sshKey.name);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Text variant="body-sm" className="font-medium">
            {sshKey.name}
          </Text>
        )}
        <Text variant="caption" tone="secondary" className="block font-mono">
          {sshKey.fingerprint}
        </Text>
        {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
      </div>
      {!editing ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Rename ${sshKey.name}`}
            className="rounded-md p-2 text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Pencil width={15} height={15} aria-hidden />
          </button>
          <button
            type="button"
            onClick={askDelete}
            aria-label={`Remove ${sshKey.name}`}
            className="rounded-md p-2 text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Trash2 width={15} height={15} aria-hidden />
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title={`Remove "${sshKey.name}"?`}
        description={
          usage && usage > 0
            ? `This name is used by ${usage} server${usage === 1 ? '' : 's'}. Removing it only removes the name from your library: those servers keep connecting exactly as before.`
            : 'This removes the name from your library. Nothing that used it is affected.'
        }
        confirmLabel="Remove"
        confirmVariant="danger"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/** The SSH key library: named, fingerprinted keys reusable across Nodes. */
export function SSHKeys() {
  const { state, reload } = useAsyncData((signal) => listSSHKeys(signal), []);

  return (
    <OperatorShell active="sshKeys">
      <PageHeader
        title="SSH Keys"
        description="Keys you have saved for reuse. Register or rotate a Node's credential by picking one instead of pasting it again."
        guidanceKey="sshKeys.overview"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-2">
          {state.status === 'loading' ? <Loading label="Loading your keys" /> : null}
          {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
          {state.status === 'ready' ? (
            state.data.length === 0 ? (
              <EmptyState
                icon={Fingerprint}
                title="No keys saved yet"
                description="Save a key once and pick it for any Node instead of pasting it again."
              />
            ) : (
              state.data.map((key) => (
                <KeyRow key={key.id} sshKey={key} onRenamed={() => reload()} onDeleted={() => reload()} />
              ))
            )
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Guidance for="sshKeys.import" />
          </div>
          <ImportForm onImported={() => reload()} />
        </div>
      </div>
    </OperatorShell>
  );
}
