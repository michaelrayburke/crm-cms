import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

export default function TypeList(){
  const { typeSlug } = useParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(()=>{
    (async ()=>{
      try{
        const res = await api.get(`/content/${typeSlug}`);
        setRows(Array.isArray(res) ? res : res?.data || []);
      }catch(e){
        setError(e.message || 'Failed to load');
      }finally{ setLoading(false); }
    })();
  },[typeSlug]);

  if(loading) return <div className="su-card">Loading…</div>;
  if(error) return <div className="su-card">Error: {error}</div>;

  return (
    <div className="su-card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h2>{typeSlug}</h2>
        <Link className="su-btn primary" to={`/admin/content/${typeSlug}/new`}>Add</Link>
      </div>
      <table style={{width:'100%', borderCollapse:'collapse'}}>
        <thead><tr><th align="left">Title</th><th align="left">Status</th><th align="left">Updated</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id || r._id} style={{borderTop:'1px solid var(--su-border)'}}>
              <td><Link to={`/admin/content/${typeSlug}/${r.id || r._id}`}>{r.title||'(untitled)'}</Link></td>
              <td>{r.status||'-'}</td>
              <td>{r.updatedAt||r.updated_at||'-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
