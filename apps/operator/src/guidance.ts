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
