import type { GuidanceRegistry } from '@slideops/tooltips';

/**
 * The application guidance content for every surface: marketing, the operator
 * area, and the admin control plane. Each control looks up its explanation here
 * by a stable key. Copy is written in the ubiquitous language and reviewed like
 * any other product text.
 */
export const guidance: GuidanceRegistry = {
  'dashboard.workspace': {
    label: 'Workspace',
    summary: 'Your Workspace gathers your Projects, Nodes, and recent Operations in one place.',
    detail:
      'A Workspace is the home for your work. From here you reach every Project you own, the Nodes inside them, and the Operations you have run recently. Nothing here belongs to anyone else.',
  },
  'dashboard.nodes': {
    label: 'Nodes',
    summary: 'A Node is one Linux machine you connect over SSH. Your Nodes stay yours.',
    detail:
      'A Node is a machine you own and reach over SSH. SlideOps reads its state during Discovery and never changes it without a plan you approve first.',
  },
  'dashboard.operations': {
    label: 'Operations',
    summary: 'An Operation is one run of a Capability against a Node, from plan to verification.',
  },
  'dashboard.recommendations': {
    label: 'Recommendations',
    summary: 'Suggested Capabilities based on what Discovery found, each with a reason.',
  },
  'dashboard.health': {
    label: 'Health at a glance',
    summary: 'A quick read on your Workspace: how many Nodes you have and how your recent Operations went.',
  },
  'dashboard.projects': {
    label: 'Projects',
    summary: 'A Project groups related Nodes so your Workspace stays organized as it grows.',
  },
  'node.name': {
    label: 'Name',
    summary: 'A friendly name you will recognize, such as web-1 or staging database.',
  },
  'node.hostname': {
    label: 'Hostname',
    summary: 'The host name of the machine, for example web-1.internal.',
  },
  'node.address': {
    label: 'Address',
    summary: 'Where SlideOps reaches the Node over the network: a domain name or an IP address.',
  },
  'node.port': {
    label: 'SSH port',
    summary: 'The port the SSH service listens on. The default is 22.',
  },
  'node.username': {
    label: 'SSH username',
    summary: 'The account SlideOps signs in as over SSH, such as root or deploy.',
  },
  'node.project': {
    label: 'Project',
    summary: 'Optionally place this Node in a Project to keep related Nodes together.',
  },
  'node.authKind': {
    label: 'How to sign in',
    summary: 'Choose a private key or a password for the SSH connection. A key is stronger.',
    detail:
      'A private key is the safer choice and lets SlideOps turn off password sign in during hardening without locking you out. If you sign in with a password, SlideOps keeps password sign in on and recommends moving to a key.',
  },
  'node.secret': {
    label: 'Credential',
    summary: 'Your password or private key. It is stored encrypted and never shown again.',
    detail:
      'The credential is encrypted the moment it reaches the backend and is only ever decrypted at connection time. It is never written to logs and never returned by the API, so once you save it you will not see it here again.',
  },
  'node.discover': {
    label: 'Discover',
    summary: 'Connect read-only and gather the Facts about this Node. Discovery never changes anything.',
    detail:
      'Discovery opens a read-only SSH connection and reads the state of the Node: its operating system, services, listening ports, and SSH posture. It never changes a single setting. Everything that follows is planned from what Discovery finds.',
  },
  'node.facts': {
    label: 'Facts',
    summary: 'What Discovery read from the Node: its system, services, and SSH configuration.',
  },
  'node.assessment': {
    label: 'Assessment',
    summary: 'Discovery read in plain language, with the findings and what SlideOps recommends.',
  },
  'node.capabilities': {
    label: 'Available Capabilities',
    summary: 'The Capabilities that apply to this Node. Start one to plan an Operation.',
  },
  'node.health': {
    label: 'Health',
    summary: 'A read-only look at this Node right now: CPU load, memory, disk, uptime, and services.',
    detail:
      'Health connects read only over SSH and reads the current metrics, and a recent history when the monitoring log is present. It never changes the Node. Enable the monitoring Capability to keep a history you can chart here.',
  },
  'node.health.history': {
    label: 'Recent history',
    summary: 'Memory, disk, and CPU load over the recent readings from the monitoring log.',
  },
  'reports.overview': {
    label: 'Reports',
    summary: 'Generate a readable report from your Operations, verifications, discoveries, and metrics.',
    detail:
      'A report is generated on read from what SlideOps already holds. Pick a type, scope it to a Node if you like, and print it when you need a record. Nothing is changed to produce a report.',
  },
  'reports.scope': {
    label: 'Scope',
    summary: 'Limit the report to a single Node, or leave it across all your Nodes.',
  },
  'capability.search': {
    label: 'Search by outcome',
    summary: 'Search for what you want to achieve, not the technology behind it.',
  },
  'capability.risk': {
    label: 'Risk',
    summary: 'How much a Capability changes on the Node. You always review a plan before anything runs.',
  },
  'capability.category': {
    label: 'Category',
    summary: 'The area of work a Capability belongs to, such as security or networking.',
  },
  'capability.outcome': {
    label: 'Outcome',
    summary: 'What this Capability achieves on a Node, stated as a result rather than a set of commands.',
  },
  'capability.intent': {
    label: 'Intent',
    summary: 'Why this Capability exists and the goal it serves, so you choose it for the right reason.',
  },
  'capability.platforms': {
    label: 'Supported platforms',
    summary: 'The Linux families this Capability runs on. It adapts to the one your Node uses.',
    detail:
      'A Capability is written once and runs across the common distributions through a shared platform layer. It detects your Node family from Discovery and uses the right package manager, service manager, and backend for it.',
  },
  'capability.verification': {
    label: 'How verification proves it',
    summary: 'The way SlideOps confirms the outcome really happened before calling the Operation done.',
    detail:
      'Every Operation ends by proving its result: SlideOps re-reads the Node and, where it matters, opens a fresh connection so a change that would lock you out is caught. The evidence is shown with each check.',
  },
  'capability.start': {
    label: 'Start an Operation',
    summary: 'Choose a Node, fill in any inputs, and open the plan. Nothing runs until you approve it.',
    detail:
      'Some Capabilities need a few inputs, such as a domain or a path. Those are shown as a form here, each field with its own guidance and validation. When you start, the Operation opens at its plan for you to review and approve.',
  },
  'parameters.form': {
    label: 'Inputs',
    summary: 'The details this Capability needs to run, each validated as you type.',
  },
  'operation.plan': {
    label: 'Plan',
    summary: 'The exact steps SlideOps proposes. Nothing runs until you approve it.',
    detail:
      'The plan is the whole proposal in the open: every step, the risks in plain language, how the change would be rolled back, and how the result will be verified. Read it, then approve when you are comfortable. Approval always comes before execution.',
  },
  'operation.steps': {
    label: 'Steps',
    summary: 'Each change the Operation will make, in order, with its own risk.',
  },
  'operation.risks': {
    label: 'Risks',
    summary: 'What could go wrong and what to watch for, stated plainly.',
  },
  'operation.rollback': {
    label: 'Rollback',
    summary: 'How the change is undone if verification does not pass.',
    detail:
      'Before making changes, SlideOps backs up what it will touch. If verification fails, it restores that backup automatically and marks the Operation failed, so a bad change does not stay in place.',
  },
  'operation.verificationStrategy': {
    label: 'How it is verified',
    summary: 'How SlideOps will confirm the change worked before calling the Operation done.',
  },
  'operation.approve': {
    label: 'Approve',
    summary: 'Approve the plan to start execution. This is the point of no surprise.',
  },
  'operation.cancel': {
    label: 'Cancel',
    summary: 'Stop the Operation. Cancellation is cooperative and is checked between steps.',
  },
  'operation.terminal': {
    label: 'Live output',
    summary: 'The raw output from the Node as each step runs, streamed as it happens.',
  },
  'operation.timeline': {
    label: 'Step timeline',
    summary: 'Where the Operation is in the plan. Each step advances as it completes.',
  },
  'operation.verification': {
    label: 'Verification',
    summary: 'The checks that confirm the change worked, each with its evidence.',
    detail:
      'Verification always follows execution. SlideOps re-reads the Node and opens a fresh connection to confirm both that the change took effect and that access was retained. Each check shows whether it passed and the evidence behind it.',
  },
  'login.email': {
    label: 'Email',
    summary: 'Sign in with the email you registered as an Operator.',
  },
  'login.password': {
    label: 'Password',
    summary: 'Your password is never stored in plain text and never appears in logs.',
  },
  'register.email': {
    label: 'Email',
    summary: 'This becomes your Operator sign in. Use an address you can always reach.',
  },
  'register.password': {
    label: 'Password',
    summary: 'Use at least 12 characters. Longer passphrases are stronger and easier to recall.',
    detail:
      'We ask for at least 12 characters because length is the best defense against guessing. A short phrase you can remember beats a short string you cannot. Your password is stored only as a salted hash, never in plain text.',
  },
  'register.confirm': {
    label: 'Confirm password',
    summary: 'Type the same password again so a typo cannot lock you out.',
  },
  'mfa.code': {
    label: 'Verification code',
    summary: 'The 6 digit code from your authenticator app. It changes every 30 seconds.',
    detail:
      'Two step verification asks for a short code in addition to your password, so a stolen password alone cannot reach your Workspace. The code comes from an authenticator app on your device and refreshes every 30 seconds.',
  },
  'security.mfa': {
    label: 'Two step verification',
    summary: 'A second step at sign in, on top of your password, using a code from an app.',
    detail:
      'Two step verification protects your Workspace even if your password is exposed. After the password, sign in also asks for a short code from an authenticator app that only you hold. We recommend keeping it on.',
  },
  'security.secret': {
    label: 'Setup secret',
    summary: 'Add this secret to your authenticator app to start generating codes.',
    detail:
      'Your authenticator app turns this secret into a rotating 6 digit code. Add it by typing the secret or scanning the setup URL, then confirm with the first code the app shows. Keep the secret private.',
  },
  'security.disable': {
    label: 'Confirm your password',
    summary: 'Confirming your password proves it is you before protection is removed.',
  },
  'notifications.center': {
    label: 'Notifications',
    summary: 'A running list of your Operation results: what completed and whether verification passed.',
    detail:
      'As your Operations finish, their results appear here in real time over the same live connection that drives the terminal. Open one to jump straight to its full record. Nothing here leaves your Workspace.',
  },
  'notifications.push': {
    label: 'Browser notifications',
    summary: 'Let SlideOps notify you when an Operation completes, even when this tab is in the background.',
    detail:
      'Turn this on to receive a notification from your browser the moment an Operation completes or its verification result is in, so you do not have to watch the screen. Your browser asks for permission first, and you can turn it off at any time.',
  },
  'automation.approval': {
    label: 'Scheduled runs are auto-approved',
    summary: 'Setting up an Automation is your standing approval for its runs, so scheduled Operations run without a fresh approval.',
    detail:
      'An Automation is a saved intent to run a Capability on a Node on a schedule. Creating it is your approval for those runs, so each scheduled Operation is auto-approved. It still runs the full lifecycle of discover, assess, plan, execute, and verify, always lands in History, and always respects emergency pause and Operator suspend.',
  },
  'automation.schedule': {
    label: 'Schedule',
    summary: 'How often this Automation runs. Times are in UTC so a run never shifts with your clock.',
    detail:
      'Choose hourly, daily, weekly, or monthly, and the time or day the run needs. SlideOps computes the next run from this and shows it back to you in plain language.',
  },
  'automation.enabled': {
    label: 'Enabled',
    summary: 'Turn an Automation off to pause its scheduled runs without deleting it.',
  },
  'capability.matrix': {
    label: 'Capability matrix',
    summary: 'Which Capabilities apply to which platforms, generated from the Providers behind each one.',
    detail:
      'The matrix is generated from the Provider registry, not hand maintained, so it always reflects what will actually run. A check means a Capability is supported on that platform.',
  },

  // Admin control-plane guidance. Cross-tenant read for oversight only.
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
};
