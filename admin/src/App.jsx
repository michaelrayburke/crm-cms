import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import { SettingsProvider } from './context/SettingsContext';

import Dashboard from './pages/Dashboards';
import SettingsPage from './pages/Settings';
import MenusPage from './pages/Menus';
import HeadersPage from './pages/Headers';
import FootersPage from './pages/Footers';
import UsersPage from './pages/Users';
import TaxonomiesPage from './pages/Taxonomies';
import ContentIndex from './pages/Content';
import TypeList from './pages/Content/TypeList';
import TypeEditor from './pages/Content/Editor';
import QuickBuilderShim from './quickbuilder/QuickBuilderShim';
import LoginPage from './pages/Login';

function RequireAuth({ children }) {
  // Very simple auth gate for now: just check for token in localStorage.
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('serviceup.jwt')
      : null;

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <SettingsProvider>
      <Routes>
        {/* Root redirects to admin dashboard (which is auth-protected) */}
        <Route path="/" element={<Navigate to="/admin" replace />} />

        {/* Public login route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Main admin pages (all behind RequireAuth) */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/settings"
          element{
            <RequireAuth>
              <AdminLayout>
                <SettingsPage />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/menus"
          element={
            <RequireAuth>
              <AdminLayout>
                <MenusPage />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/headers"
          element={
            <RequireAuth>
              <AdminLayout>
                <HeadersPage />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/footers"
          element={
            <RequireAuth>
              <AdminLayout>
                <FootersPage />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAuth>
              <AdminLayout>
                <UsersPage />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/taxonomies"
          element={
            <RequireAuth>
              <AdminLayout>
                <TaxonomiesPage />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/content"
          element={
            <RequireAuth>
              <AdminLayout>
                <ContentIndex />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/content/:typeSlug"
          element={
            <RequireAuth>
              <AdminLayout>
                <TypeList />
              </AdminLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/content/:typeSlug/:id"
          element={
            <RequireAuth>
              <AdminLayout>
                <TypeEditor />
              </AdminLayout>
            </RequireAuth>
          }
        />

        {/* Quick builder bridge (also behind auth) */}
        <Route
          path="/quick-builder/*"
          element={
            <RequireAuth>
              <AdminLayout>
                <QuickBuilderShim />
              </AdminLayout>
            </RequireAuth>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </SettingsProvider>
  );
}

export default App;
