import {
  ApiError,
  disconnectGitHub,
  getGitHubRepositoryAccess,
  getGitHubStatus,
  githubAuthorizeUrl,
  listGitHubRepos,
  setGitHubRepositoryAccess,
  type GitHubAccessMode,
  type GitHubRepositoryAccess,
  type GitHubStatus,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, ExternalLink, GitBranch, Lock, RefreshCw, Search, Settings } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useEffect, useMemo, useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { useAsyncData } from '../hooks/useAsyncData';
import { filterGitHubRepos } from '../github-repos';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';

/*
 * Connecting GitHub and configuring which of its repositories SlideOps
 * offers are two separate, independent operations, the way Vercel and
 * Netlify's own GitHub integrations work.
 *
 * Connecting happens once (Connect, or later Reconnect, only ever needed
 * again for a whole GitHub organisation's own access approval, never for
 * one more repository). Configuring is a persistent, always reopenable
 * setting on that one connection: All repositories, or a curated Selected
 * list an Operator can add to, remove from, or wholesale replace at any
 * time, with nothing about it destroyed or reset by a Reconnect.
 */

interface GitHubData {
  status: GitHubStatus;
  access: GitHubRepositoryAccess | null;
  // Set when connected but the access configuration itself could not be
  // read, so that is shown for what it is rather than as "nothing is
  // configured yet".
  accessError: ApiError | null;
}

async function loadGitHub(signal: AbortSignal): Promise<GitHubData> {
  const status = await getGitHubStatus(signal);
  if (!status.connected) {
    return { status, access: null, accessError: null };
  }
  try {
    const access = await getGitHubRepositoryAccess(signal);
    return { status, access, accessError: null };
  } catch (error) {
    return {
      status,
      access: null,
      accessError:
        error instanceof ApiError ? error : new ApiError(0, 'unknown_error', 'The repositories could not be read.'),
    };
  }
}

const searchInputClass =
  'h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

