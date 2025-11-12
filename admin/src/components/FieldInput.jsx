import React, { useState, useMemo } from 'react';
import RichTextEditor from './RichTextEditor';
import { combineDateAndTimeToUTC } from '../utils/datetime';
import { contrastRatio, normalizeHex } from '../utils/color';
import { uploadToSupabase, getSignedUrl, resolveBucketName } from '../lib/storage';

/** ---------- Helpers (added) ---------- */
// Normalize choices to array of { value, label }
function normalizeChoices(input){
  if (!input) return [];
  if (Array.isArray(input) && input.every(x => typeof x === 'string')) {
    return input.map(s => ({ value: String(s), label: String(s) }));
  }
  if (Array.isArray(input)) {
    return input.map(it => {
      if (it == null) return null;
      if (typeof it === 'string' || typeof it === 'number' || typeof it === 'boolean') {
        const s = String(it);
        return { value: s, label: s };
      }
      const value = it.value ?? it.slug ?? it.id ?? it.key ?? it.code ?? it.name ?? it.title ?? it.label;
      const label = it.label ?? it.title ?? it.name ?? it.value ?? it.slug ?? it.id ?? it.code ?? value;
      return value != null ? { value: String(value), label: String(label) } : null;
    }).filter(Boolean);
  }
  return [];
}

// Upload policy resolver (simple accept/max + optional rules[])
function resolveUploadPolicy(options){
  const simpleAccept = options?.accept;
  const simpleMax = options?.maxSizeMB;
  const rules = Array.isArray(options?.rules) ? options.rules : null;
  if (!rules || rules.length===0) return { accept: simpleAccept, maxSizeMB: simpleMax };
  const acceptAttr = rules.map(r=>r.accept).filter(Boolean).join(',');
  return { accept: acceptAttr || simpleAccept, maxSizeMB: simpleMax, rules };
}

/** Subfield config helper */
function subCfg(field, key, fallbackLabel, defaultShow=true) {
  const cfg = field?.options && typeof field.options === 'object' ? field.options : {};
  const s = cfg.subfields && typeof cfg.subfields === 'object' ? cfg.subfields[key] || {} : {};
  return {
    show: s.show !== undefined ? !!s.show : !!defaultShow,
    label: typeof s.label === 'string' && s.label.length ? s.label : fallbackLabel
  };
}

/** Simple NAME field with subfields */
function NameField({ field, value, onChange }){
  const v = value && typeof value==='object' ? value : {};
  const set = (patch) => onChange({ ...v, ...patch });
  const titleCfg = subCfg(field, 'title', 'Title');
  const firstCfg = subCfg(field, 'first', 'First');
  const middleCfg = subCfg(field, 'middle', 'Middle');
  const lastCfg = subCfg(field, 'last', 'Last');
  const maidenCfg = subCfg(field, 'maiden', 'Maiden');
  const suffixCfg = subCfg(field, 'suffix', 'Suffix');
  const titles = ['','Mr','Ms','Mrs','Mx','Dr','Prof','Rev'];

  return (
    <div style={{display:'grid', gap:8, maxWidth:520}}>
      {titleCfg.show && (
        <div>
          <label style={{fontSize:12,opacity:.8,display:'block'}}>{titleCfg.label}</label>
          <select value={v.title||''} onChange={e=>set({ title:e.target.value||undefined })}>
            {titles.map(t => <option key={t} value={t}>{t||'—'}</option>)}
          </select>
        </div>
      )}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        {firstCfg.show && (
          <div>
            <label style={{fontSize:12,opacity:.8,display:'block'}}>{firstCfg.label}</label>
            <input value={v.first||''} onChange={e=>set({ first:e.target.value })} />
          </div>
        )}
        {middleCfg.show && (
          <div>
            <label style={{fontSize:12,opacity:.8,display:'block'}}>{middleCfg.label}</label>
            <input value={v.middle||''} onChange={e=>set({ middle:e.target.value })} />
          </div>
        )}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        {lastCfg.show && (
          <div>
            <label style={{fontSize:12,opacity:.8,display:'block'}}>{lastCfg.label}</label>
            <input value={v.last||''} onChange={e=>set({ last:e.target.value })} />
          </div>
        )}
        {maidenCfg.show && (
          <div>
            <label style={{fontSize:12,opacity:.8,display:'block'}}>{maidenCfg.label}</label>
            <input value={v.maiden||''} onChange={e=>set({ maiden:e.target.value })} />
          </div>
        )}
      </div>
      {suffixCfg.show && (
        <div>
          <label style={{fontSize:12,opacity:.8,display:'block'}}>{suffixCfg.label}</label>
          <input value={v.suffix||''} onChange={e=>set({ suffix:e.target.value })} />
        </div>
      )}
    </div>
  );
}

