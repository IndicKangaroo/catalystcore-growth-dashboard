import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import AppsPage from './features/apps/AppsPage';
import LoginPage from './features/auth/LoginPage';
import { RequirePermission, RequireSignedIn, SessionGate } from './features/auth/guards';
import OverviewPage from './features/home/OverviewPage';
import NotFoundPage from './features/NotFoundPage';
import UsersPage from './features/users/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route element={<SessionGate />}>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireSignedIn />}>
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route
              path="apps"
              element={
                <RequirePermission permission="apps:read">
                  <AppsPage />
                </RequirePermission>
              }
            />
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
