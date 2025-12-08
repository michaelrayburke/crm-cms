import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useNavigate } from 'react-router-dom';

export default function WidgetsList() {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setLoadError('');

        const res = await api.get('/api/widgets');
        const list = Array.isArray(res) ? res : [];

        if (!cancelled) {
          setWidgets(list);
        }
      } catch (err) {
        console.error('[WidgetsList] Failed to load widgets', err);
        if (!cancelled) {
          setLoadError(
            err?.message || 'Failed to load widgets from the server.',
          );
          setWidgets([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNew = () => {
    navigate('/admin/widgets/new');
  };

  const handleRowClick = (id) => {
    navigate(`/admin/widgets/${id}`);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Widgets</h1>
          <p className="text-sm text-gray-500">
            Manage reusable widgets (hero sections, CTAs, feature blocks, etc.)
          </p>
        </div>
        <button className="su-btn primary" onClick={handleNew}>
          + New Widget
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading widgets…</p>}
      {!loading && loadError && (
        <p className="text-sm text-red-600">{loadError}</p>
      )}

      {!loading && !loadError && widgets.length === 0 && (
        <p className="text-sm text-gray-500">
          No widgets yet. Click “New Widget” to create your first one.
        </p>
      )}

      {!loading && !loadError && widgets.length > 0 && (
        <div className="su-table-wrapper">
          <table className="su-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Type</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {widgets.map((w) => (
                <tr
                  key={w.id}
                  onClick={() => handleRowClick(w.id)}
                  className="cursor-pointer hover:bg-orange-50"
                >
                  <td>{w.name}</td>
                  <td className="text-xs text-gray-500">{w.slug}</td>
                  <td className="text-xs text-gray-600">
                    {w.widget_type || '—'}
                  </td>
                  <td className="text-xs">
                    {w.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="text-xs text-gray-500">
                    {w.updated_at
                      ? new Date(w.updated_at).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}