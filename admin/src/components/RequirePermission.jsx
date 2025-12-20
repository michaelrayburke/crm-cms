// admin/src/components/RequirePermission.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useHasPermission from '../hooks/useHasPermission'; // ⬅️ changed

export default function RequirePermission({ slug, children }) {
  const { user, loadingAuth, loadingPermissions } = useAuth();
  const has = useHasPermission(slug);

  if (loadingAuth) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Checking authentication…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loadingPermissions) {
    return (
      <div className="p-6 text-sm text-gray-500">
        Checking permissions…
      </div>
    );
  }

  if (!has) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You don&apos;t have permission to access this area.
        </div>
      </div>
    );
  }

  return children;
}
