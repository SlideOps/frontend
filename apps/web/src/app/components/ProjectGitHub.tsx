import {
  ApiError,
  disconnectGitHub,
  getGitHubStatus,
  githubAuthorizeUrl,
  listGitHubRepos,
  type GitHubRepo,
  type GitHubStatus,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { ArrowUpRight, GitBranch, Lock, RefreshCw, Search } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useMemo, useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { useAsyncData } from '../hooks/useAsyncData';
import { filterGitHubRepos } from '../github-repos';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';

interface GitHubData {
  status: GitHubStatus;
  repos: GitHubRepo[];
  // Set when the Operator is connected but the repository list itself could
  // not be read, so that is shown for what it is rather than as "you have no
  // repositories", which a swallowed failure used to read as.
  reposError: ApiError | null;
}

async function loadGitHub(signal: AbortSignal): Promise<GitHubData> {
  const status = await getGitHubStatus(signal);
  if (!status.connected) {
    return { status, repos: [], reposError: null };
  }
  try {
    const repos = await listGitHubRepos(signal);
    return { status, repos, reposError: null };
  } catch (error) {
    return {
      status,
      repos: [],
      reposError:
        error instanceof ApiError ? error : new ApiError(0, 'unknown_error', 'The repositories could not be read.'),
    };
  }
}

/**
 * The GitHub connection for the Operator, surfaced on a Project so a repository
 * deploy can pull. When the platform's OAuth app is not configured this shows an
 * unconfigured note; when configured but not connected it offers Connect; when
 * connected it shows the login, a Disconnect action, and the repositories a
 * deploy can pull from.
 */
export function ProjectGitHub() {
  const canWrite = useCanWrite();
  const { state, reload, refreshing } = useAsyncData((signal) => loadGitHub(signal), []);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const allRepos = state.status === 'ready' ? state.data.repos : [];
  const visibleRepos = useMemo(() => filterGitHubRepos(allRepos, search), [allRepos, search]);

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
                . Deploys can pull from the{' '}
                {allRepos.length > 0 ? `${allRepos.length} ` : ''}repositories below.
              </Text>
              {canWrite ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={reload} disabled={refreshing}>
                    <RefreshCw width={14} height={14} aria-hidden />
                    {refreshing ? 'Refreshing' : 'Refresh'}
                  </Button>
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

            {canWrite ? (
              <Text variant="caption" tone="secondary">
                Just created a repository on GitHub? Refresh above to pull the current list &mdash;
                it is always read fresh, never cached. Don&apos;t see a whole organization at all?
                Reconnect and grant access to it on GitHub&apos;s authorization screen; this re-runs
                the same consent flow without disconnecting first, so nothing already deployed is
                affected.
              </Text>
            ) : null}

            {state.data.reposError ? (
              <ErrorNote error={state.data.reposError} />
            ) : allRepos.length > 0 ? (
              <div className="flex flex-col gap-2">
                <label className="relative block">
                  <Search
                    width={14}
                    height={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search repositories..."
                    aria-label="Search repositories"
                    className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  />
                </label>
                {visibleRepos.length > 0 ? (
                  <div className="max-h-80 overflow-y-auto rounded-md border border-border">
                    <ul className="divide-y divide-border">
                      {visibleRepos.map((repo) => (
                        <li key={repo.full_name} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-ink">
                                {repo.full_name}
                              </span>
                              {repo.private ? (
                                <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                                  <Lock width={11} height={11} aria-hidden />
                                  Private
                                </span>
                              ) : null}
                            </div>
                            <Text variant="caption" tone="secondary" className="block">
                              Default branch {repo.default_branch}
                            </Text>
                          </div>
                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 text-sm text-brand transition-colors duration-fast ease-standard hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            Open
                            <ArrowUpRight width={14} height={14} aria-hidden />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <Text variant="body-sm" tone="secondary">
                    No repository matches &ldquo;{search}&rdquo;.
                  </Text>
                )}
              </div>
            ) : (
              <Text variant="body-sm" tone="secondary">
                No repositories are visible to this GitHub account yet.
              </Text>
            )}
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