/** ADDRESS field with subfields */
function AddressField({ field, value, onChange }){
  const base = { line1:'', line2:'', city:'', state:'', postal:'', country:'' };
  const a = { ...base, ...(typeof value === 'object' && value ? value : {}) };
  const set = (patch) => onChange({ ...a, ...patch });

  const cfg = {
    line1: subCfg(field, 'line1', 'Address line 1', true),
    line2: subCfg(field, 'line2', 'Address line 2', true),
    city:  subCfg(field, 'city',  'City', true),
    state: subCfg(field, 'state', 'State/Province', true),
    postal: subCfg(field, 'postal', 'ZIP/Postal', true),
    country: subCfg(field, 'country', 'Country', true),
  };

  return (
    <div className="field-address" style={{display:'grid', gap:8, maxWidth:520}}>
      {cfg.line1.show && (<div><label style={{fontSize:12,opacity:.8,display:'block'}}>{cfg.line1.label}</label>
        <input value={a.line1} onChange={e=>set({ line1:e.target.value })} /></div>)}
      {cfg.line2.show && (<div><label style={{fontSize:12,opacity:.8,display:'block'}}>{cfg.line2.label}</label>
        <input value={a.line2} onChange={e=>set({ line2:e.target.value })} /></div>)}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        {cfg.city.show && (<div><label style={{fontSize:12,opacity:.8,display:'block'}}>{cfg.city.label}</label>
          <input value={a.city} onChange={e=>set({ city:e.target.value })} /></div>)}
        {cfg.state.show && (<div><label style={{fontSize:12,opacity:.8,display:'block'}}>{cfg.state.label}</label>
          <input value={a.state} onChange={e=>set({ state:e.target.value })} /></div>)}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
        {cfg.postal.show && (<div><label style={{fontSize:12,opacity:.8,display:'block'}}>{cfg.postal.label}</label>
          <input value={a.postal} onChange={e=>set({ postal:e.target.value })} /></div>)}
        {cfg.country.show && (<div><label style={{fontSize:12,opacity:.8,display:'block'}}>{cfg.country.label}</label>
          <input value={a.country} onChange={e=>set({ country:e.target.value })} /></div>)}
      </div>
    </div>
  );
}

/**
 * Helpers for media fields
 */
function fieldVisibility(field){ return field?.options?.visibility === 'private' ? 'private' : 'public' }
function fieldFolder(field){ return field?.options?.folder || field.key || 'uploads' }

/**
 * Image upload UI (Supabase Storage)
 * Stores an object like:
 * { bucket, path, publicUrl?, alt, title, caption, credit, mime, size }
 */
