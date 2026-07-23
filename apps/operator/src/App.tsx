import { Route, Routes } from 'react-router-dom';
import { Dashboard } from './screens/Dashboard';
import { Login } from './screens/Login';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Dashboard />} />
    </Routes>
  );
}
