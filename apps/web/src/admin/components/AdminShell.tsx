import {
  Activity,
  CreditCard,
  FileText,
  Flag,
  Gauge,
  Layers,
  LayoutDashboard,
  ListChecks,
  Globe,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TicketPercent,
  Users,
  Waypoints,
} from '@slideops/icons';
import { AppShell, type NavGroup, type NavItem } from '@slideops/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { InstallApp } from '../../app/components/InstallApp';
import { useNavigationPreferences } from '../../app/hooks/useNavigationPreferences';
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
  | 'arrangements'
  | 'billing-communications'
  | 'emergency'
  | 'feature-flags'
  | 'webhooks'
  | 'rate-limits'
  | 'email-deliveries'
  | 'domains';

/**
 * The Admin app frame: the same grouped, collapsible sidebar the Operator
 * surface uses, a bottom bar on phones, and a working sign out. Denser than the
 * Operator surface, calmer, and the same in both themes.
 *
 * The group keys are prefixed, so both sidebars can share one stored set of
 * collapsed groups without an admin group and an operator group of the same
 * name closing each other.
 */
export function AdminShell({ active, children }: { active: ActiveKey; children: ReactNode }) {
  const navigate = useNavigate();
  const { preferences, toggleGroup, toggleSidebar } = useNavigationPreferences();

  const item = (key: ActiveKey, label: string, icon: NavItem['icon'], path: string): NavItem => ({
    key,
    label,
    icon,
    active: active === key,
    onSelect: () => navigate(path),
  });

  const groups: NavGroup[] = [
    {
      key: 'admin-people',
      label: 'People',
      items: [item('operators', 'Operators', Users, '/admin/operators')],
    },
    {
      key: 'admin-billing',
      label: 'Billing',
      items: [
        item('subscribers', 'Subscribers', CreditCard, '/admin/subscribers'),
        item('tiers', 'Tiers', Layers, '/admin/tiers'),
        item('arrangements', 'Arrangements', FileText, '/admin/arrangements'),
        item('promo-codes', 'Promo Codes', TicketPercent, '/admin/promo-codes'),
        item(
          'billing-communications',
          'Billing Communications',
          Mail,
          '/admin/billing-communications',
        ),
      ],
    },
    {
      key: 'admin-platform',
      label: 'Platform',
      items: [
        item('operations', 'Operations', Activity, '/admin/operations'),
        item('domains', 'Domains', Globe, '/admin/domains'),
        item('feature-flags', 'Feature Flags', Flag, '/admin/feature-flags'),
      ],
    },
    {
      key: 'admin-delivery',
      label: 'Delivery',
      items: [
        item('webhooks', 'Webhooks', Waypoints, '/admin/webhooks'),
        item('email-deliveries', 'Email Deliveries', Mail, '/admin/email-deliveries'),
        item('rate-limits', 'Rate Limits', ShieldAlert, '/admin/rate-limits'),
      ],
    },
    {
      key: 'admin-insight',
      label: 'Insight',
      items: [
        item('analytics', 'Analytics', Sparkles, '/admin/analytics'),
        item('audit', 'Audit', ListChecks, '/admin/audit'),
      ],
    },
    {
      key: 'admin-controls',
      label: 'Controls',
      items: [item('emergency', 'Emergency', ShieldCheck, '/admin/emergency')],
    },
  ];

  return (
    <AppShell
      surface="Admin"
      dense
      primary={[item('overview', 'Control Center', Gauge, '/admin')]}
      groups={groups}
      // The way back out of the admin area is not one of the admin
      // destinations, so it sits under the navigation rather than inside it.
      footer={{
        key: 'app',
        label: 'Exit to app',
        icon: LayoutDashboard,
        active: false,
        onSelect: () => navigate('/app'),
      }}
      collapsedGroups={preferences.collapsed_groups}
      onToggleGroup={toggleGroup}
      railCollapsed={preferences.sidebar_collapsed}
      onToggleRail={toggleSidebar}
      actions={
        <>
          <InstallApp />
          <LogoutButton />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