function ImageField({ field, value, onChange, entryContext }){
  const [busy, setBusy] = useState(false);
  const visibility = fieldVisibility(field);
  const bucket = resolveBucketName(visibility === 'private' ? 'private' : 'public');
  const pathPrefix = `${fieldFolder(field)}/${entryContext?.typeSlug || 'unknown'}/${entryContext?.entryId || 'new'}`;

  const altCfg = subCfg(field, 'alt', 'Alt text');
  const titleCfg = subCfg(field, 'title', 'Title');
  const captionCfg = subCfg(field, 'caption', 'Caption');
  const creditCfg = subCfg(field, 'credit', 'Credit');

  const imageUrl = useMemo(() => {
    if (visibility === 'public') return value?.publicUrl || null;
    return null;
  }, [value, visibility]);

  async function handleUpload(e){
    const file = e.target.files?.[0];
    if (!file) return;

    // Client validation
    const policy = resolveUploadPolicy(field.options || {});
    const accept = policy.accept || 'image/*';
    const maxMB = Number(policy.maxSizeMB) || null;
    const typeOk = !accept || accept.split(',').some(p=>{
      p = p.trim();
      if (!p) return true;
      if (p.endsWith('/*')) return file.type.startsWith(p.slice(0,-1));
      return file.type === p;
    });
    if (!typeOk) { alert(`Invalid file type: ${file.type}`); e.target.value=''; return; }
    if (maxMB && file.size > maxMB*1024*1024){
      alert(`File is too large. Max ${maxMB} MB.`);
      e.target.value=''; return;
    }

    setBusy(true);
    try {
      const meta = await uploadToSupabase(file, { bucket, pathPrefix, makePublic: visibility==='public' });
      onChange({
        ...(value||{}),
        ...meta,
        alt: value?.alt || '',
        title: value?.title || '',
        caption: value?.caption || '',
        credit: value?.credit || '',
        mime: file.type,
        size: file.size,
      });
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function copySignedLink(){
    if (!value?.bucket || !value?.path) return;
    try {
      const url = await getSignedUrl(value.bucket, value.path, 3600);
      await navigator.clipboard.writeText(url);
      alert('Signed URL copied (valid 1h).');
    } catch {
      alert('Could not create signed URL.');
    }
  }

  const acceptAttr = resolveUploadPolicy(field.options).accept || 'image/*';

  return (
    <div style={{display:'grid', gap:6}}>
      {imageUrl ? <img src={imageUrl} alt={value?.alt||''} style={{maxWidth:240}} /> : <small>No image selected</small>}
      <input placeholder="Image URL" value={imageUrl || ''} readOnly />
      {altCfg.show && <input placeholder={altCfg.label} value={value?.alt||''} onChange={e=>onChange({...value, alt:e.target.value})} />}
      {titleCfg.show && <input placeholder={titleCfg.label} value={value?.title||''} onChange={e=>onChange({...value, title:e.target.value})} />}
      {captionCfg.show && <input placeholder={captionCfg.label} value={value?.caption||''} onChange={e=>onChange({...value, caption:e.target.value})} />}
      {creditCfg.show && <input placeholder={creditCfg.label} value={value?.credit||''} onChange={e=>onChange({...value, credit:e.target.value})} />}
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <input type="file" accept={acceptAttr} onChange={handleUpload} disabled={busy} />
        {visibility==='private' && value?.path && (
          <button type="button" onClick={copySignedLink} disabled={busy}>Copy signed URL</button>
        )}
      </div>
    </div>
  );
}

/**
 * Generic file upload UI
 * Stores: { bucket, path, publicUrl?, name, mime, size, title?, caption?, credit? }
 */
function FileField({ field, value, onChange, entryContext, accept }){
  const [busy, setBusy] = useState(false);
  const visibility = fieldVisibility(field);
  const bucket = resolveBucketName(visibility === 'private' ? 'private' : 'public');
  const pathPrefix = `${fieldFolder(field)}/${entryContext?.typeSlug || 'unknown'}/${entryContext?.entryId || 'new'}`;

  const titleCfg = subCfg(field, 'title', 'Title');
  const captionCfg = subCfg(field, 'caption', 'Caption');
  const creditCfg = subCfg(field, 'credit', 'Credit');

  async function handleUpload(e){
    const file = e.target.files?.[0];
    if (!file) return;

    // Client validation (uses field.options)
    const policy = resolveUploadPolicy(field.options || {});
    const acceptCombined = policy.accept || accept;
    const maxMB = Number(policy.maxSizeMB) || null;

    const typeOk = !acceptCombined || acceptCombined.split(',').some(p=>{
      p = p.trim();
      if (!p) return true;
      if (p.endsWith('/*')) return file.type.startsWith(p.slice(0,-1));
      return file.type === p;
    });
    if (!typeOk) { alert(`Invalid file type: ${file.type}`); e.target.value=''; return; }
    if (maxMB && file.size > maxMB*1024*1024){
      alert(`File is too large. Max ${maxMB} MB.`);
      e.target.value=''; return;
    }

    setBusy(true);
    try {
      const meta = await uploadToSupabase(file, { bucket, pathPrefix, makePublic: visibility==='public' });
      onChange({ ...meta, name:file.name, mime:file.type, size:file.size,
        title: value?.title || '', caption: value?.caption || '', credit: value?.credit || '' });
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function copySignedLink(){
    if (!value?.bucket || !value?.path) return;
    try {
      const url = await getSignedUrl(value.bucket, value.path, 3600);
      await navigator.clipboard.writeText(url);
      alert('Signed URL copied (1h).');
    } catch {
      alert('Could not create signed URL.');
    }
  }

  return (
    <div style={{display:'grid', gap:6}}>
      <input placeholder="File name" value={value?.name||''} readOnly />
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <input type="file" accept={accept} onChange={handleUpload} disabled={busy} />
        {visibility==='private' && value?.path && (
          <button type="button" onClick={copySignedLink} disabled={busy}>Copy signed URL</button>
        )}
      </div>
      {titleCfg.show && <input placeholder={titleCfg.label} value={value?.title||''} onChange={e=>onChange({ ...value, title: e.target.value })}/>}
      {captionCfg.show && <input placeholder={captionCfg.label} value={value?.caption||''} onChange={e=>onChange({ ...value, caption: e.target.value })}/>}
      {creditCfg.show && <input placeholder={creditCfg.label} value={value?.credit||''} onChange={e=>onChange({ ...value, credit: e.target.value })}/>}
      {visibility==='public' && value?.publicUrl && <small>Public URL: {value.publicUrl}</small>}
    </div>
  );
}

/**
 * FieldInput
 */
export default function FieldInput({ field, value, onChange, relatedCache, choicesCache, entryContext }) {
  // dynamic choice helpers
  const isChoice = ['radio','dropdown','checkbox'].includes(field.type);
  const isDynamic = isChoice && field.options && typeof field.options === 'object' && field.options.sourceType;
  let dynamicChoices = [];
  if (isDynamic) {
    const sourceType = field.options.sourceType;
    const sourceField = field.options.sourceField || 'title';
    const list = (choicesCache?.[sourceType]) || [];
    dynamicChoices = list.map(ent => {
      const v = (ent.data && (ent.data[sourceField] ?? ent.data.title)) ?? ent.id;
      return { value: String(v), label: String(v) };
    });
  }

  // ==== Basic types ====
  if (field.type === 'text') {
    return <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} />;
  }

  if (field.type === 'email') {
    return (
      <input
        type="email"
        value={value ?? ''}
        placeholder="email@example.com"
        onChange={e => onChange(e.target.value)}
      />
    );
  }

  if (field.type === 'phone') {
    return (
      <input
        type="tel"
        value={value ?? ''}
        placeholder="+1 760 660 1289"
        onChange={e => onChange(e.target.value)}
      />
    );
  }

  if (field.type === 'url') {
    return (
      <input
        type="url"
        value={value ?? ''}
        placeholder="https://example.com"
        onChange={e => onChange(e.target.value)}
      />
    );
  }

  if (field.type === 'textarea') {
    return <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} />;
  }

  if (field.type === 'number') {
    const opts = field.options || {};
    return (
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        {opts.prefix ? <span>{opts.prefix}</span> : null}
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          min={opts.min ?? undefined}
          max={opts.max ?? undefined}
          step={opts.step ?? (opts.decimals ? '0.01' : '1')}
          onChange={e => {
            const v = e.target.value;
            if (v === '') return onChange(null);
            const n = Number(v);
            if (Number.isNaN(n)) return;
            onChange(n);
          }}
        />
        {opts.suffix ? <span>{opts.suffix}</span> : null}
      </div>
    );
  }

  if (field.type === 'radio') {
    const choices = normalizeChoices(isDynamic ? dynamicChoices : (Array.isArray(field.options) ? field.options : []));
    const current = value ?? '';
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {choices.map(opt => (
          <label key={opt.value} style={{ display:'inline-flex', gap:6, alignItems:'center' }}>
            <input
              type="radio"
              name={field.key}
              value={opt.value}
              checked={String(current) === String(opt.value)}
              onChange={e => onChange(e.target.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'dropdown') {
    const choices = normalizeChoices(isDynamic ? dynamicChoices : (Array.isArray(field.options) ? field.options : []));
    return (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="" disabled>Select…</option>
        {choices.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    );
  }

  if (field.type === 'checkbox') {
    const choices = normalizeChoices(isDynamic ? dynamicChoices : (Array.isArray(field.options) ? field.options : []));
    const current = Array.isArray(value) ? value : [];
    return (
      <div>
        {choices.map(opt => {
          const checked = current.includes(opt.value);
          return (
            <label key={opt.value} style={{display:'block'}}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = checked
                    ? current.filter(v => v !== opt.value)
                    : [...current, opt.value];
                  onChange(next);
                }}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <label>
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(!!e.target.checked)}
        /> {field.label}
      </label>
    );
  }

  if (field.type === 'relationship') {
    const rel = field.options?.relatedType;
    const allowMultiple = !!(field.options && field.options.multiple);
    const list = (rel && relatedCache?.[rel]) || [];
    const idMapRaw = (typeof localStorage!=='undefined' && localStorage.getItem('serviceup.identifierKeyMap')) || '{}';

    function labelFor(ent){
      let idKey = 'title';
      try { idKey = (JSON.parse(idMapRaw)||{})[rel] || 'title'; } catch {}
      return (ent.data && ent.data[idKey]) ? ent.data[idKey] : (ent.data?.title || ent.id);
    }

    if (!allowMultiple) {
      return (
        <select value={value ?? ''} onChange={e => onChange(e.target.value)}>
          <option value="" disabled>Select related…</option>
          {list.map(ent => (
            <option key={ent.id} value={String(ent.id)}>{labelFor(ent)}</option>
          ))}
        </select>
      );
    }

    const current = Array.isArray(value) ? value.map(String) : (value ? [String(value)] : []);
    const size = Math.min(8, Math.max(3, list.length));
    return (
      <select
        multiple
        size={size}
        value={current}
        onChange={e => {
          const selected = Array.from(e.target.selectedOptions).map(o => o.value);
          onChange(selected);
        }}
        style={{ minWidth: 260 }}
      >
        {list.map(ent => (
          <option key={ent.id} value={String(ent.id)}>{labelFor(ent)}</option>
        ))}
      </select>
    );
  }

  // ==== Advanced (no server) ====
  if (field.type === 'rich_text') {
    return (
      <RichTextEditor
        value={value}
        onChange={onChange}
        options={{ headings: [1,2,3,4] }}
      />
    );
  }

  if (field.type === 'price') {
    const { currency='USD', allowOverride=true } = field.options || {};
    const amt = (value && typeof value==='object') ? value.amount : (value ?? null);
    const cur = (value && typeof value==='object' && value.currency) ? value.currency : currency;
    return (
      <div style={{display:'flex', gap:8}}>
        <input
          type="number" inputMode="decimal" placeholder="0.00"
          value={amt ?? ''} step="0.01" min="0"
          onChange={e => onChange({ amount: e.target.value === '' ? null : Number(e.target.value), currency: cur })}
        />
        <input
          value={cur}
          onChange={e => onChange({ amount: amt ?? null, currency: (e.target.value || 'USD').toUpperCase() })}
          disabled={!allowOverride}
          style={{width:100}}
        />
      </div>
    );
  }

  if (field.type === 'time') {
    // Store as { time: 'HH:MM', tz }
    const t = (value && typeof value === 'object') ? (value.time || '') : (typeof value === 'string' ? value : '');
    const tz = (value && typeof value === 'object' && value.tz) ? value.tz : Intl.DateTimeFormat().resolvedOptions().timeZone;
    return (
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input type="time" value={t} onChange={e => onChange({ time: e.target.value, tz })} step="60" />
        <span style={{ fontSize:12, opacity:.7 }}>{tz}</span>
      </div>
    );
  }

  if (field.type === 'datetime') {
    const v = value || { utc:'', sourceTZ: field.options?.defaultTZ || 'America/Los_Angeles' };
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const tz = field.options?.defaultTZ || 'America/Los_Angeles';

    return (
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
        <input type="time" value={time} onChange={e=>setTime(e.target.value)} step="60" />
        <button type="button" onClick={()=>{
          if (!date || !time) return;
          onChange({ utc: combineDateAndTimeToUTC(date, time, tz), sourceTZ: tz });
        }}>Set</button>
        {v.utc ? <small style={{marginLeft:8}}>Saved UTC: {v.utc}</small> : null}
      </div>
    );
  }

  // ==== DATERANGE with All day + time (added) ====
  if (field.type === 'daterange') {
    const tz = field.options?.defaultTZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const v = value || { start:'', end:'', allDay:true, tz };
    const allDay = v.allDay !== false;

    return (
      <div style={{display:'grid', gap:6}}>
        <label style={{display:'inline-flex', alignItems:'center', gap:6}}>
          <input type="checkbox" checked={allDay} onChange={e=>onChange({ ...v, allDay: !!e.target.checked })}/> All day
        </label>
        <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
          <input type="date" value={v.start||''} onChange={e=>onChange({ ...v, start: e.target.value })}/>
          {!allDay && <input type="time" value={v.startTime||''} onChange={e=>onChange({ ...v, startTime: e.target.value })} step="60" />}
          <span>–</span>
          <input type="date" value={v.end||''} onChange={e=>onChange({ ...v, end: e.target.value })}/>
          {!allDay && <input type="time" value={v.endTime||''} onChange={e=>onChange({ ...v, endTime: e.target.value })} step="60" />}
        </div>
        <small>Timezone: {tz}</small>
      </div>
    );
  }

  if (field.type === 'color') {
    const v = value || { hex:'#000000' };
    const against = field.options?.requireContrastAgainst || '#ffffff';
    let ratio = null;
    try { ratio = contrastRatio(v.hex||'#000000', against) } catch(e) { ratio = null }

    return (
      <div style={{display:'grid', gap:8}}>
        <input type="color" value={v.hex||'#000000'} onChange={e=>onChange({ ...v, hex: e.target.value })}/>
        <input placeholder="#rrggbb" value={v.hex||''} onChange={e=>{
          try { onChange({ ...v, hex: normalizeHex(e.target.value) }) } catch { onChange({ ...v, hex: e.target.value }) }
        }}/>
        {ratio ? <small>Contrast vs {against}: {ratio}:1</small> : null}
      </div>
    );
  }

  if (field.type === 'video_embed') {
    const v = value || { provider:'youtube', id:'' };
    return (
      <div style={{display:'grid', gap:6}}>
        <select value={v.provider} onChange={e=>onChange({ ...v, provider:e.target.value })}>
          <option value="youtube">YouTube</option>
          <option value="vimeo">Vimeo</option>
        </select>
        <input placeholder="Video ID (e.g., dQw4w9WgXcQ)" value={v.id} onChange={e=>onChange({ ...v, id:e.target.value })}/>
        <input type="number" placeholder="Start (sec)" value={v.start||''} onChange={e=>onChange({ ...v, start: e.target.value===''? undefined:Number(e.target.value) })}/>
      </div>
    );
  }

  if (field.type === 'iframe_embed') {
    const d = value || { src:'', title:'', aspect:'16:9' };
    return (
      <div style={{display:'grid', gap:6}}>
        <input placeholder="https://..." value={d.src} onChange={e=>onChange({ ...d, src:e.target.value })}/>
        <input placeholder="Title (accessibility)" value={d.title||''} onChange={e=>onChange({ ...d, title:e.target.value })}/>
        <select value={d.aspect||'16:9'} onChange={e=>onChange({ ...d, aspect:e.target.value })}>
          <option>16:9</option><option>4:3</option><option>1:1</option><option>auto</option>
        </select>
      </div>
    );
  }

  // ==== Media (Supabase) ====
  if (field.type === 'image') {
    return <ImageField field={field} value={value} onChange={onChange} entryContext={entryContext} />;
  }

  if (field.type === 'file' || field.type === 'document') {
    const accept = field.options?.accept; // undefined = allow any; or set 'application/pdf'
    return <FileField field={field} value={value} onChange={onChange} entryContext={entryContext} accept={accept} />;
  }

  if (field.type === 'video') {
    const accept = field.options?.accept || 'video/*';
    return <FileField field={field} value={value} onChange={onChange} entryContext={entryContext} accept={accept} />;
  }

  // ==== New structured types ====

  // JSON field (added)
  if (field.type === 'json') {
    const [text, setText] = useState(() => {
      try { return value ? JSON.stringify(value, null, 2) : ''; } catch { return ''; }
    });
    const [valid, setValid] = useState(true);
    function handleChange(t){
      setText(t);
      if (t.trim()===''){ onChange(null); setValid(true); return; }
      try { onChange(JSON.parse(t)); setValid(true); }
      catch { setValid(false); }
    }
    return (
      <div style={{display:'grid', gap:6}}>
        <textarea rows={8} value={text} onChange={e=>handleChange(e.target.value)} placeholder='{"key":"value"}' />
        <small style={{color: valid ? '#0a0' : '#a00'}}>{valid ? 'Valid JSON' : 'Invalid JSON'}</small>
      </div>
    );
  }

  // Tags with suggestions/autocomplete.
  if (field.type === 'tags') {
    const isDynamic = field.options && typeof field.options === 'object' && field.options.sourceType;
    let suggestions = [];
    if (isDynamic) {
      const sourceType = field.options.sourceType;
      const sourceField = field.options.sourceField || 'title';
      const list = (choicesCache?.[sourceType]) || [];
      suggestions = list.map(ent => {
        const v = (ent.data && (ent.data[sourceField] ?? ent.data.title)) ?? ent.id;
        return String(v);
      });
    } else if (field.options && typeof field.options === 'object' && Array.isArray(field.options.suggestions)) {
      suggestions = field.options.suggestions.map(String);
    } else if (typeof field.options === 'string') {
      suggestions = field.options.split(',').map(s=>s.trim()).filter(Boolean);
    }

    const chips = Array.isArray(value) ? [...value] :
      (typeof value === 'string' && value.includes(',')) ? value.split(',').map(s=>s.trim()).filter(Boolean) :
      (value ? [String(value)] : []);

    const [inputText, setInputText] = useState('');

    function addChip(token){
      const t = String(token || '').trim();
      if (!t) return;
      if (!chips.includes(t)) onChange([...(chips||[]), t]);
    }
    function removeChip(t){
      onChange(chips.filter(x => x !== t));
    }
    function onKeyDown(e){
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addChip(inputText);
        setInputText('');
      }
    }
    function onBlurCommit(){
      if (inputText.trim()) {
        addChip(inputText);
        setInputText('');
      }
    }

    return (
      <div>
        <input
          list={field.key + '-tags-list'}
          placeholder="tag1, tag2, tag three"
          value={inputText}
          onChange={e=>setInputText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlurCommit}
        />
        {suggestions.length > 0 && (
          <datalist id={field.key + '-tags-list'}>
            {suggestions.map(s => <option key={s} value={s} />)}
          </datalist>
        )}
        {chips.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
            {chips.map((t,i) => (
              <span key={t + i} style={{ padding:'2px 8px', border:'1px solid #ddd', borderRadius:12, fontSize:12, display:'inline-flex', alignItems:'center', gap:6 }}>
                {t}
                <button type="button" onClick={()=>removeChip(t)} aria-label={"Remove " + t} style={{border:'none', background:'transparent', cursor:'pointer'}}>×</button>
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize:12, opacity:.6, marginTop:4 }}>Press Enter or comma to add. Spaces inside a tag are allowed.</div>
      </div>
    );
  }

  if (field.type === 'name') {
    return <NameField field={field} value={value} onChange={onChange} />;
  }

  if (field.type === 'address') {
    return <AddressField field={field} value={value} onChange={onChange} />;
  }
// --- relation_user (no external imports) ---
if (field.type === 'relation_user') {
  const ru = (value && typeof value === 'object') ? value : {};
  const isSingle = !(field?.options && field.options.selection === 'multiple');

  if (isSingle) {
    // stores: { owner_id }
    return (
      <div style={{display:'grid', gap:6}}>
        <input
          placeholder="Owner user ID (UUID)"
          value={ru.owner_id || ''}
          onChange={e => onChange({ ...ru, owner_id: e.target.value || null })}
        />
        <small style={{opacity:.7}}>
          Minimal mode: enter a Supabase user UUID. (Search picker can come later.)
        </small>
      </div>
    );
  }

  // multiple: stores { user_ids: [] }
  const ids = Array.isArray(ru.user_ids) ? ru.user_ids : [];
  return (
    <div style={{display:'grid', gap:6}}>
      <input
        placeholder="Comma-separated user IDs (UUIDs)"
        value={ids.join(', ')}
        onChange={e => {
          const parts = e.target.value.split(',').map(s=>s.trim()).filter(Boolean);
          onChange({ ...ru, user_ids: parts });
        }}
      />
      <small style={{opacity:.7}}>
        Minimal mode: comma-separated UUIDs. (Search & chips UI can come later.)
      </small>
    </div>
  );
}

// --- taxonomy (no external imports) ---
if (field.type === 'taxonomy') {
  // shape: { term_slugs: { [taxonomyKey]: [slug,...] } }
  const key = (field?.options && field.options.taxonomyKey) || 'tag';
  const isSingle = !!(field?.options && field.options.selection === 'single');
  const tv = (value && typeof value === 'object') ? value : {};
  const current = Array.isArray(tv.term_slugs?.[key]) ? tv.term_slugs[key] : [];

  function apply(slugsArr) {
    const next = { ...(tv.term_slugs || {}), [key]: slugsArr };
    onChange({ ...tv, term_slugs: next });
  }

  if (isSingle) {
    const one = current[0] || '';
    return (
      <div style={{display:'grid', gap:6}}>
        <input
          placeholder={`/${key} slug (single)`}
          value={one}
          onChange={e => apply(e.target.value ? [e.target.value.trim()] : [])}
        />
        <small style={{opacity:.7}}>
          Minimal mode: type a single term slug. (Picker/tree can come later.)
        </small>
      </div>
    );
  }

  // multiple
  return (
    <div style={{display:'grid', gap:6}}>
      <input
        placeholder={`/${key} slugs, comma-separated`}
        value={current.join(', ')}
        onChange={e => {
          const parts = e.target.value.split(',').map(s=>s.trim()).filter(Boolean);
          apply(parts);
        }}
      />
      <small style={{opacity:.7}}>
        Minimal mode: comma-separated slugs. (Search + create can come later.)
      </small>
    </div>
  );
}


  // Fallback text
  return <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} />;
}
