import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { renderInApp } from '../../test/render';
import { OperatorShell, type ActiveKey } from './OperatorShell';

/*
 * The Operator sidebar, as an information architecture rather than a list.
 *
 * What matters is not which words are on it but what it guarantees: that the
 * groups an Operator opens daily are open, that the ones they visit on purpose
 * are folded away without being taken away, that the workspace they are
 * operating is asked about separately from what they want to do in it, and that
 * every address the app has ever had is still one click away.
 */

const api = vi.hoisted(() => ({
  getNavigationPreferences: vi.fn(),
  saveNavigationPreferences: vi.fn(),
  listWorkspaces: vi.fn(),
  listMyInvitations: vi.fn(),
  listIncomingNodeTransfers: vi.fn(),
}));

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...api,
}));

/** Every destination the sidebar is required to offer, and where it must lead. */
const structure: { heading: string | null; items: { label: string; path: string }[] }[] = [
  { heading: null, items: [{ label: 'Overview', path: '/app' }] },
  {
    heading: 'Build section',
    items: [
      { label: 'Projects', path: '/app/projects' },
      { label: 'Services', path: '/app/services' },
    ],
  },
  {
    heading: 'Infrastructure section',
    items: [
      { label: 'Servers', path: '/app/nodes' },
      { label: 'Capabilities', path: '/app/capabilities' },
      { label: 'Network', path: '/app/networking' },
      { label: 'Terminal', path: '/app/terminal' },
    ],
  },
  {
    heading: 'Connect section',
    items: [{ label: 'Domains and DNS', path: '/app/domains' }],
  },
  {
    heading: 'Observe section',
    items: [
      { label: 'Activity', path: '/app/operations' },
      { label: 'Reports', path: '/app/reports' },
    ],
  },
  {
    heading: 'Configure section',
    items: [
      { label: 'Credentials', path: '/app/credentials' },
      { label: 'SSH Keys', path: '/app/ssh-keys' },
      { label: 'Snippets', path: '/app/snippets' },
    ],
  },
  {
    heading: 'Automate section',
    items: [{ label: 'Automations', path: '/app/automations' }],
  },
  {
    heading: 'Discover section',
    items: [
      { label: 'Marketplace', path: '/app/marketplace' },
      { label: 'Extensions', path: '/app/extensions' },
    ],
  },
  {
    heading: 'Account section',
    items: [
      { label: 'Billing', path: '/app/billing' },
      { label: 'Security', path: '/app/security' },
    ],
  },
];

function CurrentPath() {
  const location = useLocation();
  return <p>at {location.pathname}</p>;
}

