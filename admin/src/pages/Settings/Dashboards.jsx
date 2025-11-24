// pseudo-structure
import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
// maybe reuse some DashboardLayoutEditor component if you have it

export default function DashboardSettingsPage() {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState("ADMIN");
  const [layout, setLayout] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load roles for picker
  useEffect(() => {
    (async () => {
      try {
        const rolesData = await api.get("/api/roles");
        setRoles(rolesData || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Load dashboard layout when role changes
  useEffect(() => {
    if (!selectedRole) return;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get(`/api/dashboard/role/${selectedRole}`);
        setLayout(res?.layout || []);
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load layout");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedRole]);

  async function saveLayout(nextLayout) {
    try {
      setSaving(true);
      setError("");
      const res = await api.post(`/api/dashboard/role/${selectedRole}`, {
        layout: nextLayout,
      });
      setLayout(res.layout || nextLayout);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to save layout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="su-page">
      <div className="su-page-header">
        <h1>Dashboard Builder</h1>
        <p>Admins can design per-role dashboards. Editors just see them.</p>
      </div>

      {/* Role picker */}
      <div className="su-card" style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13 }}>
          Role
          <select
            className="su-select"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.slug}>
                {r.label} ({r.slug})
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Here you drop in the widget layout editor */}
      <div className="su-card">
        {loading ? (
          <p>Loading layout…</p>
        ) : (
          <DashboardLayoutEditor
            layout={layout}
            onChange={setLayout}
            onSave={saveLayout}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}
