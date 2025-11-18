import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

function slugify(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function TaxonomiesPage() {
  const [taxonomies, setTaxonomies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [creating, setCreating] = useState(false);

  // We only care about label + slug + isHierarchical now
  const [newTax, setNewTax] = useState({
    label: '',
    slug: '',
    isHierarchical: false,
  });

  // ---- Load list ----
  async function loadTaxonomies() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/taxonomies');
      if (res && res.ok === false) {
        throw new Error(res.error || res.detail || 'Failed to load taxonomies');
      }
      const rows = res?.taxonomies || res?.data || [];
      setTaxonomies(
        rows.map((t) => ({
          ...t,
          // normalise casing from API -> UI
          isHierarchical: t.isHierarchical ?? t.is_hierarchical ?? false,
        })),
      );
    } catch (err) {
      console.error('Failed to load taxonomies', err);
      setError(err.message || 'Failed to load taxonomies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTaxonomies();
  }, []);

  // ---- Create ----
  async function handleCreate(e) {
    e.preventDefault();
    setError('');

    const label = newTax.label.trim();
    const slugInput = newTax.slug.trim();

    if (!label && !slugInput) {
      setError('Please enter at least a label or a slug.');
      return;
    }

    const finalSlug = slugInput || slugify(label);

    const payload = {
      label,
      slug: finalSlug,
      isHierarchical: !!newTax.isHierarchical,
    };

    try {
      setCreating(true);
      const res = await api.post('/api/taxonomies', payload);
      if (res && res.ok === false) {
        throw new Error(res.error || res.detail || 'Failed to create taxonomy');
      }
      const created = res.taxonomy || res.data || res;
      if (created) {
        setTaxonomies((prev) => [
          ...prev,
          {
            ...created,
            isHierarchical:
              created.isHierarchical ?? created.is_hierarchical ?? false,
          },
        ]);
      }
      setNewTax({ label: '', slug: '', isHierarchical: false });
    } catch (err) {
      console.error('Failed to create taxonomy', err);
      setError(err.message || 'Failed to create taxonomy');
    } finally {
      setCreating(false);
    }
  }

  // ---- Inline edit helpers ----
  function updateLocal(id, partial) {
    setTaxonomies((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    );
  }

  async function handleInlineSave(id) {
    const item = taxonomies.find((t) => t.id === id);
    if (!item) return;

    setSavingId(id);
    setError('');

    const label = (item.label || '').trim();
    const slugInput = (item.slug || '').trim();
    const finalSlug = slugInput || slugify(label);

    const payload = {
      label,
      slug: finalSlug,
      isHierarchical: !!item.isHierarchical,
    };

    try {
      const res = await api.patch(`/api/taxonomies/${id}`, payload);
      if (res && res.ok === false) {
        throw new Error(res.error || res.detail || 'Failed to update taxonomy');
      }
      // local state already reflects edits
    } catch (err) {
      console.error('Failed to update taxonomy', err);
      setError(err.message || 'Failed to update taxonomy');
      // reload to discard bad local edits
      loadTaxonomies();
    } finally {
      setSavingId(null);
    }
  }

  // ---- Delete ----
  async function handleDelete(id) {
    if (!window.confirm('Delete this taxonomy? This cannot be undone.')) {
      return;
    }
    setSavingId(id);
    setError('');
    try {
      const res = await api.del(`/api/taxonomies/${id}`);
      if (res && res.ok === false) {
        throw new Error(res.error || res.detail || 'Failed to delete taxonomy');
      }
      setTaxonomies((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete taxonomy', err);
      setError(err.message || 'Failed to delete taxonomy');
    } finally {
      setSavingId(null);
    }
  }

  // ---- Render ----
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Taxonomies</h1>
        <p className="text-sm text-gray-600">
          Create and manage taxonomies like categories, tags, collections, etc.
        </p>
      </div>

      {/* Errors */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* New taxonomy form */}
      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
      >
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Label
          </label>
          <input
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={newTax.label}
            onChange={(e) =>
              setNewTax((t) => ({
                ...t,
                label: e.target.value,
              }))
            }
            placeholder="Collection"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Slug
          </label>
          <input
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={newTax.slug}
            onChange={(e) =>
              setNewTax((t) => ({
                ...t,
                slug: e.target.value,
              }))
            }
            placeholder={slugify(newTax.label || 'collection')}
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Leave blank to auto-generate from the label.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Options
          </label>
          <label className="inline-flex items-center text-xs text-gray-700">
            <input
              type="checkbox"
              className="mr-2"
              checked={newTax.isHierarchical}
              onChange={(e) =>
                setNewTax((t) => ({
                  ...t,
                  isHierarchical: e.target.checked,
                }))
              }
            />
            Hierarchical (like categories)
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="self-end inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {creating ? 'Adding…' : 'Add taxonomy'}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            Existing taxonomies
          </h2>
          {loading && (
            <span className="text-xs text-gray-500">Loading…</span>
          )}
        </div>

        <div className="divide-y divide-gray-100">
          {taxonomies.length === 0 && !loading && (
            <div className="px-4 py-6 text-sm text-gray-500">
              No taxonomies yet. Create your first one above.
            </div>
          )}

          {taxonomies.map((tax) => (
            <div
              key={tax.id}
              className="px-4 py-3 grid grid-cols-1 md:grid-cols-5 gap-3 items-center"
            >
              <div className="text-xs text-gray-400 truncate">
                ID: {tax.id}
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                  Label
                </label>
                <input
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                  value={tax.label || ''}
                  onChange={(e) =>
                    updateLocal(tax.id, { label: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                  Slug
                </label>
                <input
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                  value={tax.slug || ''}
                  onChange={(e) =>
                    updateLocal(tax.id, { slug: e.target.value })
                  }
                  placeholder={slugify(tax.label)}
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                  Options
                </label>
                <label className="inline-flex items-center mt-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={!!tax.isHierarchical}
                    onChange={(e) =>
                      updateLocal(tax.id, {
                        isHierarchical: e.target.checked,
                      })
                    }
                  />
                  Hierarchical
                </label>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => handleInlineSave(tax.id)}
                  disabled={savingId === tax.id}
                  className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  {savingId === tax.id ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(tax.id)}
                  disabled={savingId === tax.id}
                  className="inline-flex items-center rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
