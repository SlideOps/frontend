/*
 * Shared marketing content constants. The Operator app links live here so the
 * sign up and sign in calls point at one place. In production the Operator app
 * is served from its own host under slideops.com; in development an environment
 * override points these at the local Operator dev server.
 */

const OPERATOR_URL = import.meta.env.VITE_OPERATOR_URL ?? 'https://app.slideops.com';

export const signUpUrl = `${OPERATOR_URL}/register`;
export const signInUrl = `${OPERATOR_URL}/login`;

export const tagline = 'Knowledge becomes Capabilities. Capabilities create Confidence.';
