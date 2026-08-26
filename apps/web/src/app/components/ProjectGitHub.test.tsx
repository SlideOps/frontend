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
];

const disconnectGitHubMock = vi.fn(async () => undefined);

const ownerWorkspace: Workspace = {
  owner_operator_id: 'op_1',
  owner_email: 'me@example.com',
  role: 'owner',
  active: true,
};

const viewerWorkspace: Workspace = {
  owner_operator_id: 'op_9',
  owner_email: 'boss@example.com',
  role: 'viewer',
  active: true,
};

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getGitHubStatus: async () => connectedStatus,
  listGitHubRepos: async () => repos,
  disconnectGitHub: () => disconnectGitHubMock(),
  githubAuthorizeUrl: () => '/api/v1/github/authorize',
}));

const { ProjectGitHub } = await import('./ProjectGitHub');

beforeEach(() => {
  useWorkspaceStore.setState({ workspaces: [ownerWorkspace], loaded: true });
  disconnectGitHubMock.mockClear();
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
});
