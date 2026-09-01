import type { GitHubRepo } from '@slideops/api-client';

/**
 * Narrows a connected account's repositories to the ones whose name matches
 * query, case insensitively, against the "owner/name" full name. An empty
 * query matches everything, so a picker with nothing typed yet shows the
 * whole list rather than nothing.
 */
export function filterGitHubRepos(repos: GitHubRepo[], query: string): GitHubRepo[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return repos;
  }
  return repos.filter((repo) => repo.full_name.toLowerCase().includes(q));
}
