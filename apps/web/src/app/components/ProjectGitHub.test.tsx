import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubStatus, GitHubRepo, Workspace } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

const connectedStatus: GitHubStatus = { configured: true, connected: true, login: 'octocat' };
const repos: GitHubRepo[] = [
  {
    full_name: 'octocat/hello-world',
    html_url: 'https://github.com/octocat/hello-world',
    clone_url: 'https://github.com/octocat/hello-world.git',
    default_branch: 'main',
    private: false,
  },
  {
    full_name: 'octocat/spoon-knife',
    html_url: 'https://github.com/octocat/spoon-knife',
    clone_url: 'https://github.com/octocat/spoon-knife.git',
    default_branch: 'main',
    private: false,
  },
];

const disconnectGitHubMock = vi.fn(async () => undefined);
const listGitHubReposMock = vi.fn(async (..._args: unknown[]) => repos);

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
  listGitHubRepos: (...a: unknown[]) => listGitHubReposMock(...a),
  disconnectGitHub: () => disconnectGitHubMock(),
  githubAuthorizeUrl: () => '/api/v1/github/authorize',
}));

const { ProjectGitHub } = await import('./ProjectGitHub');

beforeEach(() => {
  useWorkspaceStore.setState({ workspaces: [ownerWorkspace], loaded: true });
  disconnectGitHubMock.mockClear();
  listGitHubReposMock.mockReset().mockResolvedValue(repos);
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

  it('searches the repository list rather than only ever showing every one', async () => {
    renderInApp(<ProjectGitHub />);
    await screen.findByText('octocat/hello-world');
    expect(screen.getByText('octocat/spoon-knife')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Search repositories...'), 'spoon');

    expect(screen.queryByText('octocat/hello-world')).not.toBeInTheDocument();
    expect(screen.getByText('octocat/spoon-knife')).toBeInTheDocument();
  });

  // A repository just created on GitHub is not visible until the list is read
  // again; there has to be a way to ask for that without leaving the page.
  it('rereads the repository list on Refresh, so a newly created repository can appear', async () => {
    renderInApp(<ProjectGitHub />);
    await screen.findByText('octocat/hello-world');
    expect(listGitHubReposMock).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(listGitHubReposMock).toHaveBeenCalledTimes(2));
  });

  // A failure to read the list used to be swallowed into "no repositories",
  // indistinguishable from an account that truly has none.
  it('says plainly when the repository list itself could not be read', async () => {
    const { ApiError } = await import('@slideops/api-client');
    listGitHubReposMock.mockRejectedValue(new ApiError(500, 'internal', 'the repositories could not be read'));
    renderInApp(<ProjectGitHub />);
    expect(await screen.findByText(/the repositories could not be read/)).toBeInTheDocument();
  });
});
