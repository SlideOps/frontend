import {
  ApiError,
  disconnectGitHub,
  getGitHubStatus,
  githubAuthorizeUrl,
  listGitHubRepos,
  listSelectedGitHubRepos,
  setSelectedGitHubRepos,
  type GitHubRepo,
  type GitHubStatus,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { ArrowUpRight, GitBranch, Lock, Plus, RefreshCw, Search, X } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useMemo, useState } from 'react';
import { useCanWrite } from '../../store/workspace';
import { useAsyncData } from '../hooks/useAsyncData';
import { filterGitHubRepos } from '../github-repos';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';

interface GitHubData {
  status: GitHubStatus;
  // The repositories the Operator has explicitly added, out of everything
  // their connected account can reach. What a deploy picker reads from.
  selected: GitHubRepo[];
  // Set when connected but the curated list itself could not be read, so
  // that is shown for what it is rather than as "you have added nothing".
  selectedError: ApiError | null;
}

async function loadGitHub(signal: AbortSignal): Promise<GitHubData> {
  const status = await getGitHubStatus(signal);
  if (!status.connected) {
    return { status, selected: [], selectedError: null };
  }
  try {
    const selected = await listSelectedGitHubRepos(signal);
    return { status, selected, selectedError: null };
  } catch (error) {
    return {
      status,
      selected: [],
      selectedError:
        error instanceof ApiError ? error : new ApiError(0, 'unknown_error', 'The repositories could not be read.'),
    };
  }
}

const searchInputClass =
  'h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** A search box with its icon, shared by the added list and the browse panel. */
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
 * Browsing everything a connected account can reach, to add one to SlideOps.
 * Fetched only once this is opened, live, every time: GitHub's OAuth app has
 * no separate per-repository consent step, so a repository created after
 * connecting is reachable the moment this list is read, with nothing to
 * grant on GitHub's side first.
 */
function AddRepositoriesPanel({
  alreadyAdded,
  onAdd,
  addingRepo,
}: {
  alreadyAdded: Set<string>;
  onAdd: (repo: GitHubRepo) => void;
  addingRepo: string | null;
}) {
  const { state, reload, refreshing } = useAsyncData((signal) => listGitHubRepos(signal), []);
  const [search, setSearch] = useState('');
  const all = state.status === 'ready' ? state.data : [];
  const addable = useMemo(
    () => filterGitHubRepos(all, search).filter((repo) => !alreadyAdded.has(repo.full_name)),
    [all, search, alreadyAdded],
  );

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-subtle p-3">
      <div className="flex items-center justify-between gap-2">
        <Text variant="body-sm" className="font-medium text-ink">
          Add repositories
        </Text>
        <Button variant="ghost" size="sm" onClick={reload} disabled={refreshing}>
          <RefreshCw width={14} height={14} aria-hidden />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </Button>
      </div>
      {state.status === 'loading' ? <Loading label="Reading your GitHub repositories" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        all.length === 0 ? (
          <Text variant="body-sm" tone="secondary">
            No repositories are visible to this GitHub account yet.
          </Text>
        ) : (
          <>
            <RepoSearchBox value={search} onChange={setSearch} ariaLabel="Search repositories to add" />
            {addable.length > 0 ? (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-surface">
                <ul className="divide-y divide-border">
                  {addable.map((repo) => (
                    <li key={repo.full_name} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink">{repo.full_name}</span>
                          {repo.private ? (
                            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                              <Lock width={11} height={11} aria-hidden />
                              Private
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onAdd(repo)}
                        disabled={addingRepo === repo.full_name}
                      >
                        <Plus width={14} height={14} aria-hidden />
                        {addingRepo === repo.full_name ? 'Adding' : 'Add'}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Text variant="body-sm" tone="secondary">
                {search
                  ? `No repository matches "${search}".`
                  : 'Every repository this account can reach has already been added.'}
              </Text>
            )}
          </>
        )
      ) : null}
    </div>
  );
}

/**
 * The GitHub connection for the Operator, surfaced on a Project so a repository
 * deploy can pull. When the platform's OAuth app is not configured this shows an
 * unconfigured note; when configured but not connected it offers Connect; when
 * connected it shows the login, a Disconnect action, and the repositories
 * actually added to SlideOps, with a way to browse, search, and add more at
 * any time.
 */
export function ProjectGitHub() {
  const canWrite = useCanWrite();
  const { state, reload } = useAsyncData((signal) => loadGitHub(signal), []);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [pendingRepo, setPendingRepo] = useState<string | null>(null);

  const selected = state.status === 'ready' ? state.data.selected : [];
  const visibleSelected = useMemo(() => filterGitHubRepos(selected, search), [selected, search]);
  const selectedNames = useMemo(() => new Set(selected.map((repo) => repo.full_name)), [selected]);

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

  const addRepo = async (repo: GitHubRepo) => {
    setActionError(null);
    setPendingRepo(repo.full_name);
    try {
      await setSelectedGitHubRepos([...selected.map((r) => r.full_name), repo.full_name]);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That repository could not be added. Try again.',
      );
    } finally {
      setPendingRepo(null);
    }
  };

  const removeRepo = async (repo: GitHubRepo) => {
    setActionError(null);
    setPendingRepo(repo.full_name);
    try {
      await setSelectedGitHubRepos(selected.filter((r) => r.full_name !== repo.full_name).map((r) => r.full_name));
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That repository could not be removed. Try again.',
      );
    } finally {
      setPendingRepo(null);
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
                {selected.length > 0 ? `${selected.length} repositor${selected.length === 1 ? 'y' : 'ies'}` : 'repositories'}{' '}
                added below.
              </Text>
              {canWrite ? (
                <div className="flex shrink-0 items-center gap-2">
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
                Only what you add below is offered to a deploy. Don&apos;t see a whole organization
                at all? Reconnect and grant access to it on GitHub&apos;s authorization screen; this
                re-runs the same consent flow without disconnecting first, so nothing already
                deployed is affected.
              </Text>
            ) : null}

            {state.data.selectedError ? (
              <ErrorNote error={state.data.selectedError} />
            ) : (
              <div className="flex flex-col gap-2">
                {selected.length > 0 ? (
                  <>
                    <RepoSearchBox value={search} onChange={setSearch} ariaLabel="Search your added repositories" />
                    {visibleSelected.length > 0 ? (
                      <div className="max-h-80 overflow-y-auto rounded-md border border-border">
                        <ul className="divide-y divide-border">
                          {visibleSelected.map((repo) => (
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
                              {canWrite ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void removeRepo(repo)}
                                  disabled={pendingRepo === repo.full_name}
                                  aria-label={`Remove ${repo.full_name}`}
                                >
                                  <X width={14} height={14} aria-hidden />
                                </Button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <Text variant="body-sm" tone="secondary">
                        No added repository matches &ldquo;{search}&rdquo;.
                      </Text>
                    )}
                  </>
                ) : (
                  <Text variant="body-sm" tone="secondary">
                    You haven&apos;t added a repository yet. Add one below to make it available on a
                    Service&apos;s deploy form.
                  </Text>
                )}

                {canWrite ? (
                  showAddPanel ? (
                    <AddRepositoriesPanel alreadyAdded={selectedNames} onAdd={(repo) => void addRepo(repo)} addingRepo={pendingRepo} />
                  ) : (
                    <Button variant="secondary" size="sm" className="self-start" onClick={() => setShowAddPanel(true)}>
                      <Plus width={14} height={14} aria-hidden />
                      Add repositories
                    </Button>
                  )
                ) : null}
              </div>
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