function show(active: ActiveKey = 'home') {
  return renderInApp(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route
          path="*"
          element={
            <OperatorShell active={active}>
              <CurrentPath />
            </OperatorShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

/** The sidebar itself, never the phone bar that mirrors it. */
function sidebar() {
  return within(screen.getByRole('navigation', { name: 'Operator navigation' }));
}

function signedInAs(role: 'operator' | 'admin') {
  useAuthStore.setState({
    status: 'authenticated',
    operator: {
      id: 'op-1',
      email: 'operator@example.test',
      role,
      mfa_enabled: false,
      has_password: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  api.getNavigationPreferences.mockReset().mockRejectedValue(new Error('not deployed yet'));
  api.saveNavigationPreferences.mockReset().mockResolvedValue(undefined);
  api.listWorkspaces.mockReset().mockResolvedValue([]);
  api.listMyInvitations.mockReset().mockResolvedValue([]);
  api.listIncomingNodeTransfers.mockReset().mockResolvedValue([]);
  useWorkspaceStore.setState({ workspaces: [], loaded: false });
  signedInAs('operator');
});

describe('the Operator sidebar', () => {
  it('opens Build, Infrastructure and Connect and leaves every other group closed', () => {
    show();

    for (const open of ['Build section', 'Infrastructure section', 'Connect section']) {
      expect(sidebar().getByRole('button', { name: open })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    }
    for (const closed of [
      'Observe section',
      'Configure section',
      'Automate section',
      'Discover section',
      'Account section',
    ]) {
      expect(sidebar().getByRole('button', { name: closed })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    }
  });

  it('offers Overview on its own, outside every group', () => {
    show();

    expect(sidebar().getByRole('button', { name: 'Overview' })).toBeInTheDocument();
  });

  for (const group of structure) {
    const where = group.heading ? group.heading.replace(' section', '') : 'the sidebar';
    it(`leads from ${where} to every address that part of the app already had`, async () => {
      const operator = userEvent.setup();
      show();

      if (group.heading) {
        const heading = sidebar().getByRole('button', { name: group.heading });
        if (heading.getAttribute('aria-expanded') === 'false') {
          await operator.click(heading);
        }
      }
      for (const destination of group.items) {
        await operator.click(sidebar().getByRole('button', { name: destination.label }));
        expect(screen.getByText(`at ${destination.path}`)).toBeInTheDocument();
      }
    });
  }

  it('asks which workspace separately, and never as another navigation entry', () => {
    show();

    const workspace = within(screen.getByRole('region', { name: 'Workspace' }));
    expect(workspace.getByRole('button', { name: 'All Workspaces' })).toBeInTheDocument();
    expect(workspace.getByRole('button', { name: 'Team' })).toBeInTheDocument();

    expect(sidebar().queryByRole('button', { name: 'All Workspaces' })).toBeNull();
    expect(sidebar().queryByRole('button', { name: 'Team' })).toBeNull();
  });

  it('reaches All Workspaces and Team from the workspace block', async () => {
    const operator = userEvent.setup();
    show();

    const workspace = within(screen.getByRole('region', { name: 'Workspace' }));
    await operator.click(workspace.getByRole('button', { name: 'All Workspaces' }));
    expect(screen.getByText('at /app/workspaces')).toBeInTheDocument();

    await operator.click(
      within(screen.getByRole('region', { name: 'Workspace' })).getByRole('button', {
        name: 'Team',
      }),
    );
    expect(screen.getByText('at /app/team')).toBeInTheDocument();
  });

  it('shows the admin group only to an Operator carrying the admin role', async () => {
    const operator = userEvent.setup();
    show();
    expect(sidebar().queryByRole('button', { name: 'Admin section' })).toBeNull();

    signedInAs('admin');
    show();
    const [heading] = screen.getAllByRole('button', { name: 'Admin section' });
    await operator.click(heading as HTMLElement);
    expect(heading).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the group holding the current page even when that group was collapsed', () => {
    // Reports is in a group that starts closed, so a deep link to it would
    // otherwise land on a page whose own entry cannot be seen.
    show('reports');

    expect(sidebar().getByRole('button', { name: 'Observe section' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(sidebar().getByRole('button', { name: 'Reports' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('renders the whole sidebar anyway when the stored preferences cannot be read', async () => {
    show();

    await waitFor(() => expect(api.getNavigationPreferences).toHaveBeenCalled());
    expect(sidebar().getByRole('button', { name: 'Build section' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(sidebar().getByRole('button', { name: 'Projects' })).toBeInTheDocument();
    expect(sidebar().getByRole('button', { name: 'Observe section' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('takes what an Operator collapsed from the account when the account has an answer', async () => {
    api.getNavigationPreferences.mockResolvedValue({
      collapsed_groups: ['build'],
      pinned: [],
      recents: [],
      sidebar_collapsed: false,
    });
    show();

    await waitFor(() =>
      expect(sidebar().getByRole('button', { name: 'Build section' })).toHaveAttribute(
        'aria-expanded',
        'false',
      ),
    );
  });

  it('names every destination in full once the sidebar is reduced to an icon rail', async () => {
    const operator = userEvent.setup();
    show();

    await operator.click(screen.getByRole('button', { name: 'Collapse the sidebar' }));

    expect(sidebar().getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(sidebar().getByRole('button', { name: 'Projects' })).toBeInTheDocument();
    expect(sidebar().getByRole('button', { name: 'Servers' })).toBeInTheDocument();
    expect(sidebar().getByRole('button', { name: 'Build section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand the sidebar' })).toBeInTheDocument();
  });

  it('tells the account what was collapsed, and keeps it in this browser as well', async () => {
    const operator = userEvent.setup();
    show();

    await operator.click(sidebar().getByRole('button', { name: 'Build section' }));

    await waitFor(() => expect(api.saveNavigationPreferences).toHaveBeenCalled());
    const stored = JSON.parse(window.localStorage.getItem('slideops.navigation') ?? '{}');
    expect(stored.collapsed_groups).toContain('build');
  });
});
