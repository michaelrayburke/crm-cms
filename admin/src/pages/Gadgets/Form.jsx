import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
// Import the named api client.  The api module exports a named object,
// not a default export, so use a named import to satisfy Vite/rollup.
import { api } from '../../lib/api';

// Utility to convert a string into a URL friendly slug.  This will strip
// leading/trailing spaces, convert to lowercase, replace any groups of
// non-alphanumeric characters with a single dash, and remove stray
// dashes at the ends.  Used to auto-generate the slug from the name.
function slugify(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Gadget form page.  Handles both creation and editing of gadgets.
 * When an :id param is present, the form loads the existing gadget and
 * its attached gizmos.  Otherwise it creates a new gadget.
 */
export default function GadgetForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    gadget_type: 'website',
    description: '',
    icon: '',
    repo_url: '',
    api_base_url: '',
    supabase_url: '',
    supabase_anon_key: '',
    deploy_url_web: '',
    deploy_url_app: '',
    primary_color: '',
    secondary_color: '',
    accent_color: '',
    logo_url: '',
    favicon_url: '',
    design_config: '{\n  "primary_color": "#ff6600"\n}',
    structure_config: '{\n  "sections": []\n}',
    is_active: true,
    is_system: false,
  });

  // Toast is an object like { type: 'success' | 'error', message: string }.
  const [toast, setToast] = useState(null);

  // Available gizmos to select from
  const [availableGizmos, setAvailableGizmos] = useState([]);
  // Selected gizmos for this gadget (id => config JSON string)
  const [selectedGizmos, setSelectedGizmos] = useState({});

  // Default placeholders
  const designConfigPlaceholder = '{\n  "primary_color": "#ff6600"\n}';
  const structureConfigPlaceholder = '{\n  "sections": []\n}';

  // Load available gizmos and, if editing, the gadget details + attached gizmos
  useEffect(() => {
    // 1) Fetch the list of all gizmos
    api
      .get('/api/gizmos')
      .then((data) => {
        console.log('[Gadgets/Form] available gizmos =', data);
        setAvailableGizmos(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('[Gadgets/Form] Failed to load gizmos', err);
      });

    // 2) If editing, load the gadget by ID
    if (isEditing) {
      api
        .get(`/api/gadgets/${id}`)
        .then((data) => {
          console.log('[Gadgets/Form] edit gadget =', data);
          setForm((prev) => ({
            ...prev,
            ...data,
            design_config: JSON.stringify(data.design_config || {}, null, 2),
            structure_config: JSON.stringify(
              data.structure_config || {},
              null,
              2,
            ),
          }));

          // Build selected gizmo mapping from returned array
          const gizmoMap = {};
          (data.gizmos || []).forEach((g) => {
            gizmoMap[g.gizmo_id] = JSON.stringify(g.config || {}, null, 2);
          });
          setSelectedGizmos(gizmoMap);
        })
        .catch((err) => {
          console.error('[Gadgets/Form] Failed to load gadget', err);
        });
    }
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setForm((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
      // Auto-generate slug from name if slug is currently blank
      ...(name === 'name' && !prev.slug
        ? { slug: slugify(value) }
        : null),
    }));
  };

  const handleGizmoToggle = (gizmoId, checked) => {
    setSelectedGizmos((prev) => {
      const next = { ...prev };
      if (checked) {
        if (!next[gizmoId]) {
          next[gizmoId] = '{}';
        }
      } else {
        delete next[gizmoId];
      }
      return next;
    });
  };

  const handleGizmoConfigChange = (gizmoId, value) => {
    setSelectedGizmos((prev) => ({
      ...prev,
      [gizmoId]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let payload;
    try {
      payload = {
        ...form,
        design_config: JSON.parse(form.design_config || '{}'),
        structure_config: JSON.parse(form.structure_config || '{}'),
      };
    } catch (jsonErr) {
      alert('Design/Structure config must be valid JSON');
      return;
    }

    let gadgetId;

    // 1) Save the gadget itself
    try {
      if (!payload.slug) delete payload.slug;

      const saved = isEditing
        ? await api.put(`/api/gadgets/${id}`, payload)
        : await api.post('/api/gadgets', payload);

      console.log('[Gadgets/Form] saved gadget =', saved);
      gadgetId = isEditing ? id : saved.id;
    } catch (err) {
      console.error('[Gadgets/Form] Failed to save gadget core record', err);
      setToast({ type: 'error', message: 'Failed to save gadget' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    // 2) Try to sync gizmo attachments (non-fatal if this fails)
    try {
      let existingMap = {};

      if (isEditing) {
        const existing = await api.get(`/api/gadgets/${gadgetId}`);
        console.log('[Gadgets/Form] existing with gizmos =', existing);

        (existing.gizmos || []).forEach((g) => {
          existingMap[g.gizmo_id] = JSON.stringify(g.config || {}, null, 2);
        });
      }

      // Detach removed gizmos
      for (const exId of Object.keys(existingMap)) {
        if (!selectedGizmos[exId]) {
          await api.delete(`/api/gadgets/${gadgetId}/gizmos/${exId}`);
        }
      }

      // Attach/update selected gizmos
      for (const gizmoId of Object.keys(selectedGizmos)) {
        let configObj;
        try {
          configObj = JSON.parse(selectedGizmos[gizmoId] || '{}');
        } catch {
          alert(`Config for gizmo ${gizmoId} is invalid JSON`);
          return;
        }

        await api.post(`/api/gadgets/${gadgetId}/gizmos`, {
          gizmo_id: gizmoId,
          config: configObj,
        });
      }
    } catch (err) {
      console.error('[Gadgets/Form] Gadget saved but gizmo linking failed', err);
      setToast({
        type: 'error',
        message: 'Gadget saved, but updating attached gizmos failed.',
      });
      setTimeout(() => setToast(null), 4000);
    }

    // 3) Success path
    setToast({ type: 'success', message: 'Gadget saved successfully' });
    setTimeout(() => {
      setToast(null);
      navigate('/admin/gadgets');
    }, 1500);
  };

  return (
    <div className="su-page">
      {/* Breadcrumb navigation */}
      <nav className="su-breadcrumbs" style={{ marginBottom: '1rem' }}>
        <Link to="/admin">Dashboard</Link> /{' '}
        <Link to="/admin/gadgets">Gadgets</Link> /{' '}
        <span>{isEditing ? 'Edit Gadget' : 'New Gadget'}</span>
      </nav>

      <header className="su-page-header">
        <h1>{isEditing ? 'Edit Gadget' : 'New Gadget'}</h1>
      </header>

      {toast && (
        <div
          className={`su-alert ${
            toast.type === 'error'
              ? 'su-alert-danger'
              : 'su-alert-success'
          }`}
        >
          {toast.message}
        </div>
      )}

      <form className="su-form" onSubmit={handleSubmit}>
        {/* Basic info */}
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
            value={form.slug || ''}
            onChange={handleChange}
            placeholder="Auto-generated if left blank"
          />
        </div>

        <div className="su-form-group">
          <label>Type</label>
          <select
            name="gadget_type"
            value={form.gadget_type || ''}
            onChange={handleChange}
          >
            <option value="website">Website</option>
            <option value="app">App</option>
          </select>
        </div>

        <div className="su-form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={form.description || ''}
            onChange={handleChange}
          />
        </div>

        {/* URLs + branding */}
        <div className="su-form-group">
          <label>Repository URL</label>
          <input
            name="repo_url"
            value={form.repo_url || ''}
            onChange={handleChange}
            placeholder="https://github.com/..."
          />
        </div>

        <div className="su-form-group">
          <label>API Base URL</label>
          <input
            name="api_base_url"
            value={form.api_base_url || ''}
            onChange={handleChange}
            placeholder="https://serviceup-api.onrender.com/api"
          />
        </div>

        <div className="su-form-group">
          <label>Supabase URL</label>
          <input
            name="supabase_url"
            value={form.supabase_url || ''}
            onChange={handleChange}
          />
        </div>

        <div className="su-form-group">
          <label>Supabase Anon Key</label>
          <input
            name="supabase_anon_key"
            value={form.supabase_anon_key || ''}
            onChange={handleChange}
          />
        </div>

        <div className="su-form-group">
          <label>Web Deploy URL</label>
          <input
            name="deploy_url_web"
            value={form.deploy_url_web || ''}
            onChange={handleChange}
            placeholder="Netlify/Vercel URL"
          />
        </div>

        <div className="su-form-group">
          <label>App Deploy URL</label>
          <input
            name="deploy_url_app"
            value={form.deploy_url_app || ''}
            onChange={handleChange}
          />
        </div>

        <div className="su-form-group">
          <label>Primary Color</label>
          <input
            name="primary_color"
            value={form.primary_color || ''}
            onChange={handleChange}
            placeholder="#ff6600"
          />
        </div>

        <div className="su-form-group">
          <label>Secondary Color</label>
          <input
            name="secondary_color"
            value={form.secondary_color || ''}
            onChange={handleChange}
          />
        </div>

        <div className="su-form-group">
          <label>Accent Color</label>
          <input
            name="accent_color"
            value={form.accent_color || ''}
            onChange={handleChange}
          />
        </div>

        <div className="su-form-group">
          <label>Logo URL</label>
          <input
            name="logo_url"
            value={form.logo_url || ''}
            onChange={handleChange}
          />
        </div>

        <div className="su-form-group">
          <label>Favicon URL</label>
          <input
            name="favicon_url"
            value={form.favicon_url || ''}
            onChange={handleChange}
          />
        </div>

        {/* JSON configs */}
        <div className="su-form-group">
          <label>Design Config (JSON)</label>
          <textarea
            name="design_config"
            value={form.design_config}
            onChange={handleChange}
            placeholder={designConfigPlaceholder}
            rows={6}
          />
        </div>

        <div className="su-form-group">
          <label>Structure Config (JSON)</label>
          <textarea
            name="structure_config"
            value={form.structure_config}
            onChange={handleChange}
            placeholder={structureConfigPlaceholder}
            rows={6}
          />
        </div>

        {/* Flags */}
        <div className="su-form-group su-form-inline">
          <label>
            <input
              type="checkbox"
              name="is_active"
              checked={!!form.is_active}
              onChange={handleChange}
            />{' '}
            Active
          </label>
        </div>

        <div className="su-form-group su-form-inline">
          <label>
            <input
              type="checkbox"
              name="is_system"
              checked={!!form.is_system}
              onChange={handleChange}
            />{' '}
            System Gadget
          </label>
        </div>

        {/* Gizmo attachments */}
        <hr />
        <h2>Gizmos</h2>

        <div className="su-form-group">
          {availableGizmos.length === 0 ? (
            <p className="text-sm text-gray-500">
              No gizmos available yet – create some first.
            </p>
          ) : (
            availableGizmos.map((g) => {
              const checked = Object.prototype.hasOwnProperty.call(
                selectedGizmos,
                g.id,
              );
              return (
                <div key={g.id} className="su-gizmo-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        handleGizmoToggle(g.id, e.target.checked)
                      }
                    />{' '}
                    {g.name} ({g.gizmo_type})
                  </label>
                  {checked && (
                    <textarea
  value={selectedGizmos[g.id] || '{}'}
  onChange={(e) =>
    handleGizmoConfigChange(g.id, e.target.value)
  }
  placeholder={`{
  "example": true
}`}
  rows={4}
/>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="su-form-group">
          <button type="submit" className="su-btn su-btn-primary">
            {isEditing ? 'Update' : 'Create'} Gadget
          </button>
        </div>
      </form>
    </div>
  );
}
