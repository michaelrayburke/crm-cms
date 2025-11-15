import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

// Simple slug helper, same behavior everywhere
function slugify(value) {
  return value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function TaxonomiesPage() {
  const [taxonomies, setTaxonomies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    key: '',
    label: '',
    is_hierarchical: false,
  });

  // Load all taxonomies ---------------------------------
  async function loadTaxonomies() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/taxonomies'); // -> /api/taxonomies
      // backend returns { ok, items } or { ok, taxonomies }
      const list = res.items || res.taxonomies || [];
      setTaxonomies(list);
    } catch (err) {
      console.error('Failed to load taxonomies', err);
      setError(err?.message || 'Failed to load taxonomies.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTaxonomies();
  }, []);

  // Create new taxonomy ---------------------------------
  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);

    const key = form.key.trim();
    const label = form.label.trim();
    const is_hierarchical = !!form.is_hierarchical;

    if (!key || !label) {
      setError('Key and label are required.');
      setSaving(false);
      return;
    }

    try {
      await api.post('/taxonomies', {
        key,
        label,
        is_hierarchical,
        // slug will be set in the backend (we can keep this consistent)
      }); // -> POST /api/taxonomies

      setForm({ key: '', label: '', is_hierarchical: false });
      setMessage('Taxonomy created.');
      await loadTaxonomies();
    } catch (err) {
      console.error('Failed to create taxonomy', err);
      setError(
        err?.message ||
          'Failed to create taxonomy. Make sure the key is unique.'
      );
    } finally {
      setSaving(false);
    }
  }

  // Inline update (label, slug, is_hierarchical) --------
  async function handleUpdate(id, field, value) {
    setError('');
    setMessage('');

    // Optimistic UI update
    setTaxonomies((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, [field]: field === 'is_hierarchical' ? !!value : value } : t
      )
    );

    const payload = {};
    if (field === 'label') payload.label = value;
    if (field === 'slug') payload.slug = value;
    if (field === 'is_hierarchical') payload.is_hierarchical = !!value;

    try {
      await api.patch(`/taxonomies/${id}`, payload); // -> PATCH /api/taxonomies/:id
      setMessage('Taxonomy updated.');
    } catch (err) {
      console.error('Failed to update taxonomy', err);
      setError(err?.message || 'Failed to update taxonomy.');
      // reload to undo optimistic change
      loadTaxonomies();
    }
  }

  // Delete taxonomy -------------------------------------
  async function handleDelete(id) {
    setError('');
    setMessage('');

    const target = taxonomies.find((t) => t.id === id);
    const label = target?.label || target?.key || 'this taxonomy';

    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    try {
      await api.del(`/taxonomies/${id}`); // -> DELETE /api/taxonomies/:id
      setTaxonomies((prev) => prev.filter((t) => t.id !== id));
      setMessage('Taxonomy deleted.');
    } catch (err) {
      console.error('Failed to delete taxonomy', err);
      setError(err?.message || 'Failed to delete taxonomy.');
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* New Taxonomy form */}
      <div className="bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold mb-4">New Taxonomy</h1>

        {error && (
          <div className="mb-4 rounded bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}
        {message && !error && (
          <div className="mb-4 rounded bg-green-50 text-green-700 px-3 py-2 text-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Key</label>
            <input
              type="text"
              className="w-full rounded border px-3 py-2 text-sm"
              value={form.key}
              onChange={(e) =>
                setForm((f) => ({ ...f, key: e.target.value }))
              }
              placeholder="collection, category, tag..."
            />
            <p className="mt-1 text-xs text-slate-500">
              Internal identifier (must be unique).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Label</label>
            <input
              type="text"
              className="w-full rounded border px-3 py-2 text-sm"
              value={form.label}
              onChange={(e) =>
                setForm((f) => ({ ...f, label: e.target.value }))
              }
              placeholder="Collections, Categories, Tags..."
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_hierarchical}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_hierarchical: e.target.checked }))
              }
            />
            Hierarchical (like categories) instead of flat (like tags)
          </label>

          <button
            type="submit"
            className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Add taxonomy'}
          </button>
        </form>
      </div>

      {/* List of taxonomies */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Taxonomies</h2>
          {loading && (
            <span className="text-xs text-slate-500">Loading…</span>
          )}
        </div>

        {taxonomies.length === 0 && !loading && (
          <p className="text-sm text-slate-500">
            No taxonomies yet. Create one on the left.
          </p>
        )}

        {taxonomies.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Key</th>
                  <th className="py-2 pr-4">Label</th>
                  <th className="py-2 pr-4">Slug</th>
                  <th className="py-2 pr-4">Hierarchical</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {taxonomies.map((tax) => (
                  <tr key={tax.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-xs font-mono text-slate-600">
                      {tax.key}
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        className="w-full rounded border px-2 py-1 text-sm"
                        value={tax.label || ''}
                        onChange={(e) =>
                          handleUpdate(tax.id, 'label', e.target.value)
                        }
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        className="w-full rounded border px-2 py-1 text-sm"
                        value={tax.slug || ''}
                        onChange={(e) =>
                          handleUpdate(tax.id, 'slug', slugify(e.target.value))
                        }
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="checkbox"
                        checked={!!tax.is_hierarchical}
                        onChange={(e) =>
                          handleUpdate(
                            tax.id,
                            'is_hierarchical',
                            e.target.checked
                          )
                        }
                      />
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <button
                        type="button"
                        className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                        onClick={() => handleDelete(tax.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
