import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { Login } from './screens/Login';
import { MfaVerify } from './screens/MfaVerify';
import { Overview } from './screens/Overview';
import { useAuthStore } from './store/auth';

export function App() {
  const loadSession = useAuthStore((state) => state.loadSession);

  // Read the Admin session once on boot so route protection knows where to send
  // the Admin. Until it resolves, protected routes show a minimal splash.
  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  return (
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
    </Routes>
  );
}
