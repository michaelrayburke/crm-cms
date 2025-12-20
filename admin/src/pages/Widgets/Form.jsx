import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useNavigate, useParams } from 'react-router-dom';

function slugify(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const WIDGET_TYPES = [
  { value: '', label: '— Select type —' },
  { value: 'hero', label: 'Hero section' },
  { value: 'cta', label: 'Call to Action strip' },
  { value: 'feature_grid', label: 'Features grid' },
  { value: 'testimonial', label: 'Testimonial block' },
  { value: 'custom', label: 'Custom widget' },
];

export default function WidgetForm() {
  const { id } = useParams(); // 'new' or actual UUID
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    widget_type: '',
    description: '',
    configText: '{\n  \n}',
    is_active: true,
    is_system: false,
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load existing widget when editing
  useEffect(() => {
    if (isNew) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError('');

        const res = await api.get(`/api/widgets/${id}`);

        if (!cancelled && res) {
          setForm({
            name: res.name || '',
            slug: res.slug || '',
            widget_type: res.widget_type || '',
            description: res.description || '',
            configText: JSON.stringify(res.config || {}, null, 2),
            is_active: !!res.is_active,
            is_system: !!res.is_system,
          });
        }
      } catch (err) {
        console.error('[WidgetForm] Failed to load widget', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load widget');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const handleChange = (field) => (e) => {
    const value =
      e.target.type === 'checkbox' ? e.target.checked : e.target.value;

    setForm((prev) => {
      if (field === 'name') {
        // Autoslug when slug matches previous name-derived slug
        const newSlug =
          !prev.slug || prev.slug === slugify(prev.name)
            ? slugify(value)
            : prev.slug;
        return { ...prev, name: value, slug: newSlug };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    // Parse config JSON
    let parsedConfig = {};
    try {
      parsedConfig = form.configText.trim()
        ? JSON.parse(form.configText)
        : {};
    } catch (err) {
      setSaving(false);
      setError('Config JSON is invalid. Please fix it before saving.');
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        widget_type: form.widget_type || null,
        description: form.description || null,
        config: parsedConfig,
        is_active: !!form.is_active,
        is_system: !!form.is_system,
      };

      if (!payload.name) {
        setSaving(false);
        setError('Name is required.');
        return;
      }

      if (isNew) {
        await api.post('/api/widgets', payload);
      } else {
        await api.put(`/api/widgets/${id}`, payload);
      }

      navigate('/admin/widgets');
    } catch (err) {
      console.error('[WidgetForm] Failed to save widget', err);
      setError(err?.message || 'Failed to save widget');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    if (!window.confirm('Delete this widget? This cannot be undone.')) return;

    try {
      await api.del(`/api/widgets/${id}`);
      navigate('/admin/widgets');
    } catch (err) {
      console.error('[WidgetForm] Failed to delete widget', err);
      setError(err?.message || 'Failed to delete widget');
    }
  };

  if (loading) {
    return <div className="p-6">Loading widget…</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">
            {isNew ? 'New Widget' : `Edit Widget: ${form.name || ''}`}
          </h1>
          <p className="text-sm text-gray-500">
            Define reusable widgets for sites and apps.
          </p>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <button className="su-btn danger" onClick={handleDelete}>
              Delete
            </button>
          )}
          <button
            className="su-btn primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr),minmax(0,1.1fr)] gap-6 items-start">
        {/* Left column – core fields */}
        <section className="su-card space-y-3">
          <h2 className="su-card-title">Details</h2>

          <div>
            <label className="su-label">Name</label>
            <input
              className="su-input"
              value={form.name}
              onChange={handleChange('name')}
              placeholder="Hero – Homepage"
            />
          </div>

          <div>
            <label className="su-label">Slug</label>
            <input
              className="su-input"
              value={form.slug}
              onChange={handleChange('slug')}
              placeholder="hero-homepage"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Used internally to reference this widget in configs.
            </p>
          </div>

          <div>
            <label className="su-label">Widget type</label>
            <select
              className="su-select"
              value={form.widget_type}
              onChange={handleChange('widget_type')}
            >
              {WIDGET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="su-label">Description</label>
            <textarea
              className="su-input min-h-[80px]"
              value={form.description}
              onChange={handleChange('description')}
              placeholder="Short description of where/how this widget is used."
            />
          </div>

          <div className="flex items-center gap-4 mt-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={handleChange('is_active')}
              />
              <span>Active</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_system}
                onChange={handleChange('is_system')}
              />
              <span>System widget</span>
            </label>
          </div>
        </section>

        {/* Right column – config JSON */}
        <section className="su-card space-y-3">
          <h2 className="su-card-title">Config JSON</h2>

          <p className="text-xs text-gray-500">
            Store structured data for this widget (headlines, buttons,
            images, layout options, etc.). This will be read by your frontend
            renderer.
          </p>

          <textarea
            className="su-input font-mono text-xs min-h-[260px]"
            value={form.configText}
            onChange={handleChange('configText')}
            placeholder={`{
  "headline": "Welcome",
  "subheading": "Powered by widgets",
  "primaryCta": { "label": "Get Started", "href": "/contact" }
}`}
          />
        </section>
      </div>
    </div>
  );
}