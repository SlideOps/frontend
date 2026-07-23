import type { GuidanceRegistry } from '@slideops/tooltips';

/**
 * The Operator guidance content. Each control on this surface looks up its
 * explanation here by a stable key. Copy is written in the ubiquitous language
 * and reviewed like any other product text.
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
};
