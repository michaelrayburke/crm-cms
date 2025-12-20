import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

/**
 * List view for all gizmos.
 * - Entire row is clickable and opens the edit page.
 * - Also includes a separate "Edit" link.
 */
export default function GizmosList() {
  const [gizmos, setGizmos] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
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

  const handleRowClick = (id) => {
    navigate(`/admin/gizmos/${id}`);
  };

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
              <tr
                key={g.id}
                onClick={() => handleRowClick(g.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>{g.name}</td>
                <td>{g.gizmo_type}</td>
                <td>{g.is_enabled ? 'Yes' : 'No'}</td>
                <td>
                  <Link
                    className="su-link"
                    to={`/admin/gizmos/${g.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
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
