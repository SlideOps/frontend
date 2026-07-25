import {
  ApiError,
  disconnectGitHub,
  getGitHubStatus,
  githubAuthorizeUrl,
  listGitHubRepos,
  type GitHubRepo,
  type GitHubStatus,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowUpRight, GitBranch, Lock } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';

interface GitHubData {
  status: GitHubStatus;
  repos: GitHubRepo[];
}

async function loadGitHub(signal: AbortSignal): Promise<GitHubData> {
  const status = await getGitHubStatus(signal);
  // Only read repositories when the Operator is connected; otherwise there is
  // nothing to list and the call would fail.
  const repos = status.connected ? await listGitHubRepos(signal).catch(() => []) : [];
  return { status, repos };
}

/**
 * The GitHub connection for the Operator, surfaced on a Project so a repository
 * deploy can pull. When the platform's OAuth app is not configured this shows an
 * unconfigured note; when configured but not connected it offers Connect; when
 * connected it shows the login, a Disconnect action, and the repositories a
 * deploy can pull from.
 */
export function ProjectGitHub() {
  const { state, reload } = useAsyncData((signal) => loadGitHub(signal), []);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <GitBranch width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">GitHub</Text>
        <Guidance for="project.github" />
      </div>

      {state.status === 'loading' ? <Loading label="Reading the GitHub connection" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {actionError ? (
        <p role="alert" className="mb-3 text-sm text-danger">
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
            <Button className="self-start" onClick={connect}>
              <GitBranch width={15} height={15} aria-hidden />
              Connect GitHub
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Text variant="body-sm" tone="secondary">
                Connected as{' '}
                <span className="font-medium text-ink">{state.data.status.login ?? 'your account'}</span>.
                Deploys can pull from the{' '}
                {state.data.repos.length > 0 ? `${state.data.repos.length} ` : ''}repositories below.
              </Text>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(true)}>
                Disconnect
              </Button>
            </div>

            {state.data.repos.length > 0 ? (
              <div className="max-h-80 overflow-y-auto rounded-md border border-border">
                <ul className="divide-y divide-border">
                  {state.data.repos.map((repo) => (
                    <li key={repo.full_name} className="flex items-center gap-3 px-3 py-2.5">
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
    </Card>
  );
}
