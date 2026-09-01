import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubStatus, GitHubRepo, Node, Project, Workspace } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * Picking a GitHub repository to deploy from: this form only ever offers
 * what an Operator has already added to SlideOps from the Project page's
 * GitHub section (see ProjectGitHub.test.tsx for adding one), not every
 * repository the connected account can reach. That curated, and usually
 * much shorter, list is read fresh every time this screen loads.
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

const listSelectedGitHubReposMock = vi.fn(async (..._args: unknown[]) => repos);

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
  listSelectedGitHubRepos: (...a: unknown[]) => listSelectedGitHubReposMock(...a),
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
  listSelectedGitHubReposMock.mockReset().mockResolvedValue(repos);
});

async function chooseRepositorySource() {
  await userEvent.click(await screen.findByRole('radio', { name: /Repository/ }));
}

describe('ServiceDeploy: GitHub repository picker', () => {
  it('offers every repository added to SlideOps', async () => {
    show();
    await chooseRepositorySource();
    expect(await screen.findByText('acme/web')).toBeInTheDocument();
    expect(screen.getByText('acme/worker')).toBeInTheDocument();
    expect(screen.getByText('personal/blog')).toBeInTheDocument();
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
    listSelectedGitHubReposMock.mockRejectedValue(new ApiError(500, 'internal', 'the repositories could not be read'));
    show();
    await chooseRepositorySource();
    expect(await screen.findByText(/the repositories could not be read/)).toBeInTheDocument();
  });

  it('points at the Project GitHub section when nothing has been added yet', async () => {
    listSelectedGitHubReposMock.mockResolvedValue([]);
    show();
    await chooseRepositorySource();
    // With none added, the picker itself is not offered; a repository URL
    // can still be typed in by hand.
    expect(screen.queryByLabelText('From GitHub (optional)')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://github.com/you/app.git')).toBeInTheDocument();
  });
});
