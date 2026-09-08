import {
  Activity,
  Boxes,
  Building2,
  Clock,
  Container,
  CreditCard,
  FileText,
  Fingerprint,
  FolderKanban,
  Globe,
  KeyRound,
  LayoutDashboard,
  Layers,
  ListChecks,
  Package,
  Search,
  Network,
  Server,
  Shield,
  ShieldCheck,
  Terminal as TerminalIcon,
  Users,
  X,
} from '@slideops/icons';
import { AppShell, type NavGroup, type NavItem } from '@slideops/ui';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAdmin, useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { NotificationsBell } from '../notifications/NotificationsBell';
import { useNavigationPreferences } from '../hooks/useNavigationPreferences';
import { CommandPalette } from './CommandPalette';
import { InstallApp } from './InstallApp';
import { LogoutButton } from './LogoutButton';
import { WorkspaceContextPanel } from './WorkspaceContextPanel';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

export type ActiveKey =
  | 'home'
  | 'workspaces'
  | 'networking'
  | 'domains'
  | 'nodes'
  | 'projects'
  | 'services'
  | 'terminal'
  | 'capabilities'
  | 'marketplace'
  | 'automations'
  | 'sshKeys'
  | 'snippets'
  | 'operations'
  | 'credentials'
  | 'reports'
  | 'billing'
  | 'security'
  | 'extensions'
  | 'team';

/** A visible affordance that opens the command palette, with its shortcut shown. */
function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search the workspace"
      aria-keyshortcuts="Control+K Meta+K"
      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:px-3"
    >
      <Search width={16} height={16} aria-hidden />
      <span className="hidden md:inline">Search</span>
      <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-xs md:inline">
        {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
          ? 'Cmd K'
          : 'Ctrl K'}
      </kbd>
    </button>
  );
}

/**
 * A transient notice, shown when another area redirects here with a message,
 * for example when a plain Operator is turned away from the admin area. It reads
 * the router location state, appears with role status, and can be dismissed.
 */
function ShellNotice() {
  const location = useLocation();
  const stateNotice = (location.state as { notice?: string } | null)?.notice ?? null;
  const [notice, setNotice] = useState<string | null>(stateNotice);

  useEffect(() => {
    setNotice(stateNotice);
  }, [stateNotice, location.key]);

  if (!notice) {
    return null;
  }
  return (
    <div
      role="status"
      className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-border bg-subtle px-4 py-3"
    >
      <p className="text-sm text-ink">{notice}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setNotice(null)}
        className="shrink-0 rounded-pill p-1 text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <X width={16} height={16} aria-hidden />
      </button>
    </div>
  );
}

