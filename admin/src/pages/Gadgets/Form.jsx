import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

export default function GadgetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
  });

  const [allGizmos, setAllGizmos] = useState([]);
  const [assigned, setAssigned] = useState([]);

  useEffect(() => {
    api.get("/api/gizmos")
      .then((res) => setAllGizmos(res.data || []))
      .catch((err) => console.error("Failed to load gizmos list", err));

    if (!isNew) {
      api.get(`/api/gadgets/${id}`)
        .then((res) => setForm(res.data))
        .catch((err) => console.error("Failed to load gadget", err));

      api.get(`/api/gadgets/${id}/gizmos`)
        .then((res) => setAssigned(res.data || []))
        .catch((err) => console.error("Failed to load assigned gizmos", err));
    }
  }, [id, isNew]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function saveGadget() {
    if (isNew) {
      api.post("/api/gadgets", form)
        .then(() => navigate("/gadgets"))
        .catch((err) => console.error("Failed to create gadget", err));
    } else {
      api.put(`/api/gadgets/${id}`, form)
        .then(() => navigate("/gadgets"))
        .catch((err) => console.error("Failed to update gadget", err));
    }
  }

  function addGizmo(gizmoId) {
    api.post(`/api/gadgets/${id}/gizmos`, { gizmo_id: gizmoId })
      .then(() => {
        setAssigned((prev) => [...prev, allGizmos.find((g) => g.id === gizmoId)]);
      })
      .catch((err) => console.error("Failed to add gizmo", err));
  }

  function removeGizmo(gizmoId) {
    api.delete(`/api/gadgets/${id}/gizmos/${gizmoId}`)
      .then(() => {
        setAssigned((prev) => prev.filter((z) => z.id !== gizmoId));
      })
      .catch((err) => console.error("Failed to remove gizmo", err));
  }

  return (
    <div className="page">
      <h1>{isNew ? "Add Gadget" : "Edit Gadget"}</h1>

      <div className="form">
        <label>Name</label>
        <input name="name" value={form.name} onChange={handleChange} />

        <label>Slug</label>
        <input name="slug" value={form.slug} onChange={handleChange} />

        <label>Description</label>
        <textarea name="description" value={form.description} onChange={handleChange} />

        <button className="btn-primary" onClick={saveGadget}>
          Save Gadget
        </button>
      </div>

      {!isNew && (
        <>
          <h2>Assigned Gizmos</h2>
          <ul>
            {assigned.map((g) => (
              <li key={g.id}>
                {g.name}
                <button onClick={() => removeGizmo(g.id)}>Remove</button>
              </li>
            ))}
          </ul>

          <h3>Add Gizmo</h3>
          {allGizmos
            .filter((g) => !assigned.some((a) => a.id === g.id))
            .map((g) => (
              <button key={g.id} onClick={() => addGizmo(g.id)}>
                + {g.name}
              </button>
            ))}
        </>
      )}
    </div>
  );
}
