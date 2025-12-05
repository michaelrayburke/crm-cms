import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
      api.get(`/gizmos/${id}`)
        .then((res) => {
          const data = res.data;
          setForm({
            ...data,
            config: JSON.stringify(data.config || {}, null, 2),
          });
        })
        .catch((err) => {
          console.error(err);
          // In a real app, show error to user
        });
    }
  }, [isEditing, id]);

  // Utility to generate URL-friendly slugs from arbitrary strings.  If the
  // user types a name and the slug field is empty (i.e. not explicitly set),
  // this function will convert the name to a slug.  We use a simple
  // replacement of non‑alphanumeric characters with dashes and lowercasing.
  const slugify = (str) =>
    (str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  // Toast state for user feedback.  When set, a success or error alert is
  // displayed at the top of the page.  Each toast has a type (success
  // or danger) and a message.  Toasts are cleared on navigation.
  const [toast, setToast] = useState(null);
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: type === 'checkbox' ? checked : value };
      // Auto‑generate slug from name if slug is blank and the user edits the name
      if (name === 'name' && !isEditing && !f.slug) {
        next.slug = slugify(value);
      }
      return next;
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
    } catch (jsonErr) {
      alert('Config must be valid JSON');
      return;
    }
    const req = isEditing
      ? api.put(`/gizmos/${id}`, payload)
      : api.post('/gizmos', payload);
    req
      .then(() => {
        // Display a success toast and redirect back to the list
        setToast({ type: 'success', message: 'Gizmo saved successfully' });
        navigate('/admin/gizmos');
      })
      .catch((err) => {
        console.error(err);
        setToast({ type: 'danger', message: err?.response?.data?.error || 'Failed to save gizmo' });
      });
  };
  // Define a default placeholder for the config textarea.  Using a separate
  // variable avoids invalid escape sequences in JSX attributes and makes
  // editing easier.  The placeholder shows a basic JSON shape with an apiKey
  // property.
  const configPlaceholder = '{\n  "apiKey": "..."\n}';
  return (
    <div className="su-page">
      {/* Display toast notifications */}
      {toast && (
        <div className={`su-alert su-alert-${toast.type}`} style={{ marginBottom: '1rem' }}>
          {toast.message}
        </div>
      )}
      <header className="su-page-header">
        {/* Breadcrumb navigation */}
        <nav className="su-breadcrumb" style={{ marginBottom: '1rem' }}>
          <Link to="/admin">Dashboard</Link> / <Link to="/admin/gizmos">Gizmos</Link> /{' '}
          <span>{isEditing ? 'Edit Gizmo' : 'Add Gizmo'}</span>
        </nav>
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
          <select name="gizmo_type" value={form.gizmo_type} onChange={handleChange}>
            <option value="integration">Integration</option>
            <option value="feature">Feature</option>
            <option value="utility">Utility</option>
          </select>
        </div>
        <div className="su-form-group">
          <label>Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} />
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