import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import LoginPage from './features/auth/LoginPage';
import { RequirePermission, RequireSignedIn, SessionGate } from './features/auth/guards';
import HomePage from './features/home/HomePage';
import NotFoundPage from './features/NotFoundPage';
import UsersPage from './features/users/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route element={<SessionGate />}>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireSignedIn />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route
              path="settings/users"
              element={
                <RequirePermission permission="users:manage">
                  <UsersPage />
                </RequirePermission>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
