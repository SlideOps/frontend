import { apiBase, apiRequest, unwrap } from './http';

/*
 * The GitHub surface, all on the Operator session. The platform runs an OAuth
 * app the Operator registered: it reports whether that app is configured and
 * whether this Operator has connected, starts the authorize redirect, lists the
 * repositories the connected Operator can reach, and disconnects. The token is a
 * secret sealed by the backend and never returned here. Like the rest of the
 * client, every call is same origin and sends the session cookie.
 */

/**
 * The GitHub connection state. `configured` is whether the platform's OAuth app
 * is set up at all; `connected` is whether this Operator has linked their
 * account; `login` is the linked GitHub login when connected.
 */
export interface GitHubStatus {
  configured: boolean;
  connected: boolean;
  login?: string;
}

/** One repository the connected Operator can reach, enough to select and clone it. */
export interface GitHubRepo {
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  clone_url: string;
}

/** Read whether GitHub is configured and whether this Operator is connected. */
export function getGitHubStatus(signal?: AbortSignal): Promise<GitHubStatus> {
  return apiRequest<unknown>('/github/status', { signal }).then((r) =>
    unwrap<GitHubStatus>(r, 'status'),
  );
}

/**
 * The absolute URL that starts the OAuth authorize redirect. The browser must
 * navigate here itself, since the backend answers with a 302 to GitHub, so this
 * returns the string to send `window.location` to rather than fetching it. It is
 * built from the same API base the other requests use.
 */
export function githubAuthorizeUrl(returnPath?: string): string {
  const base = apiBase();
  const origin =
    typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';
  const url = new URL(`${base}/github/authorize`, origin);
  // Carry the in-app page to come back to, so the callback returns the Operator
  // to where they connected from rather than the site root.
  if (returnPath) {
    url.searchParams.set('return', returnPath);
  }
  return url.toString();
}

/** Disconnect this Operator's GitHub account, sealing away the stored token. */
export function disconnectGitHub(): Promise<void> {
  return apiRequest<void>('/github', { method: 'DELETE' });
}

/**
 * List every repository the connected Operator can reach, always read fresh
 * from GitHub. This is the full account, meant for browsing and searching to
 * find one to add; see `listSelectedGitHubRepos` for the smaller, curated
 * list an Operator has actually added, which is what a deploy picker reads.
 */
export function listGitHubRepos(signal?: AbortSignal): Promise<GitHubRepo[]> {
  return apiRequest<unknown>('/github/repos', { signal }).then((r) =>
    unwrap<GitHubRepo[]>(r, 'repos'),
  );
}

/**
 * List the repositories the Operator has explicitly added to SlideOps, out of
 * everything their connected account can reach. Empty until
 * `setSelectedGitHubRepos` has been called at least once. Each one is read
 * back fresh: one that was renamed, deleted, or is no longer reachable simply
 * does not appear.
 */
export function listSelectedGitHubRepos(signal?: AbortSignal): Promise<GitHubRepo[]> {
  return apiRequest<unknown>('/github/repos/selected', { signal }).then((r) =>
    unwrap<GitHubRepo[]>(r, 'repos'),
  );
}

/**
 * Replace the whole set of repositories added to SlideOps with fullNames.
 * This is how both adding one and removing one are done: send the complete
 * list to keep, not just the change. Call it again at any time to add a
 * repository created after connecting; GitHub has no separate per-repository
 * consent step for the OAuth app SlideOps uses, so there is nothing to grant
 * on GitHub's side first. Only a name the connected token can actually reach
 * right now is kept.
 */
export function setSelectedGitHubRepos(fullNames: string[]): Promise<GitHubRepo[]> {
  return apiRequest<unknown>('/github/repos/selected', {
    method: 'PUT',
    body: { repos: fullNames },
  }).then((r) => unwrap<GitHubRepo[]>(r, 'repos'));
}
