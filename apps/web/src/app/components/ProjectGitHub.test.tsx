import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubStatus, GitHubRepo, Workspace } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * Curating which of a connected account's repositories a Service can deploy
 * from, out of everything the OAuth token can reach.
 *
 * GitHub's classic OAuth app has no per-repository consent step the way a
 * GitHub App's installation picker does, so the account's full list is
 * always live and always complete the moment it is read; the only thing
 * that was actually missing was a way to add more of it to SlideOps at any
 * time, not just once.
 */

const connectedStatus: GitHubStatus = { configured: true, connected: true, login: 'octocat' };

function repo(fullName: string, overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    clone_url: `https://github.com/${fullName}.git`,
    default_branch: 'main',
    private: false,
    ...overrides,
  };
}

const added = [repo('octocat/hello-world')];
const everything = [repo('octocat/hello-world'), repo('octocat/spoon-knife'), repo('acme/worker')];

const disconnectGitHubMock = vi.fn(async () => undefined);
const listSelectedGitHubReposMock = vi.fn(async (..._a: unknown[]) => added);
const listGitHubReposMock = vi.fn(async (..._a: unknown[]) => everything);
const setSelectedGitHubReposMock = vi.fn(async (fullNames: string[]) =>
  everything.filter((r) => fullNames.includes(r.full_name)),
);

const ownerWorkspace: Workspace = {
  id: 'ws_1',
  name: 'Personal',
  is_personal: true,
  role: 'owner',
  active: true,
};

const viewerWorkspace: Workspace = {
  id: 'ws_9',
  name: 'Client X',
  is_personal: false,
  role: 'viewer',
  active: true,
};

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getGitHubStatus: async () => connectedStatus,
  listSelectedGitHubRepos: (...a: unknown[]) => listSelectedGitHubReposMock(...a),
  listGitHubRepos: (...a: unknown[]) => listGitHubReposMock(...a),
  setSelectedGitHubRepos: (fullNames: string[]) => setSelectedGitHubReposMock(fullNames),
  disconnectGitHub: () => disconnectGitHubMock(),
  githubAuthorizeUrl: () => '/api/v1/github/authorize',
}));

const { ProjectGitHub } = await import('./ProjectGitHub');

beforeEach(() => {
  useWorkspaceStore.setState({ workspaces: [ownerWorkspace], loaded: true });
  disconnectGitHubMock.mockClear();
  listSelectedGitHubReposMock.mockReset().mockResolvedValue(added);
  listGitHubReposMock.mockReset().mockResolvedValue(everything);
  setSelectedGitHubReposMock
    .mockReset()
    .mockImplementation(async (fullNames: string[]) => everything.filter((r) => fullNames.includes(r.full_name)));
});

describe('ProjectGitHub', () => {
  it('offers Reconnect and Disconnect to an Owner', async () => {
    renderInApp(<ProjectGitHub />);
    expect(await screen.findByText('octocat/hello-world')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
  });

  it('hides Reconnect and Disconnect for a Viewer, who would 403 on either', async () => {
    useWorkspaceStore.setState({ workspaces: [viewerWorkspace], loaded: true });
    renderInApp(<ProjectGitHub />);
    await screen.findByText('octocat/hello-world');
    expect(screen.queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
  });

  it('an Owner can disconnect after confirming', async () => {
    renderInApp(<ProjectGitHub />);
    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(disconnectGitHubMock).toHaveBeenCalled());
  });

  it('shows only what was added, not everything the account can reach', async () => {
    renderInApp(<ProjectGitHub />);
    expect(await screen.findByText('octocat/hello-world')).toBeInTheDocument();
    // The full account list is not fetched at all until Add repositories is
    // opened: the two other repos must not appear here.
    expect(screen.queryByText('acme/worker')).not.toBeInTheDocument();
    expect(listGitHubReposMock).not.toHaveBeenCalled();
  });

  it('searches what has been added', async () => {
    listSelectedGitHubReposMock.mockResolvedValue(everything);
    renderInApp(<ProjectGitHub />);
    await screen.findByText('octocat/hello-world');

    await userEvent.type(screen.getByLabelText('Search your added repositories'), 'worker');

    expect(screen.queryByText('octocat/hello-world')).not.toBeInTheDocument();
    expect(screen.getByText('acme/worker')).toBeInTheDocument();
  });

  it('says plainly when nothing has been added yet', async () => {
    listSelectedGitHubReposMock.mockResolvedValue([]);
    renderInApp(<ProjectGitHub />);
    expect(await screen.findByText(/haven.t added a repository yet/)).toBeInTheDocument();
  });

  it('says plainly when the added list itself could not be read', async () => {
    const { ApiError } = await import('@slideops/api-client');
    listSelectedGitHubReposMock.mockRejectedValue(new ApiError(500, 'internal', 'the repositories could not be read'));
    renderInApp(<ProjectGitHub />);
    expect(await screen.findByText(/the repositories could not be read/)).toBeInTheDocument();
  });

  it('opens Add repositories, browses the full account, and adds one', async () => {
    renderInApp(<ProjectGitHub />);
    await screen.findByText('octocat/hello-world');

    await userEvent.click(screen.getByRole('button', { name: 'Add repositories' }));
    expect(await screen.findByText('acme/worker')).toBeInTheDocument();
    // Already added, so it must not be offered a second time in the add panel:
    // one occurrence, in the added list above, and no more.
    expect(screen.getAllByText('octocat/hello-world')).toHaveLength(1);

    const row = screen.getByText('acme/worker').closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: /Add/ }));

    await waitFor(() =>
      expect(setSelectedGitHubReposMock).toHaveBeenCalledWith(['octocat/hello-world', 'acme/worker']),
    );
  });

  it('searches the add panel separately from the added list', async () => {
    renderInApp(<ProjectGitHub />);
    await screen.findByText('octocat/hello-world');
    await userEvent.click(screen.getByRole('button', { name: 'Add repositories' }));
    await screen.findByText('acme/worker');

    await userEvent.type(screen.getByLabelText('Search repositories to add'), 'spoon');

    expect(screen.queryByText('acme/worker')).not.toBeInTheDocument();
    expect(screen.getByText('octocat/spoon-knife')).toBeInTheDocument();
  });

  it('removes an added repository', async () => {
    listSelectedGitHubReposMock.mockResolvedValue([repo('octocat/hello-world'), repo('acme/worker')]);
    renderInApp(<ProjectGitHub />);
    await screen.findByText('acme/worker');

    await userEvent.click(screen.getByRole('button', { name: 'Remove acme/worker' }));

    await waitFor(() => expect(setSelectedGitHubReposMock).toHaveBeenCalledWith(['octocat/hello-world']));
  });
});
