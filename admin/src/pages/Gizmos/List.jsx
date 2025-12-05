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
    // Fetch gizmos. The admin api client will prepend API_BASE
    // (e.g. "https://serviceup-api.onrender.com"), so this becomes
    //   https://serviceup-api.onrender.com/api/gizmos
    api
      .get('/api/gizmos')
      .then((data) => {
        console.log('[Gizmos/List] data =', data);
        setGizmos(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('[Gizmos/List] Failed to load gizmos:', err);
        setError(err);
      });
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
        <div className="su-alert su-alert-danger">
          Failed to load gizmos: {error.message || 'Unknown error'}
        </div>
      )}

      <table className="su-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Enabled?</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {gizmos.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center text-sm text-gray-500">
                No gizmos yet.
              </td>
            </tr>
          ) : (
            gizmos.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td>
                <td>{g.gizmo_type}</td>
                <td>{g.is_enabled ? 'Yes' : 'No'}</td>
                <td>
                  <Link className="su-link" to={`/admin/gizmos/${g.id}`}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
