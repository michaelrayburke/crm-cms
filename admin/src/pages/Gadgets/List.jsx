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
    api.get('/gadgets').then((res) => setGadgets(res.data));
  }, []);
  return (
    <div className="su-page">
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