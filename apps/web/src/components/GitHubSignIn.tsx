import { getAuthProviders, githubSignInUrl, type AuthProviders } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/*
 * Signing in with GitHub, on the sign in and sign up screens.
 *
 * The whole round trip belongs to the backend: this navigates the browser to the
 * authorize endpoint and the backend does the rest, ending with a session cookie
 * and a redirect into the app. Nothing about the OAuth app exists in this bundle,
 * which is exactly why the client secret never has to.
 *
 * It renders nothing at all when the deployment has no GitHub OAuth app
 * configured. A button that could only ever fail is worse than no button.
 */

/** The in-app page a successful GitHub sign in lands on. */
const RETURN_PATH = '/app';

/**
 * Plain sentences for the error codes the callback can redirect back with. Each
 * says what happened and, where there is one, what to do about it.
 */
const SIGN_IN_ERRORS: Record<string, string> = {
  no_verified_email:
    'Your GitHub account has no verified email address, so we cannot tell who you are. Verify an email on GitHub and try again, or sign in with an email and password.',
  state_expired: 'That took a little too long and the sign in expired. Try again.',
  state_invalid: 'That sign in could not be verified. Start again from this page.',
  unconfigured: 'Signing in with GitHub is not set up on this deployment.',
  exchange_failed: 'GitHub could not complete the sign in. Try again in a moment.',
  missing_code: 'GitHub did not send back what we needed. Try again.',
  access_denied: 'You declined the GitHub sign in, so nothing happened.',
  declined: 'You declined the GitHub sign in, so nothing happened.',
  signin_failed: 'The sign in did not complete. Try again.',
};

/** The sentence for a code, or a calm fallback for one we do not recognise. */
function signInErrorMessage(code: string): string {
  return SIGN_IN_ERRORS[code] ?? 'Signing in with GitHub did not complete. Try again.';
}

/** The GitHub mark, inline so the button needs no network request to render. */
function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/**
 * The "Continue with GitHub" action, plus any error the callback redirected back
 * with. Renders nothing when GitHub sign in is not configured on this deployment.
 *
 * `label` differs between signing in and signing up only in wording; both start
 * the same flow, because with GitHub they are the same action: an unknown account
 * is created, a known one is signed in.
 */
export function GitHubSignIn({ label = 'Continue with GitHub' }: { label?: string }) {
  const [searchParams] = useSearchParams();
  const [providers, setProviders] = useState<AuthProviders | null>(null);

  // Ask which ways in this deployment offers. It never rejects, so a failure
  // simply leaves the GitHub option hidden and the password form untouched.
  useEffect(() => {
    const controller = new AbortController();
    getAuthProviders(controller.signal).then(setProviders);
    return () => controller.abort();
  }, []);

  const errorCode = searchParams.get('signin_error');

  // The error is worth showing even before the provider check resolves, since it
  // is the explanation for why the Operator is looking at this page again.
  const errorNote = errorCode ? (
    <p role="alert" className="text-sm text-danger">
      {signInErrorMessage(errorCode)}
    </p>
  ) : null;

  if (!providers?.github) {
    return errorNote;
  }

  return (
    <div className="flex flex-col gap-4">
      {errorNote}
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        // A full navigation, not a fetch: the response is a redirect to GitHub,
        // and the round trip ends with the backend setting a session cookie.
        onClick={() => {
          window.location.href = githubSignInUrl(RETURN_PATH);
        }}
      >
        <GitHubMark />
        {label}
      </Button>

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <Text variant="caption" tone="secondary">
          or
        </Text>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
