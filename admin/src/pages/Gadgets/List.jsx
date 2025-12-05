import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

export default function GadgetsList() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/api/gadgets")
      .then((res) => setItems(res.data || []))
      .catch((err) => console.error("Failed to load gadgets", err));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Gadgets</h1>
        <Link to="/gadgets/new" className="btn-primary">+ Add Gadget</Link>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Updated</th>
          </tr>
        </thead>

        <tbody>
          {items.map((g) => (
            <tr key={g.id}>
              <td>
                <Link to={`/gadgets/${g.id}`}>{g.name}</Link>
              </td>
              <td>{g.slug}</td>
              <td>{new Date(g.updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
