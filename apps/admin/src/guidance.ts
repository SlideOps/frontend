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
  },
  'login.password': {
    label: 'Admin password',
    summary: 'Credentials are never stored in plain text and never appear in logs.',
  },
};
