import { ApiError, redeployService, updateServiceConfiguration, type Service } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { AlertTriangle, RefreshCw, Settings } from '@slideops/icons';
import { useState } from 'react';
import { parseEnv, SECRET_PREFIX } from '../service-schema';

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
      value === '[stored securely]' ? `${SECRET_PREFIX}${key}=` : `${key}=${value}`,
    )
    .join('\n');
}

/** The command and environment editor, with the redeploy that applies it. */
export function ServiceConfiguration({
  service,
  onChanged,
}: {
  service: Service;
  onChanged: () => void;
}) {
  const [command, setCommand] = useState(service.source.command ?? '');
  const [envText, setEnvText] = useState(() => envToText(service));
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

  const applyNow = async () => {
    setRedeploying(true);
    setError(null);
    try {
      await redeployService(service.id);
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'The redeploy could not be started. Try again.',
      );
    } finally {
      setRedeploying(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Settings width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Command and environment</Text>
      </div>

      <Text variant="body-sm" tone="secondary">
        Change what this Service runs and the variables it runs with. Saving records the change;
        because a container bakes these in when it is created, a redeploy is what applies it.
      </Text>

      <div className="flex flex-col gap-2">
        <label htmlFor="svc-command" className="text-sm font-medium text-ink">
          Command
        </label>
        <input
          id="svc-command"
          className={`${inputClass} font-mono`}
          placeholder={
            service.runtime === 'systemd' ? '/usr/local/bin/app --serve' : 'Leave empty for the image default'
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
        <label htmlFor="svc-env" className="text-sm font-medium text-ink">
          Environment
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
          One per line, <code>KEY=value</code>. Prefix with <code>secret:</code> to seal a value — it
          is encrypted and never shown again. This list <strong>replaces</strong> what is there, so
          delete a line to remove that variable. A sealed value cannot be read back, so its line
          shows empty; retype it to keep it, or it will be dropped.
        </Text>
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
          <Button size="sm" onClick={applyNow} disabled={redeploying}>
            <RefreshCw width={15} height={15} aria-hidden />
            {redeploying ? 'Redeploying' : 'Redeploy to apply'}
          </Button>
        </div>
      ) : null}

      {isAdopted ? (
        <Text variant="caption" tone="secondary">
          This workload was already running when SlideOps found it, so SlideOps cannot rebuild it.
          Saving records what you want here, but applying it means recreating the workload yourself.
        </Text>
      ) : null}

      <div>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving' : 'Save changes'}
        </Button>
      </div>
    </Card>
  );
}
