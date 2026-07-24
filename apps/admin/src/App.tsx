import { Logo } from '@slideops/icons';
import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { Login } from './screens/Login';
import { MfaVerify } from './screens/MfaVerify';
import { useAuthStore } from './store/auth';

/*
 * Every oversight screen is loaded lazily and split at the route, so the first
 * load of the control plane stays small and the heavy charting library only
 * arrives with the screens that draw charts. The two authentication screens load
 * eagerly, since they are the entry point.
 */
const Overview = lazy(() => import('./screens/Overview').then((m) => ({ default: m.Overview })));
const Operators = lazy(() => import('./screens/Operators').then((m) => ({ default: m.Operators })));
const OperatorDetail = lazy(() =>
  import('./screens/OperatorDetail').then((m) => ({ default: m.OperatorDetail })),
);
const Operations = lazy(() =>
  import('./screens/Operations').then((m) => ({ default: m.Operations })),
);
const AdminOperationDetail = lazy(() =>
  import('./screens/AdminOperationDetail').then((m) => ({ default: m.AdminOperationDetail })),
);
const Analytics = lazy(() => import('./screens/Analytics').then((m) => ({ default: m.Analytics })));
const Audit = lazy(() => import('./screens/Audit').then((m) => ({ default: m.Audit })));
const Emergency = lazy(() => import('./screens/Emergency').then((m) => ({ default: m.Emergency })));

/** A minimal splash while a lazily loaded screen arrives. */
function RouteFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app text-ink">
      <Logo size={30} />
      <p className="text-sm text-ink-muted" role="status">
        Opening the control plane
      </p>
    </div>
  );
}

export function App() {
  const loadSession = useAuthStore((state) => state.loadSession);

  // Read the Admin session once on boot so route protection knows where to send
  // the Admin. Until it resolves, protected routes show a minimal splash.
  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/mfa" element={<MfaVerify />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Overview />
            </RequireAuth>
          }
        />
        <Route
          path="/operators"
          element={
            <RequireAuth>
              <Operators />
            </RequireAuth>
          }
        />
        <Route
          path="/operators/:id"
          element={
            <RequireAuth>
              <OperatorDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/operations"
          element={
            <RequireAuth>
              <Operations />
            </RequireAuth>
          }
        />
        <Route
          path="/operations/:id"
          element={
            <RequireAuth>
              <AdminOperationDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/analytics"
          element={
            <RequireAuth>
              <Analytics />
            </RequireAuth>
          }
        />
        <Route
          path="/audit"
          element={
            <RequireAuth>
              <Audit />
            </RequireAuth>
          }
        />
        <Route
          path="/emergency"
          element={
            <RequireAuth>
              <Emergency />
            </RequireAuth>
          }
        />
      </Routes>
    </Suspense>
  );
}
