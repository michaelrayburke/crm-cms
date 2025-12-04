import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';

/**
 * Form for creating or editing a Gadget.  Gadgets represent full products
 * (websites, apps, or system apps) built on top of ServiceUp.  The form
 * exposes fields for project-level settings (API, Supabase, branding, etc.)
 * and allows selecting which Gizmos are enabled for the gadget.  When
 * editing an existing gadget, the current values and attached gizmos are
 * loaded from the API.  Config JSON fields are edited as strings.
 */
export default function GadgetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  // Base form state.  Keep JSON fields as strings for editing.
  const [form, setForm] = useState({
    name: '',
    slug: '',
    gadget_type: 'website',
    description: '',
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
    design_config: '{}',
    structure_config: '{}',
    is_active: true,
    is_system: false,
  });
  // Available gizmos to select from
  const [availableGizmos, setAvailableGizmos] = useState([]);
  // Selected gizmos for this gadget (id => config JSON string)
  const [selectedGizmos, setSelectedGizmos] = useState({});

  // Define default placeholders for design and structure configs. Using separate
  // variables avoids invalid escape sequences in JSX attributes. These will
  // populate the placeholder text areas with example JSON when editing.
  const designConfigPlaceholder = '{\n  "primary_color": "#ff6600"\n}';
  const structureConfigPlaceholder = '{\n  "menus": [],\n  "pages": [],\n  "screens": []\n}';

  // Load available gizmos and, if editing, the gadget details and attached gizmos
  useEffect(() => {
    api.get('/gizmos')
      .then((res) => {
        setAvailableGizmos(res.data || []);
      })
      .catch((err) => {
        console.error('Failed to load gizmos', err);
      });
    if (isEditing) {
      api.get(`/gadgets/${id}`)
        .then((res) => {
          const data = res.data;
          setForm({
            ...data,
            design_config: JSON.stringify(data.design_config || {}, null, 2),
            structure_config: JSON.stringify(data.structure_config || {}, null, 2),
          });
          // Build selected gizmo mapping from returned array
          const gizmoMap = {};
          (data.gizmos || []).forEach((g) => {
            gizmoMap[g.gizmo_id] = JSON.stringify(g.config || {}, null, 2);
          });
          setSelectedGizmos(gizmoMap);
        })
        .catch((err) => {
          console.error(err);
          // In a real app, show error to user
        });
    }
  }, [isEditing, id]);

  // Generic field change handler
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  // Toggle gizmo selection; if unchecked remove from map
  const handleGizmoToggle = (gizmoId) => (e) => {
    const checked = e.target.checked;
    setSelectedGizmos((prev) => {
      const next = { ...prev };
      if (checked) {
        // default empty config
        next[gizmoId] = next[gizmoId] || '{}';
      } else {
        delete next[gizmoId];
      }
      return next;
    });
  };

  // Handle gizmo config change
  const handleGizmoConfigChange = (gizmoId) => (e) => {
    const value = e.target.value;
    setSelectedGizmos((prev) => ({ ...prev, [gizmoId]: value }));
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
    try {
      // If slug is blank, remove it to let API generate from name
      if (!payload.slug) delete payload.slug;
      const res = isEditing
        ? await api.put(`/gadgets/${id}`, payload)
        : await api.post('/gadgets', payload);
      const gadgetId = isEditing ? id : res.data.id;
      // Update gizmo attachments
      const currentGizmos = isEditing ? selectedGizmos : {};
      // Fetch existing attachments only when editing to compute diff
      let existingMap = {};
      if (isEditing) {
        const existing = await api.get(`/gadgets/${gadgetId}`);
        (existing.data.gizmos || []).forEach((g) => {
          existingMap[g.gizmo_id] = JSON.stringify(g.config || {}, null, 2);
        });
      }
      // Determine detach list
      for (const exId of Object.keys(existingMap)) {
        if (!selectedGizmos[exId]) {
          await api.delete(`/gadgets/${gadgetId}/gizmos/${exId}`);
        }
      }
      // Attach or update configs
      for (const gizmoId of Object.keys(selectedGizmos)) {
        let configObj;
        try {
          configObj = JSON.parse(selectedGizmos[gizmoId] || '{}');
        } catch (err) {
          alert(`Config for gizmo ${gizmoId} is invalid JSON`);
          return;
        }
        await api.post(`/gadgets/${gadgetId}/gizmos`, {
          gizmo_id: gizmoId,
          config: configObj,
        });
      }
      navigate('/settings/gadgets');
    } catch (err) {
      console.error(err);
      alert('Failed to save gadget');
    }
  };

  return (
    <div className="su-page">
      <header className="su-page-header">
        <h1>{isEditing ? 'Edit Gadget' : 'Add Gadget'}</h1>
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
            value={form.slug || ''}
            onChange={handleChange}
            placeholder="Auto-generated if left blank"
          />
        </div>
        <div className="su-form-group">
          <label>Type</label>
          <select name="gadget_type" value={form.gadget_type} onChange={handleChange}>
            <option value="website">Website</option>
            <option value="app">App</option>
            <option value="system">System</option>
          </select>
        </div>
        <div className="su-form-group">
          <label>Description</label>
          <textarea name="description" value={form.description || ''} onChange={handleChange} />
        </div>
        <hr />
        <h2>Technical settings</h2>
        <div className="su-form-group">
          <label>API Base URL</label>
          <input name="api_base_url" value={form.api_base_url || ''} onChange={handleChange} />
        </div>
        <div className="su-form-group">
          <label>Supabase URL</label>
          <input name="supabase_url" value={form.supabase_url || ''} onChange={handleChange} />
        </div>
        <div className="su-form-group">
          <label>Supabase Anon Key</label>
          <input name="supabase_anon_key" value={form.supabase_anon_key || ''} onChange={handleChange} />
        </div>
        <div className="su-form-group">
          <label>Deploy URL (Web)</label>
          <input name="deploy_url_web" value={form.deploy_url_web || ''} onChange={handleChange} />
        </div>
        <div className="su-form-group">
          <label>Deploy URL (App / Expo)</label>
          <input name="deploy_url_app" value={form.deploy_url_app || ''} onChange={handleChange} />
        </div>
        <hr />
        <h2>Branding</h2>
        <div className="su-form-group">
          <label>Primary Color</label>
          <input name="primary_color" value={form.primary_color || ''} onChange={handleChange} />
        </div>
        <div className="su-form-group">
          <label>Secondary Color</label>
          <input name="secondary_color" value={form.secondary_color || ''} onChange={handleChange} />
        </div>
        <div className="su-form-group">
          <label>Accent Color</label>
          <input name="accent_color" value={form.accent_color || ''} onChange={handleChange} />
        </div>
        <div className="su-form-group">
          <label>Logo URL</label>
          <input name="logo_url" value={form.logo_url || ''} onChange={handleChange} />
        </div>
        <div className="su-form-group">
          <label>Favicon URL</label>
          <input name="favicon_url" value={form.favicon_url || ''} onChange={handleChange} />
        </div>
        <hr />
        <h2>Design & Structure Config</h2>
        <div className="su-form-group">
          <label>Design Config (JSON)</label>
          <textarea
            name="design_config"
            value={form.design_config}
            onChange={handleChange}
            rows={4}
            placeholder={designConfigPlaceholder}
          />
        </div>
        <div className="su-form-group">
          <label>Structure Config (JSON)</label>
          <textarea
            name="structure_config"
            value={form.structure_config}
            onChange={handleChange}
            rows={4}
            placeholder={structureConfigPlaceholder}
          />
        </div>
        <hr />
        <h2>Gizmos</h2>
        <div className="su-form-group">
          {availableGizmos.map((g) => {
            const checked = Object.prototype.hasOwnProperty.call(selectedGizmos, g.id);
            return (
              <div key={g.id} style={{ marginBottom: '1rem' }}>
                <label style={{ fontWeight: 'bold' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={handleGizmoToggle(g.id)}
                  />
                  {g.name} ({g.gizmo_type})
                </label>
                {checked && (
                  <textarea
                    style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                    value={selectedGizmos[g.id]}
                    onChange={handleGizmoConfigChange(g.id)}
                    rows={3}
                    placeholder="{}"
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="su-form-group">
          <label>
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={handleChange}
            />
            Active
          </label>
        </div>
        <div className="su-form-group">
          <label>
            <input
              type="checkbox"
              name="is_system"
              checked={form.is_system}
              onChange={handleChange}
            />
            System Gadget
          </label>
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