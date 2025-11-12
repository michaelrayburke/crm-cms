import React from 'react';
import { Link } from 'react-router-dom';

function QuickLinks({ config }){
  return (
    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
      {(config?.links||[]).map((l,i)=>(<Link key={i} to={l.to} className="su-btn">{l.label}</Link>))}
    </div>
  );
}

function HtmlBlock({ config }){
  return <div dangerouslySetInnerHTML={{__html: config?.html || ''}} />;
}

export default function WidgetRenderer({ widget }){
  switch(widget.type){
    case 'quickLinks': return <QuickLinks config={widget.config} />;
    case 'html': return <HtmlBlock config={widget.config} />;
    default: return <em style={{color:'var(--su-muted)'}}>Unknown widget: {widget.type}</em>;
  }
}
