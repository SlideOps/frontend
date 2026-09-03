import { getMaintenanceStatus } from '@slideops/api-client';
import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { LogoLoader } from './LogoLoader';
import { MaintenancePage } from './MaintenancePage';
import { isAdmin, useAuthStore } from '../store/auth';

/** A minimal splash shown while the session is being read on boot. */
export function Splash({ label = 'Restoring your Workspace' }: { label?: string }) {
  return <LogoLoader fullScreen label={label} />;
}

/**
 * Gate every signed-in route. While the session is loading it shows the splash;
 * when anonymous it sends the visitor to sign in; when authenticated it renders
 * the nested area through the outlet. Used as a layout route around /app.
 *
 * Also checks planned maintenance once per mount and shows the maintenance
 * page in place of the app for a non-admin Operator while it is on. An Admin
 * always passes through unaffected: the one account that can turn maintenance
 * back off must never be the one locked out by it. A failed maintenance check
 * fails open (treated as off) rather than blocking access over a status read
 * that itself did not work.
 */
export function RequireAuth() {
  const status = useAuthStore((state) => state.status);
  const operator = useAuthStore((state) => state.operator);
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }
    let active = true;
    getMaintenanceStatus()
      .then((on) => {
        if (active) {
          setMaintenance(on);
        }
      })
      .catch(() => {
        // Fails open: see the doc comment above.
      });
    return () => {
      active = false;
    };
  }, [status]);

  if (status === 'loading') {
    return <Splash />;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  if (maintenance && !isAdmin(operator)) {
    return <MaintenancePage />;
  }
  return <Outlet />;
}
