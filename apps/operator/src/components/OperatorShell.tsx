import { Activity, LayoutDashboard, Layers, Server, Shield } from '@slideops/icons';
import { AppShell, type NavItem } from '@slideops/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationsBell } from '../notifications/NotificationsBell';
import { LogoutButton } from './LogoutButton';

export type ActiveKey = 'home' | 'nodes' | 'capabilities' | 'operations' | 'security';

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
      key: 'operations',
      label: 'History',
      icon: Activity,
      active: active === 'operations',
      onSelect: () => navigate('/operations'),
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
    <AppShell
      nav={nav}
      surface="Operator"
      actions={
        <>
          <NotificationsBell />
          <LogoutButton />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
