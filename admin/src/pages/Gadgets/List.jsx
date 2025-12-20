import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

/**
 * List view for all gadgets. Displays gadgets with their type and active state.
 * - Entire row is clickable and opens the edit page.
 * - Also includes a separate "Edit" link in the last column.
 */
export default function GadgetsList() {
  const [gadgets, setGadgets] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/api/gadgets')
      .then((data) => {
        console.log('[Gadgets/List] data =', data);
        setGadgets(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('[Gadgets/List] Failed to load gadgets:', err);
        setError(err);
      });
  }, []);

  const handleRowClick = (id) => {
    navigate(`/admin/gadgets/${id}`);
  };

  return (
    <div className="su-page">
      {/* Breadcrumb navigation */}
      <nav className="su-breadcrumbs" style={{ marginBottom: '1rem' }}>
        <Link to="/admin">Dashboard</Link> / <span>Gadgets</span>
      </nav>

      <header className="su-page-header">
        <h1>Gadgets</h1>
        <Link className="su-btn su-btn-primary" to="/admin/gadgets/new">
          Add Gadget
        </Link>
      </header>

      {error && (
        <div className="su-alert su-alert-danger">
          Failed to load gadgets: {error.message || 'Unknown error'}
        </div>
      )}

      <table className="su-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Type</th>
            <th>Active?</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {gadgets.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-sm text-gray-500">
                No gadgets yet.
              </td>
            </tr>
          ) : (
            gadgets.map((g) => (
              <tr
                key={g.id}
                onClick={() => handleRowClick(g.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>{g.name}</td>
                <td>{g.slug}</td>
                <td>{g.gadget_type}</td>
                <td>{g.is_active ? 'Yes' : 'No'}</td>
                <td>
                  <Link
                    className="su-link"
                    to={`/admin/gadgets/${g.id}`}
                    // Prevent row click from firing when the link itself is clicked
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