function RepoSearchBox({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <label className="relative block">
      <Search
        width={14}
        height={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search repositories..."
        aria-label={ariaLabel}
        className={searchInputClass}
      />
    </label>
  );
}

/**
 * Configuring repository access: an access mode radio, and, in Selected
 * mode, a live, searchable, staged checkbox list. Nothing here calls the API
 * until Save changes; Cancel discards it all.
 */
function ConfigurePanel({
  access,
  onCancel,
  onSaved,
}: {
  access: GitHubRepositoryAccess;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draftMode, setDraftMode] = useState<GitHubAccessMode>(access.mode);
  const [draftSelected, setDraftSelected] = useState<Set<string>>(
    () => new Set(access.repos.map((repo) => repo.full_name)),
  );
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // The full live account, fetched once this panel opens rather than every
  // time the summary is shown: browsing to add or remove is the one moment
  // that actually needs it.
  const { state, reload, refreshing } = useAsyncData((signal) => listGitHubRepos(signal), []);
  const allRepos = state.status === 'ready' ? state.data : [];
  const visible = useMemo(() => filterGitHubRepos(allRepos, search), [allRepos, search]);

  function toggle(fullName: string) {
    setDraftSelected((current) => {
      const next = new Set(current);
      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await setGitHubRepositoryAccess(draftMode, draftMode === 'selected' ? [...draftSelected] : []);
      onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'That could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-subtle p-4">
      <Text variant="body-sm" className="font-medium text-ink">
        Configure repositories
      </Text>

      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-3 text-sm has-[:checked]:border-brand">
          <input
            type="radio"
            className="mt-0.5 accent-brand"
            checked={draftMode === 'all'}
            onChange={() => setDraftMode('all')}
          />
          <span>
            <span className="font-medium text-ink">All repositories</span>
            <span className="mt-0.5 block text-ink-muted">
              SlideOps can use every repository available to this connection.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-3 text-sm has-[:checked]:border-brand">
          <input
            type="radio"
            className="mt-0.5 accent-brand"
            checked={draftMode === 'selected'}
            onChange={() => setDraftMode('selected')}
          />
          <span>
            <span className="font-medium text-ink">Selected repositories</span>
            <span className="mt-0.5 block text-ink-muted">Choose which repositories SlideOps can use.</span>
          </span>
        </label>
      </div>

      {draftMode === 'selected' ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <RepoSearchBox value={search} onChange={setSearch} ariaLabel="Search repositories to configure" />
            <Button variant="ghost" size="sm" onClick={reload} disabled={refreshing}>
              <RefreshCw width={14} height={14} aria-hidden />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </Button>
          </div>

          {state.status === 'loading' ? <Loading label="Reading your GitHub repositories" /> : null}
          {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
          {state.status === 'ready' ? (
            allRepos.length === 0 ? (
              <Text variant="body-sm" tone="secondary">
                No repositories are visible to this GitHub account.
              </Text>
            ) : visible.length > 0 ? (
              <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-surface">
                <ul className="divide-y divide-border">
                  {visible.map((repo) => (
                    <li key={repo.full_name}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-subtle">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          checked={draftSelected.has(repo.full_name)}
                          onChange={() => toggle(repo.full_name)}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{repo.full_name}</span>
                        {repo.private ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                            <Lock width={11} height={11} aria-hidden />
                            Private
                          </span>
                        ) : null}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Text variant="body-sm" tone="secondary">
                No repository matches &ldquo;{search}&rdquo;.
              </Text>
            )
          ) : null}
          <Text variant="caption" tone="secondary">
            {draftSelected.size} selected
          </Text>
        </div>
      ) : null}

      {error ? <ErrorNote error={error} /> : null}

      <div className="flex items-center gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving' : 'Save changes'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * The GitHub connection for the Operator, surfaced on a Project. Connecting
 * (Not connected → Connect, or later Reconnect) is entirely separate from
 * configuring which repositories SlideOps offers (Configure repositories,
 * reopenable at any time): the summary below shows the current
 * configuration, never a one-time setup wizard.
 */
export function ProjectGitHub() {
  const canWrite = useCanWrite();
  const { state, reload, refreshing } = useAsyncData((signal) => loadGitHub(signal), []);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState(false);
  const connected = state.status === 'ready' ? state.data.status.connected : null;

  // A fresh Reconnect (or a first Connect) changes the connection under this
  // panel; closing it rather than carrying stale draft state across that is
  // the safe default.
  useEffect(() => {
    setConfiguring(false);
  }, [connected]);

  const connect = () => {
    // The backend answers /github/authorize with a 302 to GitHub, so the browser
    // must navigate there itself rather than fetch it. Pass the current in-app
    // page so the callback returns here rather than the site root.
    const returnPath =
      typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined;
    window.location.href = githubAuthorizeUrl(returnPath);
  };

  const runDisconnect = async () => {
    setActionError(null);
    try {
      await disconnectGitHub();
      setConfirmDisconnect(false);
      reload();
    } catch (error) {
      setConfirmDisconnect(false);
      setActionError(
        error instanceof ApiError ? error.message : 'GitHub could not be disconnected. Try again.',
      );
    }
  };

  return (
    <Section title="GitHub" adornment={<Guidance for="project.github" />}>
      {state.status === 'loading' ? <Loading label="Reading the GitHub connection" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {actionError ? (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      ) : null}
      {state.status === 'ready' ? (
        !state.data.status.configured ? (
          <div className="flex items-start gap-3 rounded-md border border-border bg-subtle p-4">
            <Lock width={16} height={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
            <div>
              <Text variant="body-sm" className="font-medium">
                GitHub is not configured yet
              </Text>
              <Text variant="body-sm" tone="secondary" className="mt-0.5">
                Connecting GitHub needs an OAuth app registered for this platform. Register a GitHub
                OAuth app with the callback at your platform domain and set its client id and secret
                in the server environment. Once that is in place, connecting appears here.
              </Text>
            </div>
          </div>
        ) : !state.data.status.connected ? (
          <div className="flex flex-col gap-4">
            <Text variant="body-sm" tone="secondary">
              Connect your GitHub account so a Service with a repository source can clone on first
              deploy and pull on redeploys. The access token is stored encrypted and never shown.
              Once connected, choose which repositories SlideOps can use — and come back to change
              that at any time.
            </Text>
            {canWrite ? (
              <Button className="self-start" onClick={connect}>
                <GitBranch width={15} height={15} aria-hidden />
                Connect GitHub
              </Button>
            ) : (
              <Text variant="body-sm" tone="secondary">
                Connecting GitHub needs a role above Viewer in this workspace.
              </Text>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Text variant="body-sm" tone="secondary">
                Connected as{' '}
                <span className="font-medium text-ink">
                  {state.data.status.login ?? 'your account'}
                </span>
              </Text>
              {canWrite ? (
                <div className="flex shrink-0 items-center gap-2">
                  {state.data.status.manage_url ? (
                    <a
                      href={state.data.status.manage_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      <ExternalLink width={14} height={14} aria-hidden />
                      Manage GitHub Access
                    </a>
                  ) : null}
                  <Button variant="secondary" size="sm" onClick={connect}>
                    <GitBranch width={14} height={14} aria-hidden />
                    Reconnect
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(true)}>
                    Disconnect
                  </Button>
                </div>
              ) : null}
            </div>

            {state.data.status.manage_url ? (
              <Text variant="caption" tone="secondary">
                Missing a repository that lives in an organization? GitHub keeps organization access
                separate from your own: an org owner has to approve this connection for that
                organization on{' '}
                <a
                  href={state.data.status.manage_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand hover:text-ink"
                >
                  GitHub&apos;s own Manage GitHub Access page
                </a>
                {' '}before it can appear here at all &mdash; no SlideOps setting can substitute for
                that.
              </Text>
            ) : null}

            {state.data.accessError ? (
              <ErrorNote error={state.data.accessError} />
            ) : state.data.access ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <Text variant="body-sm" tone="secondary">
                    {state.data.access.mode === 'all' ? (
                      <>
                        <span className="font-medium text-ink">All repositories.</span> SlideOps can use
                        every repository available to this connection.
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-ink">Selected repositories.</span>{' '}
                        {state.data.access.repos.length} selected.
                      </>
                    )}
                  </Text>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={reload} disabled={refreshing}>
                      <RefreshCw width={14} height={14} aria-hidden />
                      {refreshing ? 'Refreshing' : 'Refresh repositories'}
                    </Button>
                    {canWrite ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfiguring((v) => !v)}
                        aria-expanded={configuring}
                      >
                        <Settings width={14} height={14} aria-hidden />
                        Configure repositories
                      </Button>
                    ) : null}
                  </div>
                </div>

                {state.data.access.unavailable.length > 0 ? (
                  <div className="flex items-start gap-2 rounded-md border border-warning bg-subtle p-3">
                    <AlertTriangle width={16} height={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                    <Text variant="body-sm" tone="secondary">
                      {state.data.access.unavailable.length} selected repositor
                      {state.data.access.unavailable.length === 1 ? 'y is' : 'ies are'} no longer available
                      through GitHub. If it lives in an organization, Manage GitHub Access above is
                      what restores it; Configure repositories only edits SlideOps&apos; own list.
                    </Text>
                  </div>
                ) : null}

                {configuring && canWrite ? (
                  <ConfigurePanel
                    access={state.data.access}
                    onCancel={() => setConfiguring(false)}
                    onSaved={() => {
                      setConfiguring(false);
                      reload();
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        )
      ) : null}

      <ConfirmDialog
        open={confirmDisconnect}
        title="Disconnect GitHub?"
        description="This seals away the stored access token and stops repository deploys from pulling. You can connect again at any time."
        confirmLabel="Disconnect"
        confirmVariant="danger"
        onConfirm={runDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </Section>
  );
}
