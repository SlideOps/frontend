import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { Dashboard } from './screens/Dashboard';
import { Login } from './screens/Login';
import { MfaVerify } from './screens/MfaVerify';
import { Register } from './screens/Register';
import { Security } from './screens/Security';
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
            <Dashboard />
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
