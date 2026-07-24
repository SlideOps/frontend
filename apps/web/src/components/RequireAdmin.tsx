import { Navigate, Outlet } from 'react-router-dom';
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
  return <Outlet />;
}
