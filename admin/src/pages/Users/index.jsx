import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function UsersPage(){
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  useEffect(()=>{ api.get('/users').then(setUsers).catch(()=> setUsers([])); },[]);
  function filtered(){ return users.filter(u => (u.email||'').toLowerCase().includes(q.toLowerCase())); }
  async function setRole(id, role){
    await api.patch(`/users/${id}`, { role });
    setUsers(uu => uu.map(u => u.id===id ? { ...u, role } : u));
  }
  return (
    <div className="su-card">
      <h2>Users</h2>
      <input className="su-input" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
      <div style={{height:8}}/>
      <table style={{width:'100%', borderCollapse:'collapse'}}>
        <thead>
          <tr><th align="left">Name</th><th align="left">Email</th><th>Role</th></tr>
        </thead>
        <tbody>
          {filtered().map(u => (
            <tr key={u.id} style={{borderTop:'1px solid var(--su-border)'}}>
              <td>{u.name||'-'}</td>
              <td>{u.email}</td>
              <td>
                <select className="su-select" value={u.role||'VIEWER'} onChange={e=> setRole(u.id, e.target.value)}>
                  <option>ADMIN</option>
                  <option>EDITOR</option>
                  <option>VIEWER</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
