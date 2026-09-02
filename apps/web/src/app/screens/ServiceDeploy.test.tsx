import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubStatus, GitHubRepo, GitHubRepositoryAccess, Node, Project, Workspace } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * Picking a GitHub repository to deploy from: this form reads whatever is
 * currently configured on the Project page's GitHub section (see
 * ProjectGitHub.test.tsx for configuring it) — every repository the
 * connected account can reach in "all" mode, or only the curated list in
 * "selected" mode — never a one-time snapshot from when GitHub was first
 * connected.
 */

const project: Project = { id: 'p1', name: 'apollo' } as Project;
const node: Node = { id: 'n1', name: 'web-1', address: '10.0.0.1', status: 'reachable' } as Node;
const connectedStatus: GitHubStatus = { configured: true, connected: true, login: 'octocat' };

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

const getGitHubRepositoryAccessMock = vi.fn(
  async (..._args: unknown[]): Promise<GitHubRepositoryAccess> => ({
    mode: 'selected',
    repos,
    unavailable: [],
  }),
);
const listGitHubReposMock = vi.fn(async (..._args: unknown[]) => repos);
const listCapabilitiesMock = vi.fn(async (..._args: unknown[]) => []);

const ownerWorkspace: Workspace = {
  id: 'ws_1',
  name: 'Personal',
  is_personal: true,
  role: 'owner',
  active: true,
};

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listProjects: async () => [project],
  listNodes: async () => [node],
  getGitHubStatus: async () => connectedStatus,
  getGitHubRepositoryAccess: (...a: unknown[]) => getGitHubRepositoryAccessMock(...a),
  listGitHubRepos: (...a: unknown[]) => listGitHubReposMock(...a),
  listCapabilities: (...a: unknown[]) => listCapabilitiesMock(...a),
}));

const { ServiceDeploy } = await import('./ServiceDeploy');

function show() {
  return renderInApp(
    <MemoryRouter>
      <ServiceDeploy />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useWorkspaceStore.setState({ workspaces: [ownerWorkspace], loaded: true });
  getGitHubRepositoryAccessMock.mockReset().mockResolvedValue({ mode: 'selected', repos, unavailable: [] });
  listGitHubReposMock.mockReset().mockResolvedValue(repos);
});

// Deploy Service now opens on the Software/Capabilities chooser; every one of
// these tests exercises the Software path, so this walks through it first.
// The Software card renders first, so its Continue button is the first one.
async function chooseRepositorySource() {
  await screen.findByText('Software');
  const buttons = await screen.findAllByRole('button', { name: /Continue/ });
  await userEvent.click(buttons[0]!);
  await userEvent.click(await screen.findByRole('radio', { name: /Repository/ }));
}

describe('ServiceDeploy: GitHub repository picker', () => {
  it('offers what is configured in selected mode', async () => {
    show();
    await chooseRepositorySource();
    expect(await screen.findByText('acme/web')).toBeInTheDocument();
    expect(screen.getByText('acme/worker')).toBeInTheDocument();
    expect(screen.getByText('personal/blog')).toBeInTheDocument();
    expect(listGitHubReposMock).not.toHaveBeenCalled();
  });

  it('offers the full connected account in all mode', async () => {
    getGitHubRepositoryAccessMock.mockResolvedValue({ mode: 'all', repos: [], unavailable: [] });
    show();
    await chooseRepositorySource();
    expect(await screen.findByText('acme/web')).toBeInTheDocument();
    expect(listGitHubReposMock).toHaveBeenCalled();
  });

  it('searches the list rather than only ever showing every repository', async () => {
    show();
    await chooseRepositorySource();
    await screen.findByText('acme/web');

    await userEvent.type(screen.getByPlaceholderText('Search repositories...'), 'worker');

    expect(screen.queryByText('acme/web')).not.toBeInTheDocument();
    expect(screen.queryByText('personal/blog')).not.toBeInTheDocument();
    expect(screen.getByText('acme/worker')).toBeInTheDocument();
  });

  it('fills the repository URL and branch when a repository is picked', async () => {
    show();
    await chooseRepositorySource();
    await userEvent.selectOptions(await screen.findByLabelText('From GitHub (optional)'), 'acme/worker');

    await waitFor(() =>
      expect(screen.getByPlaceholderText('https://github.com/you/app.git')).toHaveValue(
        'https://github.com/acme/worker.git',
      ),
    );
  });

  it('says plainly when the repository list itself could not be read', async () => {
    const { ApiError } = await import('@slideops/api-client');
    getGitHubRepositoryAccessMock.mockRejectedValue(new ApiError(500, 'internal', 'the repositories could not be read'));
    show();
    await chooseRepositorySource();
    expect(await screen.findByText(/the repositories could not be read/)).toBeInTheDocument();
  });

  it('points at Configure repositories when nothing has been configured yet', async () => {
    getGitHubRepositoryAccessMock.mockResolvedValue({ mode: 'selected', repos: [], unavailable: [] });
    show();
    await chooseRepositorySource();
    // With none configured, the picker itself is not offered; a repository
    // URL can still be typed in by hand.
    expect(screen.queryByLabelText('From GitHub (optional)')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://github.com/you/app.git')).toBeInTheDocument();
  });
});

describe('ServiceDeploy: the Software / Capabilities chooser', () => {
  it('opens on a chooser rather than straight into the software form', async () => {
    show();
    expect(await screen.findByRole('heading', { name: 'Software' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Capabilities' })).toBeInTheDocument();
    // Neither path's own content is on screen until one is chosen.
    expect(screen.queryByPlaceholderText('https://github.com/you/app.git')).not.toBeInTheDocument();
  });

  it('picking Capabilities opens that flow and never touches GitHub', async () => {
    show();
    await screen.findByRole('heading', { name: 'Capabilities' });
    const buttons = await screen.findAllByRole('button', { name: /Continue/ });
    await userEvent.click(buttons[1]!);

    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
    expect(getGitHubRepositoryAccessMock).not.toHaveBeenCalled();
    expect(listGitHubReposMock).not.toHaveBeenCalled();
  });
});
