import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// Import the named api client from the shared library.  Do not use a default import
// because api.js does not export a default.  Named import ensures the build
// succeeds and matches how other components import the API.
import { api } from '../../lib/api';

/**
 * Form for creating or editing a Gizmo.  If an ID is present in the URL
 * parameters, the form loads the existing gizmo; otherwise it starts with
 * blank defaults.  The config field is edited as JSON in a textarea.
 */
export default function GizmoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    gizmo_type: 'integration',
    description: '',
    icon: '',
    config: '{}',
    is_enabled: true,
  });

  useEffect(() => {
    if (isEditing) {
      // FIX: base-relative path; api client adds /api
      api
        .get(`api/gizmos/${id}`)
        .then((res) => {
          const data = res.data || {};
          setForm({
            ...form,
            ...data,
            config: JSON.stringify(data.config || {}, null, 2),
          });
        })
        .catch((err) => {
          console.error('[Gizmos/Form] Failed to load gizmo', err);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let payload;
    try {
      payload = {
        ...form,
        config: JSON.parse(form.config || '{}'),
      };
    } catch (jsonErr) {
      alert('Config must be valid JSON');
      return;
    }

    // FIX: remove /api prefix from paths; api client already has baseURL
    const req = isEditing
      ? api.put(`api/gizmos/${id}`, payload)
      : api.post('api/gizmos', payload);

    req
      .then(() => {
        // After saving, go back to the Gizmos list in the admin.
        navigate('/admin/gizmos');
      })
      .catch((err) => {
        console.error('[Gizmos/Form] Failed to save gizmo', err);
        alert('Failed to save gizmo');
      });
  };

  // Define a default placeholder for the config textarea.
  const configPlaceholder = '{\n  "apiKey": "..."\n}';

  return (
    <div className="su-page">
      <header className="su-page-header">
        <h1>{isEditing ? 'Edit Gizmo' : 'Add Gizmo'}</h1>
      </header>
      <form className="su-form" onSubmit={handleSubmit}>
        <div className="su-form-group">
          <label>Name</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="su-form-group">
          <label>Slug</label>
          <input
            name="slug"
            value={form.slug}
            onChange={handleChange}
            placeholder="Auto-generated if left blank"
          />
        </div>

        <div className="su-form-group">
          <label>Type</label>
          <select
            name="gizmo_type"
            value={form.gizmo_type}
            onChange={handleChange}
          >
            <option value="integration">Integration</option>
            <option value="feature">Feature</option>
            <option value="utility">Utility</option>
          </select>
        </div>

        <div className="su-form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
          />
        </div>

        <div className="su-form-group">
          <label>Icon (optional)</label>
          <input name="icon" value={form.icon} onChange={handleChange} />
        </div>

        <div className="su-form-group">
          <label>Config (JSON)</label>
          <textarea
            name="config"
            value={form.config}
            onChange={handleChange}
            rows={6}
            placeholder={configPlaceholder}
          />
        </div>

        <div className="su-form-group">
          <label>
            <input
              type="checkbox"
              name="is_enabled"
              checked={form.is_enabled}
              onChange={handleChange}
            />
            Enabled
          </label>
        </div>

        <div className="su-form-group">
          <button type="submit" className="su-btn su-btn-primary">
            {isEditing ? 'Update' : 'Create'} Gizmo
          </button>
        </div>
      </form>
    </div>
  );
}
