import React, { useState } from 'react';
import WidgetRenderer from './widgets/WidgetRenderer';

export default function Dashboard(){
  const [widgets, setWidgets] = useState([
    { id: 'w1', type:'quickLinks', title:'Shortcuts', config:{ links:[{label:'Add Content', to:'/admin/content'},{label:'Settings', to:'/admin/settings'}] } },
    { id: 'w2', type:'html', title:'Custom block', config:{ html:'<p>raw HTML, messages…</p>' } }
  ]);
  const [editing, setEditing] = useState(false);

  function addWidget(type){
    const id = String(Math.random()).slice(2);
    setWidgets(w => [...w, { id, type, title:type, config:{} }]);
  }

  return (
    <div>
      <div style={{display:'flex', gap:8, marginBottom:12}}>
        <button className="su-btn" onClick={()=> setEditing(v=>!v)}>{editing?'Done':'Edit Blocks'}</button>
        {editing && (
          <>
            <button className="su-btn" onClick={()=> addWidget('quickLinks')}>+ Quick Links</button>
            <button className="su-btn" onClick={()=> addWidget('html')}>+ HTML Block</button>
          </>
        )}
      </div>
      <div className="su-grid cols-2">
        {widgets.map(w => (
          <div key={w.id} className="su-card">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <strong>{w.title || w.type}</strong>
              {editing && <button className="su-btn" onClick={()=> setWidgets(ws=> ws.filter(x=> x.id!==w.id))}>Remove</button>}
            </div>
            <div style={{height:8}}/>
            <WidgetRenderer widget={w} />
          </div>
        ))}
      </div>
      <div style={{position:'fixed', right:16, bottom:16}}>
        <button className="su-btn primary" onClick={()=> setEditing(v=>!v)} aria-label="Edit Blocks">Edit Blocks</button>
      </div>
    </div>
  );
}
