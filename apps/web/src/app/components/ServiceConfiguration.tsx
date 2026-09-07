import {
  ApiError,
  redeployService,
  updateServiceConfiguration,
  updateServiceEnvVar,
  type Service,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, Pencil, RefreshCw, Settings } from '@slideops/icons';
import { useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { RevealValue } from './RevealValue';
import { parseEnv, SECRET_PREFIX } from '../service-schema';

/**
 * What the API returns in place of a sealed value. The plaintext lives only in the
 * secret store, so this marker is all a read ever sees.
 */
const SEALED_MARKER = '[stored securely]';

/*
 * Editing a deployed Service's command and environment.
 *
 * Everything about a Service used to be fixed the moment it was deployed. An
 * Operator who forgot a variable, or whose database URL changed, had no way to
 * correct it and had to delete the Service and start again.
 *
 * A container bakes its command and environment in when it is created, so an edit
 * is not live until a redeploy. This says that plainly rather than saving and
 * letting the Operator assume it took effect.
 */

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * Render the Service's current environment back into the textarea form. A sealed
 * value cannot be read back, so its line carries the marker and an empty value:
 * the Operator can see the variable exists and retype it, which is the honest
 * thing to show when the value is genuinely unrecoverable.
 */
function envToText(service: Service): string {
  const entries = Object.entries(service.env ?? {});
  return entries
    .map(([key, value]) =>
      value === SEALED_MARKER ? `${SECRET_PREFIX}${key}=` : `${key}=${value}`,
    )
    .join('\n');
}

/**
 * Rewrite one variable's line in the textarea text, so the full editor and the
 * per-variable editor never disagree about what is stored.
 *
 * Without this, saving one variable inline and then opening the full editor would
 * show the value from before that save. Because the full editor replaces the
 * whole set, saving that stale text would quietly undo the inline edit.
 *
 * A sealed line is rewritten empty rather than with what was typed: the textarea
 * form has never held a secret's plaintext and must not start now.
 */
function withEnvLine(text: string, key: string, value: string, secret: boolean): string {
  const replacement = secret ? `${SECRET_PREFIX}${key}=` : `${key}=${value}`;
  let replaced = false;
  const lines = text.split('\n').map((line) => {
    const trimmed = line.trim();
    const bare = trimmed.toLowerCase().startsWith(SECRET_PREFIX)
      ? trimmed.slice(SECRET_PREFIX.length).trim()
      : trimmed;
    const eq = bare.indexOf('=');
    if (eq <= 0 || bare.slice(0, eq).trim() !== key) {
      return line;
    }
    replaced = true;
    return replacement;
  });
  return replaced ? lines.join('\n') : [...lines, replacement].filter(Boolean).join('\n');
}

/**
 * One variable's row: the value, and for an Operator who may write, an Edit that
 * turns this row alone into an editor.
 *
 * Editing one variable at a time is the safe way to change one variable. The full
 * editor sends the entire set, so a slip anywhere in that text can remove a
 * variable the Operator never meant to touch; here the request names one key and
 * carries one value, and nothing else can be lost by omission.
 */
function EnvRow({
  serviceId,
  envKey,
  value,
  canWrite,
  onSaved,
}: {
  serviceId: string;
  envKey: string;
  value: string;
  canWrite: boolean;
  onSaved: (key: string, value: string, secret: boolean) => void;
}) {
  const sealed = value === SEALED_MARKER;
  // A sealed value has no plaintext to load, so the box starts empty rather than
  // seeded with the marker: the marker is not the value, and saving it would
  // store the words "[stored securely]" as the variable.
  const [draft, setDraft] = useState(sealed ? '' : value);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setDraft(sealed ? '' : value);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(sealed ? '' : value);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    // An empty box on a sealed variable means "leave it alone", which is what the
    // placeholder promises. Sending the empty string instead would destroy the
    // secret, and nobody opens an editor in order to blank a password.
    if (sealed && draft === '') {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateServiceEnvVar(serviceId, envKey, draft, sealed);
      setEditing(false);
      onSaved(envKey, draft, sealed);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : `${envKey} could not be saved. Try again.`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-2 px-3 py-2 sm:grid-cols-[16rem_1fr] sm:items-center">
      <dt className="truncate font-mono text-xs text-ink-muted" title={envKey}>
        {envKey}
      </dt>
      <dd className="min-w-0">
        {editing ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${inputClass} font-mono sm:w-auto sm:min-w-0 sm:flex-1`}
                spellCheck={false}
                autoComplete="off"
                aria-label={`Value for ${envKey}`}
                placeholder={
                  sealed
                    ? 'Leave empty to keep the current value; type a new one to replace it'
                    : ''
                }
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button size="sm" onClick={save} disabled={saving} aria-label={`Save ${envKey}`}>
                {saving ? 'Saving' : 'Save'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancel}
                disabled={saving}
                aria-label={`Cancel editing ${envKey}`}
              >
                Cancel
              </Button>
            </div>
            {sealed ? (
              <Text variant="caption" tone="secondary">
                Sealed, so there is nothing to show here. Leaving this empty keeps the value it
                already has; type a new one to replace it.
              </Text>
            ) : null}
            {error ? (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {sealed ? (
              <Text variant="caption" tone="secondary">
                Sealed: encrypted and never shown again
              </Text>
            ) : (
              <RevealValue value={value} label={envKey} sensitive />
            )}
            {canWrite ? (
              <Button variant="ghost" size="sm" onClick={open} aria-label={`Edit ${envKey}`}>
                <Pencil width={14} height={14} aria-hidden />
                Edit
              </Button>
            ) : null}
          </div>
        )}
      </dd>
    </div>
  );
}

/**
 * The current environment, one row per variable, each value masked behind a
 * reveal. An environment holds database passwords and API keys, so it is masked
 * on load rather than printed: an Operator reveals the one they need.
 *
 * A sealed value cannot be read back at all, so it says so instead of offering a
 * reveal that could never work.
 */
function EnvList({
  service,
  canWrite,
  onSaved,
}: {
  service: Service;
  canWrite: boolean;
  onSaved: (key: string, value: string, secret: boolean) => void;
}) {
  const entries = Object.entries(service.env ?? {});
  if (entries.length === 0) {
    return (
      <Text variant="body-sm" tone="secondary">
        No environment variables set. Choose Edit all to add some.
      </Text>
    );
  }
  return (
    <dl className="divide-y divide-border rounded-md border border-border">
      {entries.map(([key, value]) => (
        <EnvRow
          key={key}
          serviceId={service.id}
          envKey={key}
          value={value}
          canWrite={canWrite}
          onSaved={onSaved}
        />
      ))}
    </dl>
  );
}

/** The command and environment editor, with the redeploy that applies it. */
export function ServiceConfiguration({
  service,
  onChanged,
}: {
  service: Service;
  onChanged: () => void;
}) {
  const canWrite = useCanWrite();
  const [command, setCommand] = useState(service.source.command ?? '');
  const [envText, setEnvText] = useState(() => envToText(service));
  // Values are masked by default. An environment is where the database password
  // and the API keys live, so showing it in plain text on load is wrong: it is
  // readable over a shoulder, in a screen share, and in a screenshot. The
  // Operator reveals what they need, one value at a time.
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [redeploying, setRedeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isAdopted = service.adopted === true;
  // An edit later than the last deploy has not reached the running container.
  const needsRedeploy = Boolean(service.config_changed_at) || saved;

  const save = async () => {
    const parsed = parseEnv(envText);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateServiceConfiguration(service.id, { command, env: parsed.env });
      setSaved(true);
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'That change could not be saved. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * A per-variable save lands in the same place a full save does: recorded, and
   * not yet running. It reuses the one "Saved, but not yet running" notice so an
   * Operator is told about the pending redeploy in exactly one way, whichever
   * editor they used.
   */
  const onEnvVarSaved = (key: string, value: string, secret: boolean) => {
    setEnvText((text) => withEnvLine(text, key, value, secret));
    setSaved(true);
    onChanged();
  };

  const applyNow = async () => {
    setRedeploying(true);
    setError(null);
    try {
      await redeployService(service.id);
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'The redeploy could not be started. Try again.',
      );
    } finally {
      setRedeploying(false);
    }
  };

  return (
    <Section
      title="Command and environment"
      adornment={<Settings width={16} height={16} className="text-brand" aria-hidden />}
      description="Change what this Service runs and the variables it runs with. Saving records the change; because a container bakes these in when it is created, a redeploy is what applies it."
      collapsible
      summary={`${Object.keys(service.env ?? {}).length} variables`}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="svc-command" className="text-sm font-medium text-ink">
          Command
        </label>
        <input
          id="svc-command"
          className={`${inputClass} font-mono`}
          placeholder={
            service.runtime === 'systemd'
              ? '/usr/local/bin/app --serve'
              : 'Leave empty for the image default'
          }
          value={command}
          onChange={(event) => setCommand(event.target.value)}
        />
        {service.runtime === 'systemd' ? (
          <Text variant="caption" tone="secondary">
            A systemd Service is its command, so this cannot be empty.
          </Text>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Text variant="body-sm" className="font-medium">
            Environment
          </Text>
          {canWrite ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setEditing((was) => !was)}
            >
              {editing ? 'Done editing' : 'Edit all'}
            </Button>
          ) : null}
        </div>

        {editing ? (
          <>
            <label htmlFor="svc-env" className="sr-only">
              Environment variables
            </label>
            <textarea
              id="svc-env"
              rows={6}
              spellCheck={false}
              className={`${inputClass} resize-y font-mono`}
              placeholder={'DATABASE_URL=postgres://…\nsecret:SECRET_ENCRYPTION_KEY=…'}
              value={envText}
              onChange={(event) => setEnvText(event.target.value)}
            />
            <Text variant="caption" tone="secondary">
              One per line, <code>KEY=value</code>. Prefix with <code>secret:</code> to seal a
              value: it is encrypted and never shown again. This list <strong>replaces</strong> what
              is there, so delete a line to remove that variable.
              <br />A sealed value cannot be read back, so its line shows empty. Leaving it empty
              keeps the value it already has; type a new one to replace it.
            </Text>
          </>
        ) : (
          <EnvList service={service} canWrite={canWrite} onSaved={onEnvVarSaved} />
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {needsRedeploy && !isAdopted ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning bg-subtle px-4 py-3">
          <AlertTriangle width={16} height={16} className="shrink-0 text-warning" aria-hidden />
          <Text variant="body-sm" tone="secondary" className="min-w-0 flex-1">
            Saved, but not yet running. The container still has the previous command and environment
            until you redeploy.
          </Text>
          {canWrite ? (
            <Button size="sm" onClick={applyNow} disabled={redeploying}>
              <RefreshCw width={15} height={15} aria-hidden />
              {redeploying ? 'Redeploying' : 'Redeploy to apply'}
            </Button>
          ) : null}
        </div>
      ) : null}

      {isAdopted ? (
        <Text variant="caption" tone="secondary">
          This workload was already running when SlideOps found it, so SlideOps cannot rebuild it.
          Saving records what you want here, but applying it means recreating the workload yourself.
        </Text>
      ) : null}

      {canWrite ? (
        <div>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving' : 'Save changes'}
          </Button>
        </div>
      ) : null}
    </Section>
  );
}
