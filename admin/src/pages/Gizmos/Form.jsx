import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

export default function GizmoForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    gizmo_key: "",
    description: "",
  });

  const isNew = id === "new";

  useEffect(() => {
    if (!isNew) {
      api.get(`/api/gizmos/${id}`)
        .then((res) => setForm(res.data))
        .catch((err) => console.error("Failed to load gizmo", err));
    }
  }, [id, isNew]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit() {
    if (isNew) {
      api.post("/api/gizmos", form)
        .then(() => navigate("/gizmos"))
        .catch((err) => console.error("Failed to create gizmo", err));
    } else {
      api.put(`/api/gizmos/${id}`, form)
        .then(() => navigate("/gizmos"))
        .catch((err) => console.error("Failed to update gizmo", err));
    }
  }

  return (
    <div className="page">
      <h1>{isNew ? "Add Gizmo" : "Edit Gizmo"}</h1>

      <div className="form">
        <label>Name</label>
        <input name="name" value={form.name} onChange={handleChange} />

        <label>Key</label>
        <input name="gizmo_key" value={form.gizmo_key} onChange={handleChange} />

        <label>Description</label>
        <textarea name="description" value={form.description} onChange={handleChange} />

        <button className="btn-primary" onClick={handleSubmit}>
          Save Gizmo
        </button>
      </div>
    </div>
  );
}
