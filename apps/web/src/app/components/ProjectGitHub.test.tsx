import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubStatus, GitHubRepo, GitHubRepositoryAccess, Workspace } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { useWorkspaceStore } from '../../store/workspace';

/*
 * Connecting GitHub and configuring which repositories SlideOps offers are
 * two separate operations. Connecting shows a persistent summary of the
 * current configuration, not a one-time wizard; Configure repositories
 * reopens a staged editor at any time, never requiring a Reconnect to add,
 * remove, or wholesale switch between All and Selected.
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

const everything = [repo('octocat/hello-world'), repo('octocat/spoon-knife'), repo('acme/worker')];

const disconnectGitHubMock = vi.fn(async () => undefined);
const getGitHubRepositoryAccessMock = vi.fn(
  async (..._a: unknown[]): Promise<GitHubRepositoryAccess> => ({
    mode: 'selected',
    repos: [repo('octocat/hello-world')],
    unavailable: [],
  }),
);
const listGitHubReposMock = vi.fn(async (..._a: unknown[]) => everything);
const setGitHubRepositoryAccessMock = vi.fn(async (mode: 'all' | 'selected', names: string[]) => ({
  mode,
  repos: mode === 'selected' ? everything.filter((r) => names.includes(r.full_name)) : [],
  unavailable: [] as string[],
}));

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
  getGitHubRepositoryAccess: (...a: unknown[]) => getGitHubRepositoryAccessMock(...a),
  listGitHubRepos: (...a: unknown[]) => listGitHubReposMock(...a),
  setGitHubRepositoryAccess: (mode: 'all' | 'selected', names: string[]) =>
    setGitHubRepositoryAccessMock(mode, names),
  disconnectGitHub: () => disconnectGitHubMock(),
  githubAuthorizeUrl: () => '/api/v1/github/authorize',
}));

const { ProjectGitHub } = await import('./ProjectGitHub');

beforeEach(() => {
  useWorkspaceStore.setState({ workspaces: [ownerWorkspace], loaded: true });
  disconnectGitHubMock.mockClear();
  getGitHubRepositoryAccessMock
    .mockReset()
    .mockResolvedValue({ mode: 'selected', repos: [repo('octocat/hello-world')], unavailable: [] });
  listGitHubReposMock.mockReset().mockResolvedValue(everything);
  setGitHubRepositoryAccessMock.mockReset().mockImplementation(async (mode, names) => ({
    mode,
    repos: mode === 'selected' ? everything.filter((r) => names.includes(r.full_name)) : [],
    unavailable: [],
  }));
});

async function openConfigure() {
  await userEvent.click(await screen.findByRole('button', { name: 'Configure repositories' }));
}

describe('ProjectGitHub', () => {
  it('offers Reconnect and Disconnect to an Owner', async () => {
    renderInApp(<ProjectGitHub />);
    expect(await screen.findByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
  });

  it('hides Reconnect and Disconnect for a Viewer, who would 403 on either', async () => {
    useWorkspaceStore.setState({ workspaces: [viewerWorkspace], loaded: true });
    renderInApp(<ProjectGitHub />);
    await screen.findByText(/Connected as/);
    expect(screen.queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
    // Nor can a Viewer reconfigure repository access.
    expect(screen.queryByRole('button', { name: 'Configure repositories' })).not.toBeInTheDocument();
  });

  it('an Owner can disconnect after confirming', async () => {
    renderInApp(<ProjectGitHub />);
    await userEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(disconnectGitHubMock).toHaveBeenCalled());
  });

  it('shows the current configuration as a persistent summary, not a one-time setup', async () => {
    renderInApp(<ProjectGitHub />);
    expect(await screen.findByText(/Selected repositories\./)).toBeInTheDocument();
    expect(screen.getByText(/1 selected\./)).toBeInTheDocument();
    // The full account is not fetched at all until Configure is opened.
    expect(listGitHubReposMock).not.toHaveBeenCalled();
  });

  it('says plainly when the configuration itself could not be read', async () => {
    const { ApiError } = await import('@slideops/api-client');
    getGitHubRepositoryAccessMock.mockRejectedValue(new ApiError(500, 'internal', 'the repositories could not be read'));
    renderInApp(<ProjectGitHub />);
    expect(await screen.findByText(/the repositories could not be read/)).toBeInTheDocument();
  });

  it('warns when a previously added repository is no longer available, without hiding it silently', async () => {
    getGitHubRepositoryAccessMock.mockResolvedValue({
      mode: 'selected',
      repos: [],
      unavailable: ['octocat/gone'],
    });
    renderInApp(<ProjectGitHub />);
    expect(await screen.findByText(/1 selected repository is no longer available/)).toBeInTheDocument();
  });

  it('shows All repositories plainly when that is the current mode', async () => {
    getGitHubRepositoryAccessMock.mockResolvedValue({ mode: 'all', repos: [], unavailable: [] });
    renderInApp(<ProjectGitHub />);
    expect(await screen.findByText(/All repositories\./)).toBeInTheDocument();
  });

  it('opens Configure with the current selection already checked, staged, not yet saved', async () => {
    renderInApp(<ProjectGitHub />);
    await openConfigure();

    const helloWorldRow = await screen.findByText('octocat/hello-world');
    const checkbox = within(helloWorldRow.closest('li')!).getByRole('checkbox');
    expect(checkbox).toBeChecked();
    expect(setGitHubRepositoryAccessMock).not.toHaveBeenCalled();
  });

  it('does not call the API until Save changes, and Cancel discards the staged edit', async () => {
    renderInApp(<ProjectGitHub />);
    await openConfigure();
    const workerRow = await screen.findByText('acme/worker');
    await userEvent.click(within(workerRow.closest('li')!).getByRole('checkbox'));

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(setGitHubRepositoryAccessMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('saves the staged selection as one call, adding and keeping what was checked', async () => {
    renderInApp(<ProjectGitHub />);
    await openConfigure();
    const workerRow = await screen.findByText('acme/worker');
    await userEvent.click(within(workerRow.closest('li')!).getByRole('checkbox'));

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(setGitHubRepositoryAccessMock).toHaveBeenCalledWith(
        'selected',
        expect.arrayContaining(['octocat/hello-world', 'acme/worker']),
      ),
    );
  });

  it('unchecking a previously added repository removes it on save', async () => {
    renderInApp(<ProjectGitHub />);
    await openConfigure();
    const helloWorldRow = await screen.findByText('octocat/hello-world');
    await userEvent.click(within(helloWorldRow.closest('li')!).getByRole('checkbox'));

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(setGitHubRepositoryAccessMock).toHaveBeenCalledWith('selected', []));
  });

  it('switches to All repositories without requiring any selection', async () => {
    renderInApp(<ProjectGitHub />);
    await openConfigure();

    await userEvent.click(screen.getByRole('radio', { name: /All repositories/ }));
    // The checkbox list disappears; nothing more to pick in this mode.
    expect(screen.queryByText('octocat/hello-world')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(setGitHubRepositoryAccessMock).toHaveBeenCalledWith('all', []));
  });

  it('switching back to Selected after opening shows the prior selection restored from the server', async () => {
    getGitHubRepositoryAccessMock.mockResolvedValue({ mode: 'all', repos: [], unavailable: [] });
    renderInApp(<ProjectGitHub />);
    await openConfigure();

    expect(screen.getByRole('radio', { name: /All repositories/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /Selected repositories/ }));
    // Reveals the checkbox list again, built from the live account.
    expect(await screen.findByText('octocat/hello-world')).toBeInTheDocument();
  });

  it('searches the configure panel', async () => {
    renderInApp(<ProjectGitHub />);
    await openConfigure();
    await screen.findByText('acme/worker');

    await userEvent.type(screen.getByLabelText('Search repositories to configure'), 'spoon');

    expect(screen.queryByText('acme/worker')).not.toBeInTheDocument();
    expect(screen.getByText('octocat/spoon-knife')).toBeInTheDocument();
  });

  it('refreshes the live list on demand', async () => {
    renderInApp(<ProjectGitHub />);
    await openConfigure();
    await screen.findByText('acme/worker');
    expect(listGitHubReposMock).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(listGitHubReposMock).toHaveBeenCalledTimes(2));
  });
});
