import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

/** Minimal generic editor.
 *  Assumes your backend returns the field schema + values.
 *  Integrate your existing FieldInput components later.
 */
export default function TypeEditor(){
  const nav = useNavigate();
  const { typeSlug, id } = useParams();
  const [doc, setDoc] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    (async ()=>{
      try{
        const data = id==='new' ? {} : await api.get(`/content/${typeSlug}/${id}`);
        setDoc(data || {});
      }finally{ setLoading(false); }
    })();
  },[typeSlug, id]);

  async function save(){
    const saved = id==='new'
      ? await api.post(`/content/${typeSlug}`, doc)
      : await api.patch(`/content/${typeSlug}/${id}`, doc);
    alert('Saved ✓');
    nav(`/admin/content/${typeSlug}/${saved.id || id}`);
  }

  if(loading) return <div className="su-card">Loading…</div>;

  return (
    <div className="su-grid cols-2">
      <div className="su-card">
        <label>Title
          <input className="su-input" value={doc.title||''} onChange={e=> setDoc({...doc, title:e.target.value})} />
        </label>
        <div style={{height:8}}/>
        <label>Slug
          <input className="su-input" value={doc.slug||''} onChange={e=> setDoc({...doc, slug:e.target.value})} />
        </label>
        <div style={{height:12}}/>
        <button className="su-btn primary" onClick={save}>Save</button>
      </div>
      <div className="su-card">
        <h3>Preview</h3>
        <div style={{opacity:.7}}>(Attach your advanced field editor here.)</div>
      </div>
    </div>
  );
}
