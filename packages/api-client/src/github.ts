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
export function githubAuthorizeUrl(): string {
  const base = apiBase();
  const origin =
    typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';
  return new URL(`${base}/github/authorize`, origin).toString();
}

/** Disconnect this Operator's GitHub account, sealing away the stored token. */
export function disconnectGitHub(): Promise<void> {
  return apiRequest<void>('/github', { method: 'DELETE' });
}

/** List the repositories the connected Operator can reach. */
export function listGitHubRepos(signal?: AbortSignal): Promise<GitHubRepo[]> {
  return apiRequest<unknown>('/github/repos', { signal }).then((r) =>
    unwrap<GitHubRepo[]>(r, 'repos'),
  );
}
