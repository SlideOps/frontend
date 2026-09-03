import { describe, expect, it } from 'vitest';
import type { GitHubRepo } from '@slideops/api-client';
import { filterGitHubRepos } from './github-repos';

function repo(fullName: string): GitHubRepo {
  return {
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    clone_url: `https://github.com/${fullName}.git`,
    default_branch: 'main',
    private: false,
  };
}

const repos = [repo('acme/web'), repo('acme/worker'), repo('personal/blog')];

describe('filterGitHubRepos', () => {
  it('matches anywhere in the full name, not just the start', () => {
    expect(filterGitHubRepos(repos, 'work').map((r) => r.full_name)).toEqual(['acme/worker']);
  });

  it('matches the owner as well as the repository name', () => {
    expect(filterGitHubRepos(repos, 'acme').map((r) => r.full_name)).toEqual(['acme/web', 'acme/worker']);
  });

  it('is case insensitive', () => {
    expect(filterGitHubRepos(repos, 'WEB').map((r) => r.full_name)).toEqual(['acme/web']);
  });

  it('returns everything for an empty or blank query', () => {
    expect(filterGitHubRepos(repos, '')).toHaveLength(3);
    expect(filterGitHubRepos(repos, '   ')).toHaveLength(3);
  });

  it('returns nothing rather than throwing when nothing matches', () => {
    expect(filterGitHubRepos(repos, 'nonexistent')).toEqual([]);
  });
});
