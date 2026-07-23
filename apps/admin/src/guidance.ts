import type { GuidanceRegistry } from '@slideops/tooltips';

/** Admin guidance content, keyed by stable strings and reviewed as product copy. */
export const guidance: GuidanceRegistry = {
  'overview.health': {
    label: 'Platform health',
    summary: 'A calm read on the platform: services, queues, and live Operations across all tenants.',
    detail:
      'The Admin surface reads across tenants for oversight only. It shows platform health, active Operations everywhere, and headline analytics, without ever acting on an Operator Node directly.',
  },
  'overview.operations': {
    label: 'Active Operations',
    summary: 'Operations running right now across every Operator, for oversight only.',
  },
  'overview.operators': {
    label: 'Operators',
    summary: 'The Operators on the platform. Cross-tenant read is limited to oversight and support.',
  },
  'overview.emergency': {
    label: 'Emergency controls',
    summary: 'Pause or resume executions platform wide. Every action is confirmed and fully audited.',
    detail:
      'Emergency controls are first-class, audited actions. Pausing all executions, or suspending a single Operator execution, always asks for confirmation and is written to the immutable audit trail.',
  },
  'login.email': {
    label: 'Admin email',
    summary: 'Admin sign in is separate and stricter than Operator sign in.',
    detail:
      'Admin accounts are provisioned by the platform, never self created. This surface has its own sign in, its own session cookie, and in production its own hostname and network restrictions.',
  },
  'login.password': {
    label: 'Admin password',
    summary: 'Credentials are never stored in plain text and never appear in logs.',
  },
  'mfa.code': {
    label: 'Verification code',
    summary: 'The 6 digit code from your authenticator app. It changes every 30 seconds.',
    detail:
      'The control plane asks for a second step at sign in on top of the password. The code comes from an authenticator app that only you hold and refreshes every 30 seconds, so a stolen password alone cannot reach oversight or emergency controls.',
  },
};
