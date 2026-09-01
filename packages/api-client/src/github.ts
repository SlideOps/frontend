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
 * find one to add or remove; see `getGitHubRepositoryAccess` for what
 * SlideOps currently actually offers, which is what a deploy picker reads.
 */
export function listGitHubRepos(signal?: AbortSignal): Promise<GitHubRepo[]> {
  return apiRequest<unknown>('/github/repos', { signal }).then((r) =>
    unwrap<GitHubRepo[]>(r, 'repos'),
  );
}

/** Whether SlideOps offers every repository a connection can reach, or only
 *  a curated `selected` subset of it. Never a GitHub-side permission: the
 *  OAuth app SlideOps connects through grants its token everything at
 *  connect time either way, since it has no per-repository consent screen
 *  the way a GitHub App's installation picker does. */
export type GitHubAccessMode = 'all' | 'selected';

/**
 * What SlideOps currently offers out of a connected account. In `all` mode,
 * `repos` is empty and not meaningful. In `selected` mode, `repos` is every
 * added repository still reachable right now, read fresh from GitHub rather
 * than from anything stored; `unavailable` names anything previously added
 * that GitHub can no longer reach at all (renamed, deleted, access revoked)
 * — it is surfaced, never silently dropped from what was configured.
 */
export interface GitHubRepositoryAccess {
  mode: GitHubAccessMode;
  repos: GitHubRepo[];
  unavailable: string[];
}

/**
 * Read what SlideOps currently offers: the access mode, and, in `selected`
 * mode, the curated repository list. This is a persistent, reconfigurable
 * setting on the one GitHub connection, read fresh every time — never a
 * one-time choice made at connect.
 */
export function getGitHubRepositoryAccess(signal?: AbortSignal): Promise<GitHubRepositoryAccess> {
  return apiRequest<GitHubRepositoryAccess>('/github/repos/selected', { signal });
}

/**
 * Set the access mode and, in `selected` mode, the whole set of repositories
 * to keep added, together, replacing whatever was configured before. This is
 * a reconfiguration of the existing connection, never a new one: call it
 * again at any time — to add a repository created after connecting, to
 * remove one, or to switch modes entirely — with no need to reconnect
 * GitHub first. Only a name the connected token can actually reach right now
 * is kept; anything else is silently dropped rather than stored as a broken
 * reference. Switching to `all` and back to `selected` later restores
 * whatever `repos` a prior `selected` save had, regardless of what `repos`
 * is passed on the switch to `all` (send an empty array; it is ignored).
 */
export function setGitHubRepositoryAccess(
  mode: GitHubAccessMode,
  repos: string[],
): Promise<GitHubRepositoryAccess> {
  return apiRequest<GitHubRepositoryAccess>('/github/repos/selected', {
    method: 'PUT',
    body: { mode, repos },
  });
}
