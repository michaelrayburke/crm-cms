import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

export default function TypeList() {
  const { typeSlug } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/content/${typeSlug}`);
        const list = Array.isArray(res) ? res : res?.data || [];
        setRows(list);
      } catch (e) {
        console.error(e);
        setError('Unable to load content.');
      } finally {
        setLoading(false);
      }
    })();
  }, [typeSlug]);

  function addNew() {
    navigate(`/admin/content/${typeSlug}/new`);
  }

  if (loading) {
    return <div className="su-card">Loading content…</div>;
  }

  if (error) {
    return <div className="su-card su-error">{error}</div>;
  }

  return (
    <div className="su-card">
      <div
        style={{
          display: 'flex',
          justifyacing: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0 }}>{typeSlug}</h2>
        <button className="su-btn primary" onClick={addNew}>
          + Add {typeSlug.slice(0, 1).toUpperCase() + typeSlug.slice(1)}
        </button>
      </div>

      <table className="su-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th align="left">Title</th>
            <th align="left">Status</th>
            <th align="left">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const id = r.id || r._id;
            return (
              <tr
                key={id}
                style={{ borderTop: '1px solid var(--su-border)' }}
              >
                <td>
                  <Link to={`/admin/content/${typeSlug}/${id}`}>
                    {r.title || '(untitled)'}
                  </Link>
                </td>
                <td>{r.status || '-'}</td>
                <td>{r.updatedAt || r.updated_at || '-'}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: '12px 0', opacity: 0.7 }}>
                No entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
