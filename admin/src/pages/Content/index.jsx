import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

/**
 * Expected API:
 *   GET /content-types ->
 *     [{ slug: 'articles', name: 'Articles' }, ...]
 */
export default function ContentIndex() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/content-types');
        const list = Array.isArray(res) ? res : res?.data || [];
        const normalized = list.map((t) => ({
          slug: t.slug || t.id || t.key,
          name: t.name || t.label || t.title || t.slug || 'Untitled',
        }));
        setTypes(normalized);
      } catch (e) {
        console.error(e);
        setError('Unable to load content types.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="su-card">Loading content types…</div>;
  }

  if (error) {
    return <div className="su-card su-error">{error}</div>;
  }

  return (
    <div className="su-card">
      <h2>Content Types</h2>
      <p>Select a type to manage entries.</p>
      <ul>
        {types.map((t) => (
          <li key={t.slug} style={{ marginBottom: 8 }}>
            <Link className="su-btn" to={`/admin/content/${t.slug}`}>
              {t.name}
            </Link>
          </li>
        ))}
        {types.length === 0 && <li>No content types yet.</li>}
      </ul>
    </div>
  );
}
