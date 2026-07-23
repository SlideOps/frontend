import { Logo } from '@slideops/icons';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

/** A minimal splash shown while the session is being read on boot. */
export function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app text-ink">
      <Logo size={36} />
      <p className="text-sm text-ink-muted" role="status">
        Restoring your Workspace
      </p>
    </div>
  );
}

/**
 * Gate a protected route. While the session is loading it shows the splash;
 * when anonymous it sends the Operator to sign in; when authenticated it renders
 * the route.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') {
    return <Splash />;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
