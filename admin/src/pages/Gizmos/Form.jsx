import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api';

// Utility to convert a string into a URL friendly slug.
function slugify(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Form for creating or editing a Gizmo.
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

  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isEditing) {
      api
        .get(`/api/gizmos/${id}`)
        .then((data) => {
          console.log('[Gizmos/Form] loaded gizmo =', data);
          setForm((prev) => ({
            ...prev,
            ...data,
            config: JSON.stringify(data.config || {}, null, 2),
          }));
        })
        .catch((err) => {
          console.error('[Gizmos/Form] Failed to load gizmo', err);
        });
    }
  }, [isEditing, id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const updated = { ...f, [name]: type === 'checkbox' ? checked : value };
      if (name === 'name' && !f.slug) {
        updated.slug = slugify(value);
      }
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let payload;
    try {
      payload = {
        ...form,
        config: JSON.parse(form.config || '{}'),
      };
    } catch {
      alert('Config must be valid JSON');
      return;
    }

    const req = isEditing
      ? api.put(`/api/gizmos/${id}`, payload)
      : api.post('/api/gizmos', payload);

    req
      .then(() => {
        setToast({ type: 'success', message: 'Gizmo saved successfully' });
        setTimeout(() => {
          setToast(null);
          navigate('/admin/gizmos');
        }, 1500);
      })
      .catch((err) => {
        console.error('[Gizmos/Form] Failed to save gizmo', err);
        setToast({ type: 'error', message: 'Failed to save gizmo' });
        setTimeout(() => setToast(null), 3000);
      });
  };

  const configPlaceholder = '{\n  "apiKey": "..."\n}';

  return (
    <div className="su-page">
      {toast && (
        <div
          className={`su-toast su-toast-${toast.type}`}
          style={{ marginBottom: '1rem' }}
        >
          {toast.message}
        </div>
      )}

      <nav className="su-breadcrumbs" style={{ marginBottom: '1rem' }}>
        <Link to="/admin">Dashboard</Link> / <Link to="/admin/gizmos">Gizmos</Link> /
        <span>{isEditing ? 'Edit Gizmo' : 'Add Gizmo'}</span>
      </nav>

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
