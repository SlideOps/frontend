import {
  Activity,
  Boxes,
  Clock,
  FileText,
  LayoutDashboard,
  Layers,
  Search,
  Server,
  Shield,
} from '@slideops/icons';
import { AppShell, type NavItem } from '@slideops/ui';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationsBell } from '../notifications/NotificationsBell';
import { CommandPalette } from './CommandPalette';
import { LogoutButton } from './LogoutButton';

export type ActiveKey =
  | 'home'
  | 'nodes'
  | 'capabilities'
  | 'automations'
  | 'operations'
  | 'reports'
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

/** The Operator app frame: shared navigation, workspace search, and sign out. */
export function OperatorShell({ active, children }: { active: ActiveKey; children: ReactNode }) {
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const nav: NavItem[] = [
    {
      key: 'home',
      label: 'Workspace',
      icon: LayoutDashboard,
      active: active === 'home',
      onSelect: () => navigate('/'),
    },
    {
      key: 'nodes',
      label: 'Nodes',
      icon: Server,
      active: active === 'nodes',
      onSelect: () => navigate('/nodes'),
    },
    {
      key: 'capabilities',
      label: 'Capabilities',
      icon: Layers,
      active: active === 'capabilities',
      onSelect: () => navigate('/capabilities'),
    },
    {
      key: 'automations',
      label: 'Automations',
      icon: Clock,
      active: active === 'automations',
      onSelect: () => navigate('/automations'),
    },
    {
      key: 'operations',
      label: 'History',
      icon: Activity,
      active: active === 'operations',
      onSelect: () => navigate('/operations'),
    },
    {
      key: 'reports',
      label: 'Reports',
      icon: FileText,
      active: active === 'reports',
      onSelect: () => navigate('/reports'),
    },
    {
      key: 'extensions',
      label: 'Extensions',
      icon: Boxes,
      active: active === 'extensions',
      onSelect: () => navigate('/extensions'),
    },
    {
      key: 'security',
      label: 'Security',
      icon: Shield,
      active: active === 'security',
      onSelect: () => navigate('/security'),
    },
  ];

  return (
    <>
      <AppShell
        nav={nav}
        surface="Operator"
        actions={
          <>
            <SearchTrigger onOpen={() => setPaletteOpen(true)} />
            <NotificationsBell />
            <LogoutButton />
          </>
        }
      >
        {children}
      </AppShell>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
