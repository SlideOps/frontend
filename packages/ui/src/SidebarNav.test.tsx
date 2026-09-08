import { Boxes, Container, FolderKanban, Globe, LayoutDashboard, Server } from '@slideops/icons';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SidebarNav, type NavGroup, type NavItem } from './SidebarNav';

/*
 * The grouping is what an Operator navigates by, so the properties worth
 * pinning are the ones they would notice: that the daily groups are open and
 * the occasional ones are not, that a heading says whether it is open, that
 * following a deep link never hides the entry for the page you landed on, and
 * that nothing is ever reduced to an unlabelled icon.
 */

const primary: NavItem[] = [
  { key: 'home', label: 'Overview', icon: LayoutDashboard, onSelect: vi.fn() },
];

function structure(activeKey?: string): NavGroup[] {
  const item = (key: string, label: string, icon: NavItem['icon']): NavItem => ({
    key,
    label,
    icon,
    active: key === activeKey,
    onSelect: vi.fn(),
  });
  return [
    {
      key: 'build',
      label: 'Build',
      items: [item('projects', 'Projects', FolderKanban), item('services', 'Services', Container)],
    },
    {
      key: 'infrastructure',
      label: 'Infrastructure',
      items: [item('nodes', 'Servers', Server)],
    },
    { key: 'connect', label: 'Connect', items: [item('domains', 'Domains and DNS', Globe)] },
    { key: 'discover', label: 'Discover', items: [item('extensions', 'Extensions', Boxes)] },
  ];
}

/** The sidebar with its own collapse state, the way a shell wires it up. */
function Harness({
  initialCollapsed,
  activeKey,
  rail = false,
}: {
  initialCollapsed: string[];
  activeKey?: string;
  rail?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  return (
    <nav aria-label="Operator navigation">
      <SidebarNav
        primary={primary}
        groups={structure(activeKey)}
        collapsedGroups={collapsed}
        rail={rail}
        onToggleGroup={(key) =>
          setCollapsed((current) =>
            current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
          )
        }
      />
    </nav>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the grouped sidebar navigation', () => {
  it('opens the daily groups and leaves the occasional ones closed', () => {
    render(<Harness initialCollapsed={['discover']} />);

    expect(screen.getByRole('button', { name: 'Build section' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Infrastructure section' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Connect section' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Discover section' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Extensions' })).toBeNull();
  });

  it('keeps the entry that is always visible outside every group', () => {
    render(<Harness initialCollapsed={['build', 'infrastructure', 'connect', 'discover']} />);

    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
  });

  it('reports a group as expanded, then as collapsed, as the Operator toggles it', async () => {
    const operator = userEvent.setup();
    render(<Harness initialCollapsed={['discover']} />);

    const heading = screen.getByRole('button', { name: 'Discover section' });
    await operator.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Extensions' })).toBeInTheDocument();

    await operator.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Extensions' })).toBeNull());
  });

  it('opens a group from the keyboard alone', async () => {
    const operator = userEvent.setup();
    render(<Harness initialCollapsed={['discover']} />);

    const heading = screen.getByRole('button', { name: 'Discover section' });
    heading.focus();
    await operator.keyboard('{Enter}');

    expect(heading).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Extensions' })).toBeInTheDocument();
  });

  it('opens the group holding the current page even when the stored state closed it', () => {
    render(<Harness initialCollapsed={['discover']} activeKey="extensions" />);

    expect(screen.getByRole('button', { name: 'Discover section' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Extensions' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks exactly one entry as the page currently on screen', () => {
    render(<Harness initialCollapsed={[]} activeKey="services" />);

    const marked = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-current') === 'page');
    expect(marked.map((button) => button.textContent)).toEqual(['Services']);
  });

  it('still gives every entry its full label once the sidebar is an icon rail', () => {
    render(<Harness initialCollapsed={['discover']} rail />);

    const sidebar = within(screen.getByRole('navigation', { name: 'Operator navigation' }));
    expect(sidebar.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(sidebar.getByRole('button', { name: 'Projects' })).toBeInTheDocument();
    expect(sidebar.getByRole('button', { name: 'Servers' })).toBeInTheDocument();
    expect(sidebar.getByRole('button', { name: 'Domains and DNS' })).toBeInTheDocument();
    expect(sidebar.getByRole('button', { name: 'Build section' })).toBeInTheDocument();
  });

  it('closes a group at once for an Operator who asked for less movement', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const operator = userEvent.setup();
    render(<Harness initialCollapsed={[]} />);

    await operator.click(screen.getByRole('button', { name: 'Build section' }));

    // No waiting: with movement turned down there is nothing left on screen to
    // wait for, and the entry leaves the accessibility tree in the same beat.
    expect(screen.queryByRole('button', { name: 'Projects' })).toBeNull();
  });
});
