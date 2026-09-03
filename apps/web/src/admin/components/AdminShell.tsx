import {
  Activity,
  CreditCard,
  Flag,
  Gauge,
  Layers,
  LayoutDashboard,
  ListChecks,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  Users,
} from '@slideops/icons';
import { AppShell, type NavItem } from '@slideops/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstallApp } from '../../app/components/InstallApp';
import { LogoutButton } from './LogoutButton';

export type ActiveKey =
  | 'overview'
  | 'operators'
  | 'operations'
  | 'analytics'
  | 'audit'
  | 'promo-codes'
  | 'tiers'
  | 'subscribers'
  | 'emergency'
  | 'feature-flags';

/**
 * The Admin app frame: shared side navigation on wide screens, a bottom bar on
 * phones, both from the design system, plus a working sign out. Denser than the
 * Operator surface, calmer, and the same in both themes.
 */
export function AdminShell({ active, children }: { active: ActiveKey; children: ReactNode }) {
  const navigate = useNavigate();

  const nav: NavItem[] = [
    {
      key: 'overview',
      label: 'Overview',
      icon: Gauge,
      active: active === 'overview',
      onSelect: () => navigate('/admin'),
    },
    {
      key: 'operators',
      label: 'Operators',
      icon: Users,
      active: active === 'operators',
      onSelect: () => navigate('/admin/operators'),
    },
    {
      key: 'subscribers',
      label: 'Subscribers',
      icon: CreditCard,
      active: active === 'subscribers',
      onSelect: () => navigate('/admin/subscribers'),
    },
    {
      key: 'operations',
      label: 'Operations',
      icon: Activity,
      active: active === 'operations',
      onSelect: () => navigate('/admin/operations'),
    },
    {
      key: 'analytics',
      label: 'Analytics',
      icon: Sparkles,
      active: active === 'analytics',
      onSelect: () => navigate('/admin/analytics'),
    },
    {
      key: 'audit',
      label: 'Audit log',
      icon: ListChecks,
      active: active === 'audit',
      onSelect: () => navigate('/admin/audit'),
    },
    {
      key: 'promo-codes',
      label: 'Promo codes',
      icon: TicketPercent,
      active: active === 'promo-codes',
      onSelect: () => navigate('/admin/promo-codes'),
    },
    {
      key: 'tiers',
      label: 'Tiers',
      icon: Layers,
      active: active === 'tiers',
      onSelect: () => navigate('/admin/tiers'),
    },
    {
      key: 'emergency',
      label: 'Emergency',
      icon: ShieldCheck,
      active: active === 'emergency',
      onSelect: () => navigate('/admin/emergency'),
    },
    {
      key: 'feature-flags',
      label: 'Feature flags',
      icon: Flag,
      active: active === 'feature-flags',
      onSelect: () => navigate('/admin/feature-flags'),
    },
    {
      key: 'app',
      label: 'Exit to app',
      icon: LayoutDashboard,
      active: false,
      onSelect: () => navigate('/app'),
    },
  ];

  return (
    <AppShell surface="Admin" nav={nav} dense actions={
          <>
            <InstallApp />
            <LogoutButton />
          </>
        }>
      {children}
    </AppShell>
  );
}
