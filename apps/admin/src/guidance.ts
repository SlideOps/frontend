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
  'overview.nodes': {
    label: 'Nodes',
    summary: 'Every Node connected across all tenants, counted for oversight.',
  },
  'overview.active': {
    label: 'Active Operations',
    summary: 'Operations executing right now across every tenant.',
  },
  'overview.failures': {
    label: 'Failures in the last day',
    summary: 'Operations that failed in the last 24 hours, a quick read on platform trouble.',
  },
  'overview.suspended': {
    label: 'Suspended Operators',
    summary: 'Operators who cannot approve or execute Operations until they are unsuspended.',
    detail:
      'Suspending an Operator sets their account to suspended. While suspended, the approve endpoint refuses and the worker skips their queued Operations. Unsuspend restores normal behavior. Every change is audited.',
  },
  'operators.roster': {
    label: 'Operator roster',
    summary: 'Every Operator with their status, Node and Operation counts, and last activity.',
    detail:
      'The roster reads across tenants for oversight only. Open an Operator to see their recent Operations and to suspend or unsuspend them behind a confirmation. Nothing here acts on an Operator Node.',
  },
  'operations.record': {
    label: 'Operation record',
    summary: 'A read-only record of one Operation, read across tenants for oversight.',
    detail:
      'The control plane observes Operations, it does not act on them. This record shows the Operator, the Node, the Capability, and the status, without any approve, cancel, or run action.',
  },
  'operations.filter': {
    label: 'Filters',
    summary: 'Narrow the cross-tenant list by status or by a single Operator.',
  },
  'analytics.over_time': {
    label: 'Operations over time',
    summary: 'How many Operations ran per day across the platform.',
  },
  'analytics.status': {
    label: 'Status breakdown',
    summary: 'The share of Operations in each status, a read on outcomes at a glance.',
  },
  'analytics.capabilities': {
    label: 'Capability usage',
    summary: 'Which Capabilities Operators reach for most across the platform.',
  },
  'analytics.success': {
    label: 'Success rate',
    summary: 'The share of Operations that completed and verified across the platform.',
  },
  'audit.trail': {
    label: 'Audit trail',
    summary: 'An immutable record of every admin and system action, newest first.',
    detail:
      'Every mutation on the control plane, every suspension, and every emergency switch is written here with the actor, the action, the target, and the source address. The trail is append only and cannot be edited.',
  },
  'emergency.pause': {
    label: 'Pausing executions',
    summary: 'Holds every new execution platform wide. Nothing queued is lost.',
    detail:
      'While paused, the worker starts no new executions. Operators can still create and approve Operations; those wait with a clear event line that executions are paused, and run when you resume. Use this to stop the platform acting during an incident.',
  },
  'emergency.resume': {
    label: 'Resuming executions',
    summary: 'Lifts the pause so held Operations run again across every tenant.',
    detail:
      'Resuming clears the platform-wide hold. Every Operation that was waiting begins running in order. Like pausing, resuming is confirmed and written to the audit trail.',
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
