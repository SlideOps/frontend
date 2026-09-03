import {
  ApiError,
  listServices,
  updateServiceConfiguration,
  type Service,
  type ServiceEnvVar,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { ArrowRight, GitBranch } from '@slideops/icons';
import { useMemo, useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { useAsyncData } from '../hooks/useAsyncData';
import { ErrorNote, Loading } from './Feedback';

/** What the API returns in place of a sealed value; matches ServiceConfiguration's own marker. */
const SEALED_MARKER = '[stored securely]';

type Row =
  | { kind: 'only_here'; key: string; value: string }
  | { kind: 'only_there'; key: string; value: string }
  | { kind: 'secret_both'; key: string }
  | { kind: 'same'; key: string; value: string }
  | { kind: 'differs'; key: string; hereValue: string; thereValue: string };

/** Client-side diff of two Services' environments; never fetches or reveals a sealed value. */
function diffEnv(here: Service['env'], there: Service['env']): Row[] {
  const hereEnv = here ?? {};
  const thereEnv = there ?? {};
  const keys = Array.from(new Set([...Object.keys(hereEnv), ...Object.keys(thereEnv)])).sort();

  return keys.map((key): Row => {
    const inHere = key in hereEnv;
    const inThere = key in thereEnv;
    if (inHere && !inThere) {
      return { kind: 'only_here', key, value: hereEnv[key] ?? '' };
    }
    if (!inHere && inThere) {
      return { kind: 'only_there', key, value: thereEnv[key] ?? '' };
    }
    const hereValue = hereEnv[key] ?? '';
    const thereValue = thereEnv[key] ?? '';
    if (hereValue === SEALED_MARKER || thereValue === SEALED_MARKER) {
      return { kind: 'secret_both', key };
    }
    if (hereValue === thereValue) {
      return { kind: 'same', key, value: hereValue };
    }
    return { kind: 'differs', key, hereValue, thereValue };
  });
}

/**
 * Compare this Service's environment against another Service in the same
 * Project, and optionally copy a non-secret value across. A sealed value is
 * never compared or copied -- it reads as "set on both, hidden" and nothing
 * about it can be synced, since this never fetches or reveals a plaintext
 * secret it was not asked to.
 */
export function EnvDiffPanel({ service, projectId }: { service: Service; projectId: string }) {
  const canWrite = useCanWrite();
  const { state } = useAsyncData(
    async (signal): Promise<Service[]> => {
      const all = await listServices(signal);
      return all.filter(
        (candidate) =>
          candidate.project_id === projectId &&
          candidate.id !== service.id &&
          candidate.deployment_type === 'software',
      );
    },
    [projectId, service.id],
  );

  const [compareId, setCompareId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const candidates = state.status === 'ready' ? state.data : [];
  const compareTarget = candidates.find((candidate) => candidate.id === compareId) ?? null;

  const rows = useMemo(
    () => (compareTarget ? diffEnv(service.env, compareTarget.env) : []),
    [service.env, compareTarget],
  );

  const syncable = rows.filter(
    (row): row is Row & { kind: 'only_there' | 'differs' } =>
      row.kind === 'only_there' || row.kind === 'differs',
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function sync() {
    if (selected.size === 0) {
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      const merged = new Map<string, ServiceEnvVar>();
      for (const [key, value] of Object.entries(service.env ?? {})) {
        merged.set(key, {
          key,
          value: value === SEALED_MARKER ? '' : value,
          secret: value === SEALED_MARKER,
          keep: value === SEALED_MARKER,
        });
      }
      for (const row of syncable) {
        if (!selected.has(row.key)) {
          continue;
        }
        const value = row.kind === 'only_there' ? row.value : row.thereValue;
        merged.set(row.key, { key: row.key, value, secret: false });
      }
      await updateServiceConfiguration(service.id, {
        command: service.source.command ?? '',
        env: Array.from(merged.values()),
      });
      setSaved(true);
      setSelected(new Set());
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'That could not be synced. Try again.',
      );
    } finally {
      setSyncing(false);
    }
  }

  if (state.status === 'ready' && candidates.length === 0) {
    return null;
  }

  return (
    <Section
      title="Compare environment"
      adornment={<GitBranch width={16} height={16} className="text-brand" aria-hidden />}
      description="See what differs between this Service's environment and another Service in the same Project, and copy values across."
      collapsible
    >
      {state.status === 'loading' ? <Loading label="Reading Services to compare against" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        <div className="flex flex-col gap-3">
          <label htmlFor="env-diff-compare" className="text-sm font-medium text-ink">
            Compare against
          </label>
          <select
            id="env-diff-compare"
            className="h-10 w-full max-w-xs rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            value={compareId}
            onChange={(event) => {
              setCompareId(event.target.value);
              setSelected(new Set());
              setSaved(false);
            }}
          >
            <option value="">Choose a Service&hellip;</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>

          {compareTarget && rows.length === 0 ? (
            <Text variant="body-sm" tone="secondary">
              Neither Service has any environment variables set.
            </Text>
          ) : null}

          {compareTarget && rows.length > 0 ? (
            <dl className="flex flex-col divide-y divide-border rounded-md border border-border">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-1 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3"
                >
                  <dt className="min-w-0 font-mono text-xs text-ink-muted" title={row.key}>
                    {row.key}
                  </dt>
                  <dd className="flex min-w-0 items-center justify-end gap-3">
                    {row.kind === 'same' ? (
                      <Text variant="caption" tone="secondary">
                        Same on both
                      </Text>
                    ) : null}
                    {row.kind === 'secret_both' ? (
                      <Text variant="caption" tone="secondary">
                        Secret, set on both, hidden
                      </Text>
                    ) : null}
                    {row.kind === 'only_here' ? (
                      <Text variant="caption" tone="secondary">
                        Only on this Service
                      </Text>
                    ) : null}
                    {row.kind === 'only_there' ? (
                      <>
                        <Text variant="caption" tone="secondary" className="truncate font-mono">
                          {row.value}
                        </Text>
                        {canWrite ? (
                          <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
                            <input
                              type="checkbox"
                              checked={selected.has(row.key)}
                              onChange={() => toggle(row.key)}
                              className="h-3.5 w-3.5 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                            />
                            Copy here
                          </label>
                        ) : null}
                      </>
                    ) : null}
                    {row.kind === 'differs' ? (
                      <>
                        <Text variant="caption" tone="secondary" className="truncate font-mono">
                          {row.hereValue} <ArrowRight width={10} height={10} className="inline" aria-hidden />{' '}
                          {row.thereValue}
                        </Text>
                        {canWrite ? (
                          <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
                            <input
                              type="checkbox"
                              checked={selected.has(row.key)}
                              onChange={() => toggle(row.key)}
                              className="h-3.5 w-3.5 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                            />
                            Use theirs
                          </label>
                        ) : null}
                      </>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          {saved ? (
            <Text variant="caption" tone="secondary">
              Saved. This still needs a redeploy to apply, the same as any other configuration
              change.
            </Text>
          ) : null}

          {canWrite && compareTarget && syncable.length > 0 ? (
            <div>
              <Button size="sm" onClick={() => void sync()} disabled={selected.size === 0 || syncing}>
                {syncing ? 'Syncing' : `Sync selected (${selected.size})`}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}
