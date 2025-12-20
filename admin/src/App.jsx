import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider } from './context/AuthContext';

import Dashboard from './pages/Dashboards';
import SettingsPage from './pages/Settings';
import MenusPage from './pages/Menus';
import HeadersPage from './pages/Headers';
import FootersPage from './pages/Footers';
import RolesPage from './pages/Settings/Roles';
import SettingsDashboardsPage from "./pages/Settings/Dashboards";
import UsersPage from './pages/Users';
import TaxonomiesPage from './pages/Taxonomies';
import ContentIndex from './pages/Content';
import TypeList from './pages/Content/TypeList';
import TypeEditor from './pages/Content/Editor';
import LoginPage from './pages/Login';
import PermissionsPage from './pages/Settings/Permissions';
import RequirePermission from './components/RequirePermission';
import QuickBuilderPage from "./pages/ContentTypes/QuickBuilder";
import EntryViews from "./pages/Settings/EntryViews.jsx";
import ListViewsSettings from "./pages/Settings/ListViews.jsx";

import GizmosList from './pages/Gizmos/List';
import GizmoForm from './pages/Gizmos/Form';
import GadgetsList from './pages/Gadgets/List';
import GadgetForm from './pages/Gadgets/Form';
import WidgetsList from './pages/Widgets/List';
import WidgetForm from './pages/Widgets/Form';
import GizmoPacksPage from './pages/GizmoPacks';


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
    <AuthProvider>
      <SettingsProvider>
        <Routes>
          {/* Root redirects to admin dashboard (auth‑protected) */}
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
            element={
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
                <RequirePermission slug="users.manage">
                  <AdminLayout>
                    <UsersPage />
                  </AdminLayout>
                </RequirePermission>
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

          {/* List pages now support an optional view slug segment.
             The new route "/admin/content/:typeSlug/view/:viewSlug" must appear
             before the entry route so it matches when "view" is present. */}
          <Route
            path="/admin/content/:typeSlug/view/:viewSlug"
            element={
              <RequireAuth>
                <AdminLayout>
                  <TypeList />
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
            path="/admin/content/:typeSlug/:entryId"
            element={
              <RequireAuth>
                <AdminLayout>
                  <TypeEditor />
                </AdminLayout>
              </RequireAuth>
            }
          />

          <Route
            path="/admin/settings/roles"
            element={
              <RequireAuth>
                <RequirePermission slug="roles.manage">
                  <AdminLayout>
                    <RolesPage />
                  </AdminLayout>
                </RequirePermission>
              </RequireAuth>
            }
          />

          <Route
            path="/admin/settings/dashboards"
            element={
              <RequireAuth>
                <RequirePermission slug="roles.manage">
                  <AdminLayout>
                    <SettingsDashboardsPage />
                  </AdminLayout>
                </RequirePermission>
              </RequireAuth>
            }
          />

          <Route
            path="/admin/settings/permissions"
            element={
              <RequireAuth>
                <RequirePermission slug="roles.manage">
                  <AdminLayout>
                    <PermissionsPage />
                  </AdminLayout>
                </RequirePermission>
              </RequireAuth>
            }
          />

          {/* Entry editor views: allow dynamic segments for type slug and view slug.
             When both :typeSlug and :viewSlug are present we render the edit stage;
             with only :typeSlug we render the list of entry editor views; with none
             we list all content types.  This mirrors the list‑view routing. */}
          <Route
            path="/admin/settings/entry-views/:typeSlug/:viewSlug"
            element={
              <RequireAuth>
                <RequirePermission slug="roles.manage">
                  <AdminLayout>
                    <EntryViews />
                  </AdminLayout>
                </RequirePermission>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/settings/entry-views/:typeSlug"
            element={
              <RequireAuth>
                <RequirePermission slug="roles.manage">
                  <AdminLayout>
                    <EntryViews />
                  </AdminLayout>
                </RequirePermission>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/settings/entry-views"
            element={
              <RequireAuth>
                <RequirePermission slug="roles.manage">
                  <AdminLayout>
                    <EntryViews />
                  </AdminLayout>
                </RequirePermission>
              </RequireAuth>
            }
          />

          {/* List views settings: allow dynamic segments for type slug and view slug. */}
          <Route
            path="/admin/settings/list-views/:typeSlug/:viewSlug"
            element={
              <RequireAuth>
                <RequirePermission slug="roles.manage">
                  <AdminLayout>
                    <ListViewsSettings />
                  </AdminLayout>
                </RequirePermission>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/settings/list-views/:typeSlug"
            element={
              <RequireAuth>
                <RequirePermission slug="roles.manage">
                  <AdminLayout>
                    <ListViewsSettings />
                  </AdminLayout>
                </RequirePermission>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/settings/list-views"
            element={
              <RequireAuth>
                <RequirePermission slug="roles.manage">
                  <AdminLayout>
                    <ListViewsSettings />
                  </AdminLayout>
                </RequirePermission>
              </RequireAuth>
            }
          />

          <Route
            path="/admin/quick-builder"
            element={
              <RequireAuth>
                <RequirePermission slug="roles.manage">
                  <AdminLayout>
                    <QuickBuilderPage />
                  </AdminLayout>
                </RequirePermission>
              </RequireAuth>
            }
          />

          {/* Gizmos routes */}
          <Route
            path="/admin/gizmos"
            element={
              <RequireAuth>
                <AdminLayout>
                  <GizmosList />
                </AdminLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/gizmos/new"
            element={
              <RequireAuth>
                <AdminLayout>
                  <GizmoForm />
                </AdminLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/gizmos/:id"
            element={
              <RequireAuth>
                <AdminLayout>
                  <GizmoForm />
                </AdminLayout>
              </RequireAuth>
            }
          />

          {/* Gadgets routes */}
          <Route
            path="/admin/gadgets"
            element={
              <RequireAuth>
                <AdminLayout>
                  <GadgetsList />
                </AdminLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/gadgets/new"
            element={
              <RequireAuth>
                <AdminLayout>
                  <GadgetForm />
                </AdminLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/gadgets/:id"
            element={
              <RequireAuth>
                <AdminLayout>
                  <GadgetForm />
                </AdminLayout>
              </RequireAuth>
            }
          />
{/* Widgets */}
<Route path="/admin/widgets" element={<WidgetsList />} />
<Route path="/admin/widgets/new" element={<WidgetForm />} />
<Route path="/admin/widgets/:id" element={<WidgetForm />} />
          <Route
            path="/admin/gizmo-packs"
            element={
              <RequireAuth>
                <AdminLayout>
                  <GizmoPacksPage />
                </AdminLayout>
              </RequireAuth>
            }
          />
          

          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
