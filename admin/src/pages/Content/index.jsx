import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

/** Expected API:
 *  GET /content-types  ->  [{ slug:'articles', name:'Articles' }, ...]
 *  If your keys differ, mapping below normalizes common shapes.
 */
export default function ContentIndex(){
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(()=>{
    (async ()=>{
      try{
        const res = await api.get('/content-types');
        const list = (Array.isArray(res) ? res : res?.data || []).map(t => ({
          slug: t.slug || t.key || t.id,
          name: t.name || t.label || t.title || (t.slug || t.key || 'Type')
        }));
        setTypes(list);
      }catch(e){
        setError(e.message || 'Failed to load content types');
      }finally{ setLoading(false); }
    })();
  },[]);

  if(loading) return <div className="su-card">Loading…</div>;
  if(error) return <div className="su-card">Couldn’t load types: {error}</div>;
  if(!types.length) return <div className="su-card">No content types yet.</div>;

  return (
    <div className="su-card">
      <h2>Content</h2>
      <ul>
        {types.map(t => (
          <li key={t.slug} style={{marginBottom:8}}>
            <Link className="su-btn" to={`/admin/content/${t.slug}`}>{t.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
