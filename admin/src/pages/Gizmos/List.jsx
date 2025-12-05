import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

/**
 * List view for all gizmos.
 * Fetches a list of all gizmos from the API and displays them in a table with
 * links to create a new gizmo or edit existing ones.
 */
export default function GizmosList() {
  const [gizmos, setGizmos] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch gizmos using a root-relative path.  The API client already
    // prepends the `/api` base, so we omit it here.  This results in
    // requests to `/api/gizmos` at runtime.
    api
      .get('/gizmos')
      .then((res) => setGizmos(res.data || []))
      .catch((err) => setError(err));
  }, []);

  return (
    <div className="su-page">
      {/* Breadcrumb navigation */}
      <nav className="su-breadcrumbs" style={{ marginBottom: '1rem' }}>
        <Link to="/admin">Dashboard</Link> / <span>Gizmos</span>
      </nav>
      <header className="su-page-header">
        <h1>Gizmos</h1>
        <Link className="su-btn su-btn-primary" to="/admin/gizmos/new">
          Add Gizmo
        </Link>
      </header>
      {error && (
        <div className="su-alert su-alert-danger">{error.message}</div>
      )}
      <table className="su-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Enabled</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {gizmos.map((g) => (
            <tr key={g.id}>
              <td>{g.name}</td>
              <td>{g.gizmo_type}</td>
              <td>{g.is_enabled ? 'Yes' : 'No'}</td>
              <td>
                <Link to={`/admin/gizmos/${g.id}`}>Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
