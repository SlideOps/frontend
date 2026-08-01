import {
  Activity,
  Boxes,
  Clock,
  Container,
  CreditCard,
  FileText,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Layers,
  Package,
  Search,
  Server,
  Shield,
  ShieldCheck,
  X,
} from '@slideops/icons';
import { AppShell, type NavItem } from '@slideops/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAdmin, useAuthStore } from '../../store/auth';
import { NotificationsBell } from '../notifications/NotificationsBell';
import { CommandPalette } from './CommandPalette';
import { InstallApp } from './InstallApp';
import { LogoutButton } from './LogoutButton';

export type ActiveKey =
  | 'home'
  | 'nodes'
  | 'projects'
  | 'services'
  | 'capabilities'
  | 'marketplace'
  | 'automations'
  | 'operations'
  | 'credentials'
  | 'reports'
  | 'billing'
  | 'security'
  | 'extensions';

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
  const [paletteOpen, setPaletteOpen] = useState(false);

  const nav: NavItem[] = [
    {
      key: 'home',
      label: 'Workspace',
      icon: LayoutDashboard,
      active: active === 'home',
      onSelect: () => navigate('/app'),
    },
    {
      key: 'nodes',
      group: 'Your infrastructure',
      label: 'Servers',
      icon: Server,
      active: active === 'nodes',
      onSelect: () => navigate('/app/nodes'),
    },
    {
      key: 'projects',
      group: 'Your infrastructure',
      label: 'Projects',
      icon: FolderKanban,
      active: active === 'projects',
      onSelect: () => navigate('/app/projects'),
    },
    {
      key: 'services',
      group: 'Your infrastructure',
      label: 'Services',
      icon: Container,
      active: active === 'services',
      onSelect: () => navigate('/app/services'),
    },
    {
      key: 'capabilities',
      group: 'Set things up',
      label: 'Capabilities',
      icon: Layers,
      active: active === 'capabilities',
      onSelect: () => navigate('/app/capabilities'),
    },
    {
      key: 'marketplace',
      group: 'Set things up',
      label: 'Marketplace',
      icon: Package,
      active: active === 'marketplace',
      onSelect: () => navigate('/app/marketplace'),
    },
    {
      key: 'automations',
      group: 'Set things up',
      label: 'Automations',
      icon: Clock,
      active: active === 'automations',
      onSelect: () => navigate('/app/automations'),
    },
    {
      key: 'operations',
      group: 'What happened',
      label: 'History',
      icon: Activity,
      active: active === 'operations',
      onSelect: () => navigate('/app/operations'),
    },
    {
      key: 'credentials',
      group: 'What happened',
      label: 'Credentials',
      icon: KeyRound,
      active: active === 'credentials',
      onSelect: () => navigate('/app/credentials'),
    },
    {
      key: 'reports',
      group: 'What happened',
      label: 'Reports',
      icon: FileText,
      active: active === 'reports',
      onSelect: () => navigate('/app/reports'),
    },
    {
      key: 'billing',
      group: 'Account',
      label: 'Billing',
      icon: CreditCard,
      active: active === 'billing',
      onSelect: () => navigate('/app/billing'),
    },
    {
      key: 'extensions',
      group: 'Account',
      label: 'Extensions',
      icon: Boxes,
      active: active === 'extensions',
      onSelect: () => navigate('/app/extensions'),
    },
    {
      key: 'security',
      group: 'Account',
      label: 'Security',
      icon: Shield,
      active: active === 'security',
      onSelect: () => navigate('/app/security'),
    },
  ];

  // The admin entry is offered only when this account carries the admin role,
  // and it crosses into the separate /admin area rather than an app screen.
  if (isAdmin(operator)) {
    nav.push({
      key: 'admin',
      label: 'Admin',
      icon: ShieldCheck,
      active: false,
      onSelect: () => navigate('/admin'),
    });
  }

  return (
    <>
      <AppShell
        nav={nav}
        surface="Operator"
        actions={
          <>
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
