import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
// Import the named api client from the shared library.  Do not use a default import
// because api.js does not export a default.  Named import ensures the build
// succeeds and matches how other components import the API.
import { api } from '../../lib/api';

// Utility to convert a string into a URL friendly slug.  This will strip
// leading/trailing spaces, convert to lowercase, replace any groups of
// non-alphanumeric characters with a single dash, and remove stray
// dashes at the ends.  Used to auto‑generate the slug from the name.
function slugify(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

  // Toast state.  When the gizmo is saved or errors occur, this state will
  // hold an object like { type: 'success' | 'error', message: string }.
  // If null, no toast is shown.  Toasts auto-dismiss after a delay.
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isEditing) {
      // When editing, fetch the existing gizmo by ID.  Do not prefix
      // with `/api` because the api client already includes the base path.
      api
        .get(`/gizmos/${id}`)
        .then((res) => {
          const data = res.data || {};
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const updated = { ...f, [name]: type === 'checkbox' ? checked : value };
      // Auto‑generate the slug from the name if the slug has not been manually set.
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
    } catch (jsonErr) {
      alert('Config must be valid JSON');
      return;
    }

    // Save the gizmo.  Do not prefix with `/api` because the api client
    // already prepends the base path.
    const req = isEditing
      ? api.put(`/gizmos/${id}`, payload)
      : api.post('/gizmos', payload);

    req
      .then(() => {
        // Show a success toast and then navigate back to the list after a short delay.
        setToast({ type: 'success', message: 'Gizmo saved successfully' });
        setTimeout(() => {
          setToast(null);
          navigate('/admin/gizmos');
        }, 1500);
      })
      .catch((err) => {
        console.error('[Gizmos/Form] Failed to save gizmo', err);
        // Show an error toast on failure.
        setToast({ type: 'error', message: 'Failed to save gizmo' });
        setTimeout(() => setToast(null), 3000);
      });
  };

  // Define a default placeholder for the config textarea.
  const configPlaceholder = '{\n  "apiKey": "..."\n}';

  return (
    <div className="su-page">
      {/* Toast notification */}
      {toast && (
        <div
          className={`su-toast su-toast-${toast.type}`}
          style={{ marginBottom: '1rem' }}
        >
          {toast.message}
        </div>
      )}
      {/* Breadcrumb navigation */}
      <nav className="su-breadcrumbs" style={{ marginBottom: '1rem' }}>
        <Link to="/admin">Dashboard</Link> / <Link to="/admin/gizmos">Gizmos</Link> /
        <span>{isEditing ? 'Edit' : 'Add'} Gizmo</span>
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
