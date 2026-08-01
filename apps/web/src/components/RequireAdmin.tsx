import { Button, Text } from '@slideops/design-system';
import { KeyRound } from '@slideops/icons';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { isAdmin, useAuthStore } from '../store/auth';
import { Splash } from './RequireAuth';

/**
 * Gate the admin area. It first requires a session, exactly like RequireAuth,
 * then requires the admin role. A signed-in Operator without the role is sent
 * back to the app area with a clear notice rather than shown a dead end. Used as
 * a layout route around /admin.
 */
export function RequireAdmin() {
  const status = useAuthStore((state) => state.status);
  const operator = useAuthStore((state) => state.operator);

  if (status === 'loading') {
    return <Splash label="Opening the control plane" />;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin(operator)) {
    return (
      <Navigate
        to="/app"
        replace
        state={{ notice: 'The admin area is for administrators only.' }}
      />
    );
  }
  /*
   * The server requires two step verification on an admin account in production,
   * and this is where that has to be said.
   *
   * Without it the area opened, every panel called the API, every call came back
   * 403 "enable multi factor authentication to use the admin area", and each
   * screen rendered that as its own failure. What an administrator saw was an
   * admin area where nothing worked, and a message naming something they were
   * given no way to reach. The setting existed the whole time, on the Security
   * page, one click away and unmentioned anywhere.
   *
   * So the requirement is stated once, before anything loads, with the way to
   * satisfy it attached. A requirement somebody cannot act on is not a
   * requirement, it is a dead end.
   */
  if (operator && !operator.mfa_enabled) {
    return <MFARequired />;
  }
  return <Outlet />;
}

/** What an admin sees when the only thing between them and the area is 2FA. */
function MFARequired() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-subtle text-brand">
        <KeyRound width={22} height={22} aria-hidden />
      </span>
      <div>
        <Text variant="h2">Two step verification is required here</Text>
        <Text variant="body" tone="secondary" className="mt-3 block">
          The admin area can suspend accounts, change what everyone is charged, and pause every
          Operation on the platform. A password on its own is not enough to hold that, so this
          account needs a second step before the area will open.
        </Text>
        <Text variant="body-sm" tone="secondary" className="mt-3 block">
          It takes a moment: scan a code with an authenticator app, type the six digits back, and
          come straight back here.
        </Text>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => navigate('/app/security')}>Turn it on</Button>
        <Button variant="ghost" onClick={() => navigate('/app')}>
          Back to the app
        </Button>
      </div>
    </div>
  );
}
