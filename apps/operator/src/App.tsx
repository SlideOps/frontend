import { Logo } from '@slideops/icons';
import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { Capabilities } from './screens/Capabilities';
import { CapabilityDetail } from './screens/CapabilityDetail';
import { History } from './screens/History';
import { Automations } from './screens/Automations';
import { Login } from './screens/Login';
import { MfaVerify } from './screens/MfaVerify';
import { NodeRegister } from './screens/NodeRegister';
import { Nodes } from './screens/Nodes';
import { Register } from './screens/Register';
import { Security } from './screens/Security';
import { Workspace } from './screens/Workspace';
import { useAuthStore } from './store/auth';

/*
 * The heavy views load lazily and split at the route: Node detail draws a health
 * chart, Operation detail embeds the live terminal, and Reports render a
 * generated document. Splitting them keeps the first load of the Operator app
 * small, while the light list and form screens stay eager.
 */
const NodeDetail = lazy(() => import('./screens/NodeDetail').then((m) => ({ default: m.NodeDetail })));
const OperationDetail = lazy(() =>
  import('./screens/OperationDetail').then((m) => ({ default: m.OperationDetail })),
);
const Reports = lazy(() => import('./screens/Reports').then((m) => ({ default: m.Reports })));
const CapabilityMatrix = lazy(() =>
  import('./screens/CapabilityMatrix').then((m) => ({ default: m.CapabilityMatrix })),
);
const AutomationNew = lazy(() =>
  import('./screens/AutomationNew').then((m) => ({ default: m.AutomationNew })),
);
const AutomationDetail = lazy(() =>
  import('./screens/AutomationDetail').then((m) => ({ default: m.AutomationDetail })),
);
const Extensions = lazy(() => import('./screens/Extensions').then((m) => ({ default: m.Extensions })));

/** A minimal splash while a lazily loaded screen arrives. */
function RouteFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-app text-ink">
      <Logo size={30} />
      <p className="text-sm text-ink-muted" role="status">
        Loading
      </p>
    </div>
  );
}

export function App() {
  const loadSession = useAuthStore((state) => state.loadSession);

  // Read the session once on boot so route protection knows where to send the
  // Operator. Until it resolves, protected routes show a minimal splash.
  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/mfa" element={<MfaVerify />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Workspace />
            </RequireAuth>
          }
        />
        <Route
          path="/nodes"
          element={
            <RequireAuth>
              <Nodes />
            </RequireAuth>
          }
        />
        <Route
          path="/nodes/new"
          element={
            <RequireAuth>
              <NodeRegister />
            </RequireAuth>
          }
        />
        <Route
          path="/nodes/:id"
          element={
            <RequireAuth>
              <NodeDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/capabilities"
          element={
            <RequireAuth>
              <Capabilities />
            </RequireAuth>
          }
        />
        <Route
          path="/capabilities/matrix"
          element={
            <RequireAuth>
              <CapabilityMatrix />
            </RequireAuth>
          }
        />
        <Route
          path="/capabilities/:key"
          element={
            <RequireAuth>
              <CapabilityDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/automations"
          element={
            <RequireAuth>
              <Automations />
            </RequireAuth>
          }
        />
        <Route
          path="/automations/new"
          element={
            <RequireAuth>
              <AutomationNew />
            </RequireAuth>
          }
        />
        <Route
          path="/automations/:id"
          element={
            <RequireAuth>
              <AutomationDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/extensions"
          element={
            <RequireAuth>
              <Extensions />
            </RequireAuth>
          }
        />
        <Route
          path="/operations"
          element={
            <RequireAuth>
              <History />
            </RequireAuth>
          }
        />
        <Route
          path="/operations/:id"
          element={
            <RequireAuth>
              <OperationDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAuth>
              <Reports />
            </RequireAuth>
          }
        />
        <Route
          path="/security"
          element={
            <RequireAuth>
              <Security />
            </RequireAuth>
          }
        />
      </Routes>
    </Suspense>
  );
}
