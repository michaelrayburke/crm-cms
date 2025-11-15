// admin/src/pages/Taxonomies/index.jsx
// Taxonomies admin page: list + create + inline edit + delete.

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function TaxonomiesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    key: '',
    label: '',
    isHierarchical: false,
  });
  const [saving, setSaving] = useState(false);

  // Load on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.get('/taxonomies');
        // backend returns { ok: true, taxonomies: [...] }
        if (!cancelled) {
          setItems(data.taxonomies || []);
        }
      } catch (err) {
        console.error('Failed to load taxonomies', err);
        if (!cancelled) setError('Failed to load taxonomies');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(
    () => form.key.trim().length > 0 && form.label.trim().length > 0 && !saving,
    [form, saving],
  );

  function handleChange(e) {
    const { name, type, checked, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value };
      // If user types label first and key is empty, auto-suggest a key
      if (name === 'label' && !prev.key) {
        next.key = slugify(value);
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        key: form.key.trim(),
        label: form.label.trim(),
        isHierarchical: !!form.isHierarchical,
      };
      const data = await api.post('/taxonomies', payload);
      // backend: { ok: true, taxonomy: {...} }
      if (!data.ok) {
        throw new Error(data.error || 'Failed to create taxonomy');
      }
      const taxonomy = data.taxonomy || data;
      setItems(prev => [...prev, taxonomy]);
      setForm({ key: '', label: '', isHierarchical: false });
    } catch (err) {
      console.error('Create taxonomy failed', err);
      setError(err.message || 'Failed to create taxonomy');
    } finally {
      setSaving(false);
    }
  }

  function handleInlineChange(id, field, value) {
    setItems(prev => prev.map(t => (t.id === id ? { ...t, [field]: value } : t)));
  }

  async function handleInlineBlur(item) {
    try {
      const payload = {
        key: item.key,
        label: item.label,
        isHierarchical: item.is_hierarchical,
        is_visible: item.is_visible,
      };
      const data = await api.patch(`/taxonomies/${item.id}`, payload);
      if (!data.ok) throw new Error(data.error || 'Failed to update taxonomy');
    } catch (err) {
      console.error('Update taxonomy failed', err);
      setError(err.message || 'Failed to update taxonomy');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this taxonomy?')) return;
    try {
      const data = await api.del(`/taxonomies/${id}`);
      if (data && data.ok === false) {
        throw new Error(data.error || 'Failed to delete taxonomy');
      }
      setItems(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Delete taxonomy failed', err);
      setError(err.message || 'Failed to delete taxonomy');
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Taxonomies</h1>
        {loading && <span className="text-sm text-gray-500">Loading…</span>}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* New taxonomy form */}
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-3"
      >
        <div className="md:col-span-3">
          <h2 className="text-lg font-medium">New taxonomy</h2>
          <p className="text-xs text-gray-500">
            Give it a short machine key and a human label. The key is how content types will refer
            to this taxonomy.
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-600">Key</span>
          <input
            name="key"
            value={form.key}
            onChange={handleChange}
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="collection"
          />
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-600">Label</span>
          <input
            name="label"
            value={form.label}
            onChange={handleChange}
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Collection"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isHierarchical"
            checked={form.isHierarchical}
            onChange={handleChange}
            className="h-4 w-4"
          />
          Hierarchical (like categories vs. tags)
        </label>

        <div className="md:col-span-2 flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Add taxonomy'}
          </button>
        </div>
      </form>

      {/* Existing taxonomies */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Key</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Label</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Hierarchical</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Visible</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-2 align-middle">
                  <input
                    className="w-full rounded-md border px-2 py-1 text-xs"
                    value={item.key || ''}
                    onChange={e => handleInlineChange(item.id, 'key', e.target.value)}
                    onBlur={() => handleInlineBlur(item)}
                  />
                </td>
                <td className="px-4 py-2 align-middle">
                  <input
                    className="w-full rounded-md border px-2 py-1 text-xs"
                    value={item.label || ''}
                    onChange={e => handleInlineChange(item.id, 'label', e.target.value)}
                    onBlur={() => handleInlineBlur(item)}
                  />
                </td>
                <td className="px-4 py-2 align-middle">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!item.is_hierarchical}
                    onChange={e =>
                      handleInlineChange(item.id, 'is_hierarchical', e.target.checked)
                    }
                    onBlur={() => handleInlineBlur(item)}
                  />
                </td>
                <td className="px-4 py-2 align-middle">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={item.is_visible !== false}
                    onChange={e => handleInlineChange(item.id, 'is_visible', e.target.checked)}
                    onBlur={() => handleInlineBlur(item)}
                  />
                </td>
                <td className="px-4 py-2 align-middle text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-500">
                  No taxonomies yet. Create your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
