import {
  ApiError,
  AUTO_HOST_PORT,
  redeployService,
  updateServiceConfiguration,
  updateServiceEnvVar,
  type Service,
  type ServiceEnvVarEdit,
  type ServiceSourceEdit,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, Pencil, RefreshCw, Settings } from '@slideops/icons';
import { useId, useRef, useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { RevealValue } from './RevealValue';
import { parseEnv, parsePorts, SECRET_PREFIX } from '../service-schema';

/**
 * What the API returns in place of a sealed value. The plaintext lives only in the
 * secret store, so this marker is all a read ever sees.
 */
const SEALED_MARKER = '[stored securely]';

/*
 * Backend failures this editor answers by code rather than by reading the
 * message. The wording of a message is the backend's to change; the code is the
 * contract, and matching on prose breaks silently the day it is reworded.
 */
const CODE_INVALID_NAME = 'invalid_env_key';
const CODE_NAME_EXISTS = 'env_key_exists';
const CODE_NAME_NOT_FOUND = 'env_key_not_found';
const CODE_CONFIG_CHANGED = 'config_changed';

/*
 * Editing what a deployed Service was deployed with.
 *
 * Everything about a Service used to be fixed the moment it was deployed. An
 * Operator who forgot a variable, or whose database URL changed, had no way to
 * correct it and had to delete the Service and start again. Its source and its
 * ports were the rest of that same problem, and the more expensive half: a
 * Service published on 8000 when 3000 was meant, or built from the wrong branch,
 * could only be fixed by deleting it and deploying again from scratch.
 *
 * The whole deploy form is not reproduced here. What a Service is (its name, its
 * Node, its Project, its runtime) is its identity, and changing that is a
 * different workload rather than a correction to this one. What it runs, where it
 * comes from, and what it publishes are the things typed wrongly, so those are
 * what this edits.
 *
 * A container bakes all of it in when it is created, so an edit is not live until
 * a redeploy. This says that plainly rather than saving and letting the Operator
 * assume it took effect.
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
 * What is wrong with a variable name, or null when nothing is.
 *
 * This mirrors the backend rule exactly and deliberately stops there. The
 * conventional `[A-Za-z_][A-Za-z0-9_]*` would be narrower, and a name is read by
 * the Operator's own application, not by us: refusing one their program actually
 * looks up would break a working deployment to enforce a convention we do not
 * own. So refuse only what cannot survive in an environment at all, and let the
 * backend stay the authority on the rest.
 */
function nameProblem(name: string): string | null {
  if (name === '') {
    return 'Give the variable a name.';
  }
  if (name.includes('=')) {
    return 'A variable name cannot contain an equals sign.';
  }
  if (/\s/.test(name)) {
    return 'A variable name cannot contain spaces or line breaks.';
  }
  return null;
}

/**
 * One variable's row: the value, and for an Operator who may write, an Edit that
 * turns this row alone into an editor for its name and its value.
 *
 * Editing one variable at a time is the safe way to change one variable. The full
 * editor sends the entire set, so a slip anywhere in that text can remove a
 * variable the Operator never meant to touch; here the request names one key and
 * carries one variable, and nothing else can be lost by omission.
 */
function EnvRow({
  serviceId,
  envKey,
  value,
  canWrite,
  configChangedAt,
  onSaved,
}: {
  serviceId: string;
  envKey: string;
  value: string;
  canWrite: boolean;
  /** The Service's `config_changed_at` as this row currently reads it. */
  configChangedAt?: string;
  onSaved: (updated: Service, from: string, to: string) => void;
}) {
  const sealed = value === SEALED_MARKER;
  const [name, setName] = useState(envKey);
  // A sealed value has no plaintext to load, so the box starts empty rather than
  // seeded with the marker: the marker is not the value, and saving it would
  // store the words "[stored securely]" as the variable.
  const [draft, setDraft] = useState(sealed ? '' : value);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  // The configuration as it read the moment this editor opened. It rides along on
  // the save so one built on a view that has since moved is refused, not applied.
  const openedAgainst = useRef<string | undefined>(undefined);
  const fieldId = useId();

  const nextName = name.trim();
  const renaming = nextName !== '' && nextName !== envKey;

  const reset = () => {
    setName(envKey);
    setDraft(sealed ? '' : value);
    setNameError(null);
    setError(null);
    setStale(false);
  };

  const open = () => {
    reset();
    openedAgainst.current = configChangedAt;
    setEditing(true);
  };

  const cancel = () => {
    reset();
    setEditing(false);
  };

  const save = async () => {
    const problem = nameProblem(nextName);
    if (problem) {
      setNameError(problem);
      setError(null);
      return;
    }

    // An empty box on a sealed variable means "leave the value alone", which is
    // what the placeholder promises. Sending the empty string instead would
    // destroy the secret, and nobody opens an editor in order to blank a
    // password. Renaming still has to reach the backend, so it says so with
    // keep_value rather than by sending a value it cannot know.
    const keepValue = sealed && draft === '';
    if (keepValue && !renaming) {
      setEditing(false);
      return;
    }

    const edit: ServiceEnvVarEdit = {
      // Sent only when it actually differs, so the request states an intent to
      // rename rather than leaving the backend to compare two strings.
      ...(renaming ? { name: nextName } : {}),
      // Never the marker and never a sealed plaintext: when the value is being
      // kept, the backend ignores this field and the wire carries nothing to leak.
      value: keepValue ? '' : draft,
      secret: sealed,
      ...(keepValue ? { keep_value: true } : {}),
      // Absent on a Service whose configuration has never been edited, and there
      // is no timestamp to echo in that case.
      ...(openedAgainst.current ? { if_unchanged_since: openedAgainst.current } : {}),
    };

    setSaving(true);
    setNameError(null);
    setError(null);
    setStale(false);
    try {
      const updated = await updateServiceEnvVar(serviceId, envKey, edit);
      setEditing(false);
      onSaved(updated, envKey, nextName);
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.code === CODE_INVALID_NAME || caught.code === CODE_NAME_EXISTS) {
          setNameError(caught.message);
        } else if (caught.code === CODE_CONFIG_CHANGED || caught.code === CODE_NAME_NOT_FOUND) {
          setStale(true);
          setError(caught.message);
        } else {
          setError(caught.message);
        }
      } else {
        setError(`${envKey} could not be saved. Try again.`);
      }
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
          <div className="flex flex-col gap-3 rounded-md border border-border bg-subtle p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${fieldId}-name`} className="text-xs font-medium text-ink">
                  Variable name
                </label>
                <input
                  id={`${fieldId}-name`}
                  className={`${inputClass} font-mono`}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? `${fieldId}-name-error` : undefined}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                {nameError ? (
                  <p id={`${fieldId}-name-error`} role="alert" className="text-xs text-danger">
                    {nameError}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${fieldId}-value`} className="text-xs font-medium text-ink">
                  Variable value
                </label>
                <input
                  id={`${fieldId}-value`}
                  className={`${inputClass} font-mono`}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={
                    sealed
                      ? 'Leave empty to keep the current value; type a new one to replace it'
                      : ''
                  }
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </div>
            </div>

            {sealed ? (
              <Text variant="body-sm" tone="secondary">
                Sealed, so there is nothing to show here. Leaving this empty keeps the value it
                already has; type a new one to replace it.
              </Text>
            ) : null}

            {renaming ? (
              <div className="flex items-start gap-2 rounded-md border border-warning bg-surface px-3 py-2">
                <AlertTriangle
                  width={14}
                  height={14}
                  className="mt-0.5 shrink-0 text-warning"
                  aria-hidden
                />
                <Text variant="body-sm" tone="secondary" className="min-w-0">
                  You are renaming {envKey} to {nextName}. Anything that still expects {envKey} will
                  no longer receive it.
                  {sealed && draft === ''
                    ? ' The sealed value moves across untouched: it is never read back to be renamed.'
                    : ''}
                </Text>
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            ) : null}
            {stale ? (
              <Text variant="body-sm" tone="secondary">
                This editor is showing an environment that has since changed. Reload the page to
                read the current one, then make this change again.
              </Text>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={save}
                disabled={saving}
                aria-label={`Save changes to ${envKey}`}
              >
                {saving ? 'Saving' : 'Save changes'}
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
  onSaved: (updated: Service, from: string, to: string) => void;
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
          configChangedAt={service.config_changed_at}
          onSaved={onSaved}
        />
      ))}
    </dl>
  );
}

/**
 * Render the Service's published ports back into the textarea form, in the same
 * shape the deploy form accepts: `container` on its own when SlideOps chose the
 * host port, `host:container` when the Operator pinned it.
 */
function portsToText(service: Service): string {
  return (service.ports ?? [])
    .map((port) =>
      port.host === AUTO_HOST_PORT ? `${port.container}` : `${port.host}:${port.container}`,
    )
    .join('\n');
}

/**
 * Whether this Service's source is one an Operator can edit. An adopted workload
 * and a Capability Service were never built by SlideOps from a source, so there
 * is nothing here for them to change.
 */
function isEditableSource(service: Service): boolean {
  return service.source.type === 'image' || service.source.type === 'repository';
}

/** The deploy configuration editor, with the redeploy that applies it. */
export function ServiceConfiguration({
  service,
  onChanged,
}: {
  service: Service;
  onChanged: () => void;
}) {
  const canWrite = useCanWrite();
  /*
   * The Service as this screen last read it, from the prop or from the answer to
   * a save. Every save returns the whole Service, so the rows, the variable count,
   * and the full editor all read from that one answer rather than from a guess
   * about what the save did. A rename in particular cannot be guessed at: it moves
   * a row, and an optimistic patch would leave the old name on screen.
   */
  const [snapshot, setSnapshot] = useState(service);
  const [propSeen, setPropSeen] = useState(service);
  const [command, setCommand] = useState(service.source.command ?? '');
  const [envText, setEnvText] = useState(() => envToText(service));
  const [sourceType, setSourceType] = useState<ServiceSourceEdit['type']>(
    service.source.type === 'repository' ? 'repository' : 'image',
  );
  const [image, setImage] = useState(service.source.image ?? '');
  const [repositoryUrl, setRepositoryUrl] = useState(service.source.repository_url ?? '');
  const [branch, setBranch] = useState(service.source.branch ?? '');
  const [build, setBuild] = useState(service.source.build ?? '');
  const [portsText, setPortsText] = useState(() => portsToText(service));
  // Which Service the textarea text was built from, so reopening the full editor
  // reseeds it only when the environment underneath has actually moved. Reseeding
  // unconditionally would throw away text the Operator was still working on.
  const seededFrom = useRef(service);
  // Values are masked by default. An environment is where the database password
  // and the API keys live, so showing it in plain text on load is wrong: it is
  // readable over a shoulder, in a screen share, and in a screenshot. The
  // Operator reveals what they need, one value at a time.
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [redeploying, setRedeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [envNotice, setEnvNotice] = useState<string | null>(null);

  // A reload from the screen above replaces what we know. The command text and the
  // textarea are deliberately left alone: they may hold work in progress, and a
  // reload triggered by an unrelated save must not discard it.
  if (propSeen !== service) {
    setPropSeen(service);
    setSnapshot(service);
  }

  const isAdopted = snapshot.adopted === true;
  // An adopted workload and a Capability Service have no source SlideOps can
  // rebuild from, so there is nothing here for them to edit. A compose stack is
  // described by a file in its repository, so its type is fixed even though its
  // repository, branch and ports are not.
  const canEditSource = !isAdopted && isEditableSource(snapshot);
  const sourceTypeFixed = snapshot.runtime === 'compose';
  // An edit later than the last deploy has not reached the running container.
  const needsRedeploy = Boolean(snapshot.config_changed_at) || saved;

  const save = async () => {
    const parsed = parseEnv(envText);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    const parsedPorts = parsePorts(portsText);
    if (parsedPorts.error) {
      setError(parsedPorts.error);
      return;
    }
    // A compose stack is described by a file in its repository, so offering to
    // move it to an image would offer something the backend must refuse.
    const source: ServiceSourceEdit | undefined = canEditSource
      ? sourceType === 'image'
        ? { type: 'image', image: image.trim() }
        : {
            type: 'repository',
            repository_url: repositoryUrl.trim(),
            branch: branch.trim(),
            build: build.trim(),
          }
      : undefined;

    setSaving(true);
    setError(null);
    try {
      const updated = await updateServiceConfiguration(snapshot.id, {
        command,
        env: parsed.env,
        // Ports go only when they can actually be rebuilt. An adopted workload
        // would be refused, and sending them anyway would turn a saveable env
        // edit into a failed request.
        ...(canEditSource ? { source, ports: parsedPorts.ports } : {}),
      });
      setSnapshot(updated);
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
   * editor they used, and adds a line saying which of the two things happened,
   * because a rename and a value change are not the same event to be told about.
   */
  const onEnvVarSaved = (updated: Service, from: string, to: string) => {
    setSnapshot(updated);
    setEnvNotice(from === to ? `Updated ${from}.` : `Renamed ${from} to ${to}.`);
    setSaved(true);
    onChanged();
  };

  const toggleFullEditor = () => {
    if (!editing && seededFrom.current !== snapshot) {
      setEnvText(envToText(snapshot));
      seededFrom.current = snapshot;
    }
    setEditing((was) => !was);
  };

  const applyNow = async () => {
    setRedeploying(true);
    setError(null);
    try {
      await redeployService(snapshot.id);
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
      title="Deployment configuration"
      adornment={<Settings width={16} height={16} className="text-brand" aria-hidden />}
      description="Correct what this Service was deployed with: where it comes from, the ports it publishes, what it runs, and the variables it runs with. Saving records the change; because a container bakes these in when it is created, a redeploy is what applies it."
      collapsible
      summary={`${Object.keys(snapshot.env ?? {}).length} variables`}
    >
      {canEditSource ? (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="svc-source-type" className="text-sm font-medium text-ink">
              Source
            </label>
            <select
              id="svc-source-type"
              className={inputClass}
              value={sourceType}
              disabled={sourceTypeFixed}
              onChange={(event) => setSourceType(event.target.value as ServiceSourceEdit['type'])}
            >
              <option value="image">A prebuilt image</option>
              <option value="repository">A repository to build</option>
            </select>
            {sourceTypeFixed ? (
              <Text variant="caption" tone="secondary">
                A Compose stack is described by a file in its repository, so it cannot be moved to
                an image. The repository and branch below can still be corrected.
              </Text>
            ) : null}
          </div>

          {sourceType === 'image' ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="svc-image" className="text-sm font-medium text-ink">
                Image
              </label>
              <input
                id="svc-image"
                className={`${inputClass} font-mono`}
                placeholder="nginx:1.27"
                value={image}
                onChange={(event) => setImage(event.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <label htmlFor="svc-repository-url" className="text-sm font-medium text-ink">
                  Repository
                </label>
                <input
                  id="svc-repository-url"
                  className={`${inputClass} font-mono`}
                  placeholder="git@github.com:acme/app.git"
                  value={repositoryUrl}
                  onChange={(event) => setRepositoryUrl(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="svc-branch" className="text-sm font-medium text-ink">
                  Branch
                </label>
                <input
                  id="svc-branch"
                  className={`${inputClass} font-mono`}
                  placeholder="main"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="svc-build" className="text-sm font-medium text-ink">
                  Build path
                </label>
                <input
                  id="svc-build"
                  className={`${inputClass} font-mono`}
                  placeholder="Leave empty to build from the repository root"
                  value={build}
                  onChange={(event) => setBuild(event.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="svc-ports" className="text-sm font-medium text-ink">
              Published ports
            </label>
            <textarea
              id="svc-ports"
              rows={3}
              spellCheck={false}
              className={`${inputClass} resize-y font-mono`}
              placeholder={'3000\n8080:80'}
              value={portsText}
              onChange={(event) => setPortsText(event.target.value)}
            />
            <Text variant="caption" tone="secondary">
              One per line. Write <code>3000</code> to publish that port and let SlideOps choose the
              public one, or <code>8080:80</code> to pin the public port yourself. This list{' '}
              <strong>replaces</strong> what is there, so delete a line to stop publishing it.
            </Text>
          </div>
        </>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="svc-command" className="text-sm font-medium text-ink">
          Command
        </label>
        <input
          id="svc-command"
          className={`${inputClass} font-mono`}
          placeholder={
            snapshot.runtime === 'systemd'
              ? '/usr/local/bin/app --serve'
              : 'Leave empty for the image default'
          }
          value={command}
          onChange={(event) => setCommand(event.target.value)}
        />
        {snapshot.runtime === 'systemd' ? (
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
            <Button variant="ghost" size="sm" className="ml-auto" onClick={toggleFullEditor}>
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
          <EnvList service={snapshot} canWrite={canWrite} onSaved={onEnvVarSaved} />
        )}

        {envNotice ? (
          <Text variant="body-sm" tone="secondary" role="status">
            {envNotice}
          </Text>
        ) : null}
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
            Saved, but not yet running. The container is still the one built from the previous
            configuration until you redeploy.
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
