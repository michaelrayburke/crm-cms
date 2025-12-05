import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

export default function GizmosList() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/api/gizmos")
      .then((res) => setItems(res.data || []))
      .catch((err) => console.error("Failed to load gizmos", err));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Gizmos</h1>
        <Link to="/gizmos/new" className="btn-primary">+ Add Gizmo</Link>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Key</th>
            <th>Updated</th>
          </tr>
        </thead>

        <tbody>
          {items.map((g) => (
            <tr key={g.id}>
              <td>
                <Link to={`/gizmos/${g.id}`}>{g.name}</Link>
              </td>
              <td>{g.gizmo_key}</td>
              <td>{new Date(g.updated_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
