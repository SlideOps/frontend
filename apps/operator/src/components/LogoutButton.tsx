import { Button } from '@slideops/design-system';
import { LogOut } from '@slideops/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

/** Signs the Operator out and returns to the sign in screen. */
export function LogoutButton() {
  const navigate = useNavigate();
  const signOut = useAuthStore((state) => state.signOut);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={busy}>
      <LogOut width={16} height={16} aria-hidden />
      Sign out
    </Button>
  );
}
