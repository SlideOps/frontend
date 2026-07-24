import { Logo } from '@slideops/icons';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

/** A minimal splash shown while the session is being read on boot. */
export function Splash({ label = 'Restoring your Workspace' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app text-ink">
      <Logo size={36} />
      <p className="text-sm text-ink-muted" role="status">
        {label}
      </p>
    </div>
  );
}

/**
 * Gate every signed-in route. While the session is loading it shows the splash;
 * when anonymous it sends the visitor to sign in; when authenticated it renders
 * the nested area through the outlet. Used as a layout route around /app.
 */
export function RequireAuth() {
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') {
    return <Splash />;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