/** The Operator app frame: shared navigation, workspace search, and sign out. */
export function OperatorShell({ active, children }: { active: ActiveKey; children: ReactNode }) {
  const navigate = useNavigate();
  const operator = useAuthStore((state) => state.operator);
  const refreshWorkspaces = useWorkspaceStore((state) => state.refresh);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { preferences, toggleGroup, toggleSidebar } = useNavigationPreferences();
  const rail = preferences.sidebar_collapsed;

  // Read once per app visit which workspaces this Operator can act in, so the
  // switcher and every Viewer-role gate throughout the app have an answer
  // before anything else on the page needs it.
  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  /** One entry, with the active marking every entry needs. */
  const item = useCallback(
    (key: ActiveKey, label: string, icon: NavItem['icon'], path: string): NavItem => ({
      key,
      label,
      icon,
      active: active === key,
      onSelect: () => navigate(path),
    }),
    [active, navigate],
  );

  /*
   * The navigation, grouped by what an Operator came to do rather than by which
   * part of the system answers it. Build is what they are shipping,
   * Infrastructure is what it runs on, Connect is how the world reaches it, and
   * the rest are the things they look at on purpose. Order is deliberate: the
   * groups an Operator opens daily come first. Every group starts open, and
   * then stays however that Operator leaves it.
   */
  // Rebuilt only when the current page, or who is looking, actually changes.
  // With every group open the sidebar renders every destination at once, and
  // without this it rebuilt all of them on each keystroke typed anywhere on the
  // page, which is work nobody asked for and enough of it to be felt.
  const groups: NavGroup[] = useMemo(() => {
    const built: NavGroup[] = [
    {
      key: 'build',
      label: 'Build',
      items: [
        item('projects', 'Projects', FolderKanban, '/app/projects'),
        item('services', 'Services', Container, '/app/services'),
      ],
    },
    {
      key: 'infrastructure',
      label: 'Infrastructure',
      items: [
        item('nodes', 'Servers', Server, '/app/nodes'),
        item('capabilities', 'Capabilities', Layers, '/app/capabilities'),
        item('networking', 'Network', Network, '/app/networking'),
        item('terminal', 'Terminal', TerminalIcon, '/app/terminal'),
      ],
    },
    {
      // Domains sit here rather than under a Service, because the question they
      // answer is never about one Service: it is which of this Workspace's
      // hostnames is not serving, and why.
      key: 'connect',
      label: 'Connect',
      items: [item('domains', 'Domains and DNS', Globe, '/app/domains')],
    },
    {
      key: 'observe',
      label: 'Observe',
      items: [
        item('operations', 'Activity', Activity, '/app/operations'),
        item('reports', 'Reports', FileText, '/app/reports'),
      ],
    },
    {
      key: 'configure',
      label: 'Configure',
      items: [
        item('credentials', 'Credentials', KeyRound, '/app/credentials'),
        item('sshKeys', 'SSH Keys', Fingerprint, '/app/ssh-keys'),
        item('snippets', 'Snippets', ListChecks, '/app/snippets'),
      ],
    },
    {
      key: 'automate',
      label: 'Automate',
      items: [item('automations', 'Automations', Clock, '/app/automations')],
    },
    {
      key: 'discover',
      label: 'Discover',
      items: [
        item('marketplace', 'Marketplace', Package, '/app/marketplace'),
        item('extensions', 'Extensions', Boxes, '/app/extensions'),
      ],
    },
    {
      key: 'account',
      label: 'Account',
      items: [
        item('billing', 'Billing', CreditCard, '/app/billing'),
        item('security', 'Security', Shield, '/app/security'),
      ],
    },
    ];

    // The admin group is offered only when this account carries the admin role,
    // and it crosses into the separate /admin area rather than an app screen.
    if (isAdmin(operator)) {
      built.push({
        key: 'admin',
        label: 'Admin',
        items: [
          {
            key: 'admin',
            label: 'Admin',
            icon: ShieldCheck,
            active: false,
            onSelect: () => navigate('/admin'),
          },
        ],
      });
    }
    return built;
  }, [item, navigate, operator]);

  // Both are single element lists rebuilt on every render otherwise, which is
  // enough on its own to defeat the memo around the navigation: a new array is
  // a new prop however identical its contents.
  const primary = useMemo(
    () => [item('home', 'Overview', LayoutDashboard, '/app')],
    [item],
  );
  const contextNav = useMemo(
    () => [
      item('workspaces', 'All Workspaces', Building2, '/app/workspaces'),
      item('team', 'Team', Users, '/app/team'),
    ],
    [item],
  );

  return (
    <>
      <AppShell
        surface="Operator"
        primary={primary}
        groups={groups}
        context={
          <WorkspaceContextPanel
            rail={rail}
            current={active === 'workspaces' ? 'workspaces' : active === 'team' ? 'team' : 'none'}
          />
        }
        contextNav={contextNav}
        collapsedGroups={preferences.collapsed_groups}
        onToggleGroup={toggleGroup}
        railCollapsed={rail}
        onToggleRail={toggleSidebar}
        actions={
          <>
            {/* The only switcher in the app. Mounting a second one anywhere
                would double the pending invitation and node transfer reads it
                makes on every page an Operator opens. */}
            <WorkspaceSwitcher />
            <InstallApp />
            <SearchTrigger onOpen={() => setPaletteOpen(true)} />
            <NotificationsBell />
            <LogoutButton />
          </>
        }
      >
        <ShellNotice />
        {children}
      </AppShell>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
