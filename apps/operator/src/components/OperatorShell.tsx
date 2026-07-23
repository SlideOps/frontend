import { Activity, LayoutDashboard, Server, Shield } from '@slideops/icons';
import { AppShell, type NavItem } from '@slideops/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoutButton } from './LogoutButton';

type ActiveKey = 'home' | 'nodes' | 'operations' | 'security';

/** The Operator app frame: shared navigation plus a working sign out action. */
export function OperatorShell({ active, children }: { active: ActiveKey; children: ReactNode }) {
  const navigate = useNavigate();

  const nav: NavItem[] = [
    {
      key: 'home',
      label: 'Workspace',
      icon: LayoutDashboard,
      active: active === 'home',
      onSelect: () => navigate('/'),
    },
    { key: 'nodes', label: 'Nodes', icon: Server, active: active === 'nodes' },
    { key: 'operations', label: 'Operations', icon: Activity, active: active === 'operations' },
    {
      key: 'security',
      label: 'Security',
      icon: Shield,
      active: active === 'security',
      onSelect: () => navigate('/security'),
    },
  ];

  return (
    <AppShell nav={nav} surface="Operator" actions={<LogoutButton />}>
      {children}
    </AppShell>
  );
}
