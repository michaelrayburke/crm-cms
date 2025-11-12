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

export default function App(){
  return (
    <SettingsProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/quick-builder" element={<AdminLayout><QuickBuilderShim /></AdminLayout>} />
        <Route path="/admin" element={<AdminLayout><Dashboard /></AdminLayout>} />
        <Route path="/admin/settings" element={<AdminLayout><SettingsPage /></AdminLayout>} />
        <Route path="/admin/menus" element={<AdminLayout><MenusPage /></AdminLayout>} />
        <Route path="/admin/headers" element={<AdminLayout><HeadersPage /></AdminLayout>} />
        <Route path="/admin/footers" element={<AdminLayout><FootersPage /></AdminLayout>} />
        <Route path="/admin/users" element={<AdminLayout><UsersPage /></AdminLayout>} />
        <Route path="/admin/taxonomies" element={<AdminLayout><TaxonomiesPage /></AdminLayout>} />

        <Route path="/admin/content" element={<AdminLayout><ContentIndex /></AdminLayout>} />
        <Route path="/admin/content/:typeSlug" element={<AdminLayout><TypeList /></AdminLayout>} />
        <Route path="/admin/content/:typeSlug/:id" element={<AdminLayout><TypeEditor /></AdminLayout>} />
      </Routes>
    </SettingsProvider>
  );
}
