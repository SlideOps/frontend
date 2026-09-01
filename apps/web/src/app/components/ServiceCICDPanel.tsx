import {
  apiBase,
  ApiError,
  listServiceDeployEvents,
  rotateDeployHookToken,
  updateServiceCICD,
  type DeployEvent,
  type Service,
  type ServiceBuildMode,
} from '@slideops/api-client';
import { Button, Card, Section, Text } from '@slideops/design-system';
import { RefreshCw } from '@slideops/icons';
import { useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { useAsyncData } from '../hooks/useAsyncData';
import { CopyButton } from './CopyButton';
import { ErrorNote, Loading } from './Feedback';
import { Refreshing } from './Refreshing';
import { RevealValue } from './RevealValue';

/*
 * Automatic deployment: turn it on, choose how this Service builds, and see
 * why the last few attempts did or did not fire.
 *
 * Two build modes, each with its own section here. slideops mode is a toggle
 * on top of the deploy this Service already does: a push to the deployed
 * branch redeploys it, instantly through a webhook when one could be
 * registered, otherwise within a few minutes through a periodic check, and
 * the tab says plainly which one is actually running. external mode has
 * nothing to toggle beyond choosing it: an outside CI is what triggers a
 * deploy here, by calling the deploy hook with an image reference or
 * uploading a tarball, authenticated with the token this tab issues.
 */

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** The API's own absolute origin, for a snippet a pipeline elsewhere copies
 *  and runs: a relative path means nothing outside this browser tab. */
function apiOrigin(): string {
  const base = apiBase();
  return base.startsWith('http') ? base : `${window.location.origin}${base}`;
}

function triggerLabel(trigger: DeployEvent['trigger']): string {
  switch (trigger) {
    case 'push_webhook':
      return 'Push webhook';
    case 'poll':
      return 'Periodic check';
    case 'deploy_hook':
      return 'Deploy hook';
    case 'artifact_upload':
      return 'Artifact upload';
    case 'manual':
      return 'Manual';
    default:
      return trigger;
  }
}

function outcomeTone(outcome: DeployEvent['outcome']): string {
  if (outcome === 'error') {
    return 'text-danger';
  }
  if (outcome === 'skipped') {
    return 'text-ink-muted';
  }
  return 'text-ink';
}

function outcomeMarker(outcome: DeployEvent['outcome']): string {
  if (outcome === 'error') {
    return 'bg-danger';
  }
  if (outcome === 'skipped') {
    return 'bg-border';
  }
  return 'bg-brand';
}

function eventLine(event: DeployEvent): string {
  const parts = [triggerLabel(event.trigger)];
  if (event.commit_sha) {
    parts.push(`commit ${event.commit_sha.slice(0, 7)}`);
  }
  if (event.image) {
    parts.push(event.image);
  }
  if (event.detail) {
    parts.push(event.detail);
  }
  return `${new Date(event.created_at).toLocaleString()}: ${parts.join(' · ')}`;
}

/** What triggered a deploy attempt and what happened, newest first. */
function DeployEventsList({ serviceId, refreshKey }: { serviceId: string; refreshKey: number }) {
  const { state, reload, refreshing } = useAsyncData(
    (signal) => listServiceDeployEvents(serviceId, 50, signal),
    [serviceId, refreshKey],
  );
  const events = state.status === 'ready' ? state.data : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Text variant="body-sm" tone="secondary">
          What triggered a deploy attempt here, and what happened, newest first.
        </Text>
        <span className="flex items-center gap-2">
          <Refreshing label="Reading" show={refreshing} />
          <CopyButton value={events.map(eventLine).join('\n')} label="the deploy trail" />
          <Button variant="ghost" size="sm" onClick={reload} disabled={refreshing}>
            <RefreshCw width={14} height={14} aria-hidden />
            Refresh
          </Button>
        </span>
      </div>

      {state.status === 'loading' ? <Loading label="Reading the deploy trail" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {state.status === 'ready' ? (
        events.length > 0 ? (
          <ol className="flex flex-col">
            {events.map((event) => (
              <li key={event.id} className="flex gap-3 border-b border-border py-2 last:border-b-0">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${outcomeMarker(event.outcome)}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${outcomeTone(event.outcome)}`}>{triggerLabel(event.trigger)}</p>
                  <p className="mt-0.5 break-words font-mono text-xs text-ink-muted">
                    {[event.commit_sha ? `commit ${event.commit_sha.slice(0, 7)}` : null, event.image, event.detail]
                      .filter(Boolean)
                      .join(' · ') || event.outcome}
                  </p>
                </div>
                <time
                  dateTime={event.created_at}
                  className="shrink-0 text-xs text-ink-muted"
                  title={new Date(event.created_at).toLocaleString()}
                >
                  {new Date(event.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <Text variant="body-sm" tone="secondary">
            Nothing yet. A push, a periodic check, or a call from an outside CI appears here as it
            happens.
          </Text>
        )
      ) : null}
    </div>
  );
}

/** The deploy hook token, issued once and shown once, plus ready to paste
 *  pipeline snippets for both delivery mechanisms. */
function DeployHookSection({
  service,
  onRotated,
}: {
  service: Service;
  onRotated: () => void;
}) {
  const canWrite = useCanWrite();
  const [rotating, setRotating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function rotate() {
    setRotating(true);
    setError(null);
    try {
      const result = await rotateDeployHookToken(service.id);
      setToken(result.token);
      onRotated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'That could not be rotated.'));
    } finally {
      setRotating(false);
    }
  }

  const deployHookURL = `${apiOrigin()}/services/${service.id}/deploy-hook`;
  const artifactURL = `${apiOrigin()}/services/${service.id}/artifact`;

  const registrySnippet = `docker build -t myapp:$GITHUB_SHA .
docker push myapp:$GITHUB_SHA
curl -X POST ${deployHookURL} \\
  -H "Authorization: Bearer ${token ?? '<token>'}" \\
  -H "Content-Type: application/json" \\
  -d '{"image":"myapp:'"$GITHUB_SHA"'"}'`;

  const uploadSnippet = `docker build -t myapp:$GITHUB_SHA .
docker save myapp:$GITHUB_SHA | curl -X POST ${artifactURL} \\
  -H "Authorization: Bearer ${token ?? '<token>'}" \\
  --data-binary @-`;

  return (
    <div className="flex flex-col gap-4">
      <Text variant="body-sm" tone="secondary">
        The bearer token your pipeline&apos;s last step authenticates with. Shown once, at the moment
        it is rotated; SlideOps cannot show it to you again after that, only issue a new one.
      </Text>
      <div className="flex items-center gap-3">
        {token !== null ? (
          <RevealValue value={token} label="deploy hook token" sensitive={false} />
        ) : (
          <Text variant="caption" tone="secondary">
            {service.cicd.deploy_hook_configured ? 'A token is set.' : 'No token yet.'}
          </Text>
        )}
        {canWrite ? (
          <Button variant="secondary" size="sm" onClick={() => void rotate()} disabled={rotating}>
            {rotating ? 'Rotating' : service.cicd.deploy_hook_configured ? 'Rotate' : 'Issue a token'}
          </Button>
        ) : null}
      </div>
      {error ? <ErrorNote error={error} /> : null}

      <div className="flex flex-col gap-2">
        <Text variant="body-sm" className="font-medium text-ink">
          If your pipeline pushes to a registry
        </Text>
        <Text variant="caption" tone="secondary">
          Add this as the last step, after the image is pushed. SlideOps pulls exactly that tag and
          runs it, never rebuilding it.
        </Text>
        <div className="relative">
          <pre className="overflow-x-auto rounded-md border border-border bg-subtle p-3 text-xs text-ink">
            <code>{registrySnippet}</code>
          </pre>
          <CopyButton value={registrySnippet} label="the registry pipeline step" className="absolute right-2 top-2" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Text variant="body-sm" className="font-medium text-ink">
          If your pipeline has no registry
        </Text>
        <Text variant="caption" tone="secondary">
          Upload the built image directly. No registry account needed; SlideOps loads it on your
          Node and runs it.
        </Text>
        <div className="relative">
          <pre className="overflow-x-auto rounded-md border border-border bg-subtle p-3 text-xs text-ink">
            <code>{uploadSnippet}</code>
          </pre>
          <CopyButton value={uploadSnippet} label="the upload pipeline step" className="absolute right-2 top-2" />
        </div>
      </div>
    </div>
  );
}

/** The registry an external mode Service pulls a private image from. */
function RegistryCredentialsForm({
  service,
  url,
  username,
  onURLChange,
  onUsernameChange,
  password,
  onPasswordChange,
}: {
  service: Service;
  url: string;
  username: string;
  onURLChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  password: string | null;
  onPasswordChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Text variant="body-sm" tone="secondary">
        Only needed for a private image. Left empty, an image is pulled as public.
      </Text>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">Registry</span>
        <input
          className={inputClass}
          placeholder="ghcr.io (leave empty for Docker Hub)"
          value={url}
          onChange={(event) => onURLChange(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">Username</span>
        <input
          className={inputClass}
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">Password or access token</span>
        <input
          type="password"
          className={inputClass}
          placeholder={service.cicd.registry_configured ? 'Unchanged — type to replace it' : ''}
          value={password ?? ''}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
      </label>
      {service.cicd.registry_configured && password === null ? (
        <button
          type="button"
          onClick={() => onPasswordChange('')}
          className="self-start text-xs font-medium text-brand hover:text-ink"
        >
          Clear the stored credential
        </button>
      ) : null}
    </div>
  );
}

/** Automatic deployment: turn it on, choose how this Service builds, and see
 *  the deploy trail. */
export function ServiceCICDPanel({ service, onChanged }: { service: Service; onChanged: () => void }) {
  const canWrite = useCanWrite();
  const cicd = service.cicd;
  const [autoDeploy, setAutoDeploy] = useState(cicd.auto_deploy);
  const [buildMode, setBuildMode] = useState<ServiceBuildMode>(cicd.build_mode);
  const [registryURL, setRegistryURL] = useState(cicd.registry_url ?? '');
  const [registryUsername, setRegistryUsername] = useState(cicd.registry_username ?? '');
  // null means "leave the stored credential untouched"; the empty string is a
  // deliberate clear the Operator asked for.
  const [registryPassword, setRegistryPassword] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const canAutoDeployInSlideOpsMode = service.source.type === 'repository';

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateServiceCICD(service.id, {
        auto_deploy: autoDeploy,
        build_mode: buildMode,
        registry_url: registryURL,
        registry_username: registryUsername,
        ...(registryPassword !== null ? { registry_password: registryPassword } : {}),
      });
      setRegistryPassword(null);
      setRefreshKey((n) => n + 1);
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'That could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  const webhookStatus =
    buildMode === 'slideops' && autoDeploy
      ? cicd.webhook_configured
        ? 'Instant: a push to the deployed branch redeploys within seconds, through a registered webhook.'
        : 'Backed by polling: SlideOps could not register a webhook on this repository, so it checks for a new commit every few minutes instead.'
      : null;

  return (
    <div className="flex flex-col divide-y divide-border">
      <Section
        title="Automatic deployment"
        description="Redeploy this Service on its own, without coming back to click Deploy."
        flush
      >
        <div className="flex flex-col gap-4">
          <label className="inline-flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              checked={autoDeploy}
              disabled={!canWrite || (buildMode === 'slideops' && !canAutoDeployInSlideOpsMode)}
              onChange={(event) => setAutoDeploy(event.target.checked)}
            />
            <span className="text-sm font-medium text-ink">
              {autoDeploy ? 'On' : 'Off'}
            </span>
          </label>
          {buildMode === 'slideops' && !canAutoDeployInSlideOpsMode ? (
            <Text variant="caption" tone="secondary">
              This Service does not deploy from a repository, so there is no branch to watch for a
              new commit on. Choose external mode below, or change the source on Settings.
            </Text>
          ) : null}

          <div className="flex flex-col gap-2">
            <Text variant="body-sm" className="font-medium text-ink">
              How this Service builds
            </Text>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={buildMode === 'slideops' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setBuildMode('slideops')}
                disabled={!canWrite}
              >
                SlideOps builds it
              </Button>
              <Button
                variant={buildMode === 'external' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setBuildMode('external')}
                disabled={!canWrite}
              >
                An external CI provides the artifact
              </Button>
            </div>
            <Text variant="caption" tone="secondary">
              {buildMode === 'slideops'
                ? `SlideOps clones and builds the repository itself, on ${service.source.branch || 'main'}, the same as a manual deploy always has.`
                : 'An outside CI already built and tested the image; SlideOps only ever runs it, from a deploy hook call or an artifact upload below, never rebuilding it.'}
            </Text>
          </div>

          {webhookStatus ? (
            <Card className="border-brand">
              <Text variant="body-sm" tone="secondary">
                {webhookStatus}
              </Text>
            </Card>
          ) : null}

          {error ? <ErrorNote error={error} /> : null}
          {canWrite ? (
            <div>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving' : 'Save changes'}
              </Button>
            </div>
          ) : null}
        </div>
      </Section>

      {buildMode === 'external' ? (
        <Section title="Registry" description="For the deploy hook's registry pull path.">
          <RegistryCredentialsForm
            service={service}
            url={registryURL}
            username={registryUsername}
            onURLChange={setRegistryURL}
            onUsernameChange={setRegistryUsername}
            password={registryPassword}
            onPasswordChange={setRegistryPassword}
          />
        </Section>
      ) : null}

      {buildMode === 'external' ? (
        <Section title="Deploy hook">
          <DeployHookSection service={service} onRotated={() => setRefreshKey((n) => n + 1)} />
        </Section>
      ) : null}

      <Section title="Activity">
        <DeployEventsList serviceId={service.id} refreshKey={refreshKey} />
      </Section>
    </div>
  );
}
