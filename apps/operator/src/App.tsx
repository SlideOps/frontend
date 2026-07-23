import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { Capabilities } from './screens/Capabilities';
import { CapabilityDetail } from './screens/CapabilityDetail';
import { History } from './screens/History';
import { Login } from './screens/Login';
import { MfaVerify } from './screens/MfaVerify';
import { NodeDetail } from './screens/NodeDetail';
import { NodeRegister } from './screens/NodeRegister';
import { Nodes } from './screens/Nodes';
import { OperationDetail } from './screens/OperationDetail';
import { Register } from './screens/Register';
import { Security } from './screens/Security';
import { Workspace } from './screens/Workspace';
import { useAuthStore } from './store/auth';

export function App() {
  const loadSession = useAuthStore((state) => state.loadSession);

  // Read the session once on boot so route protection knows where to send the
  // Operator. Until it resolves, protected routes show a minimal splash.
  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  return (
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
        path="/capabilities/:key"
        element={
          <RequireAuth>
            <CapabilityDetail />
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
        path="/security"
        element={
          <RequireAuth>
            <Security />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
