import { Navigate, Outlet } from 'react-router-dom';
import { LogoLoader } from './LogoLoader';
import { useAuthStore } from '../store/auth';

/** A minimal splash shown while the session is being read on boot. */
export function Splash({ label = 'Restoring your Workspace' }: { label?: string }) {
  return <LogoLoader fullScreen label={label} />;
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
