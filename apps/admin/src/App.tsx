import { Route, Routes } from 'react-router-dom';
import { Login } from './screens/Login';
import { Overview } from './screens/Overview';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Overview />} />
    </Routes>
  );
}
