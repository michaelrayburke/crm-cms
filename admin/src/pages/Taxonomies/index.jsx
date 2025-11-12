import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function TaxonomiesPage(){
  const [tax, setTax] = useState([]);
  const [form, setForm] = useState({ key:'', label:'', isHierarchical:false });
  useEffect(()=>{ api.get('/taxonomies').then(setTax).catch(()=> setTax([])); },[]);
  async function add(){
    const created = await api.post('/taxonomies', form);
    setTax(t => [...t, created]);
    setForm({ key:'', label:'', isHierarchical:false });
  }
  return (
    <div className="su-grid cols-2">
      <div className="su-card">
        <h2>Create Taxonomy</h2>
        <label>Key <input className="su-input" value={form.key} onChange={e=>setForm({...form, key:e.target.value})} placeholder="categories" /></label>
        <div style={{height:8}}/>
        <label>Label <input className="su-input" value={form.label} onChange={e=>setForm({...form, label:e.target.value})} placeholder="Categories" /></label>
        <div style={{height:8}}/>
        <label><input type="checkbox" checked={form.isHierarchical} onChange={e=>setForm({...form, isHierarchical:e.target.checked})} /> Hierarchical</label>
        <div style={{height:8}}/>
        <button className="su-btn primary" onClick={add}>Add</button>
      </div>
      <div className="su-card">
        <h2>Taxonomies</h2>
        <ul>
          {tax.map(t => <li key={t.id} style={{padding:'8px 0', borderBottom:'1px solid var(--su-border)'}}>{t.label} <span style={{color:'var(--su-muted)'}}>(/{t.key})</span></li>)}
        </ul>
      </div>
    </div>
  );
}
