import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

/**
 * List view for all gadgets.  Displays gadgets with their type and active state.
 * Provides a link to create a new gadget or edit existing ones.
 */
export default function GadgetsList() {
  const [gadgets, setGadgets] = useState([]);

  useEffect(() => {
    // Fetch the gadgets from the API.  Because the api client is
    // configured with a base URL that already includes `/api`, we should
    // not prefix our request with `/api` here.  Without the extra
    // prefix, the final URL resolves to `/api/gadgets` on the server.
    api
      .get('/gadgets')
      .then((res) => setGadgets(res.data || []))
      .catch((err) => {
        console.error('[Gadgets/List] Failed to load gadgets:', err);
      });
  }, []);

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
      <table className="su-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {gadgets.map((g) => (
            <tr key={g.id}>
              <td>{g.name}</td>
              <td>{g.gadget_type}</td>
              <td>{g.is_active ? 'Yes' : 'No'}</td>
              <td>
                <Link to={`/admin/gadgets/${g.id}`}>Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
