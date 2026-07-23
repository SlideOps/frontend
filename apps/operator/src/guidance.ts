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
};
