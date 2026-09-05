import { Button } from '@slideops/design-system';
import { LogOut } from '@slideops/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useWorkspaceStore } from '../../store/workspace';
import { useNotificationsStore } from '../notifications/store';

/** Signs the Operator out and returns to the sign in screen. */
export function LogoutButton() {
  const navigate = useNavigate();
  const signOut = useAuthStore((state) => state.signOut);
  const resetWorkspaces = useWorkspaceStore((state) => state.reset);
  const clearNotifications = useNotificationsStore((state) => state.clear);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    await signOut();
    resetWorkspaces();
    // The notification bell holds titles, bodies, and links (an invitation's
    // own workspace name among them) client side, keyed by nothing but this
    // browser tab. Without clearing it, the next Operator to sign in on the
    // same tab would see whatever was left over from this account until new
    // items of their own arrived, since a client-side navigation to /login
    // never reloads the page and resets nothing on its own.
    clearNotifications();
    navigate('/login', { replace: true });
  };

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={busy}>
      <LogOut width={16} height={16} aria-hidden />
      Sign out
    </Button>
  );
}
