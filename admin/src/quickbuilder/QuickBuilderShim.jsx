// Trigger redeploy

import { useEffect, useMemo, useState } from 'react';
import FieldInput from '../components/FieldInput';
import { supabase } from '../lib/supabaseClient'; // ensure Supabase Auth session exists

// === CONFIG ===

// === IDENTIFIER & SLUG HELPERS ===
function slugify(input='') {
  return String(input)
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 160);
}
function getIdentifierKeyForType(typeSlug) {
  try {
    const map = JSON.parse(localStorage.getItem('serviceup.identifierKeyMap')||'{}');
    return map[typeSlug] || 'title';
  } catch { return 'title'; }
}
function setIdentifierKeyForType(typeSlug, key) {
  const raw = localStorage.getItem('serviceup.identifierKeyMap')||'{}';
  const map = (()=>{ try{return JSON.parse(raw)||{};}catch{return{};} })();
  map[typeSlug] = key;
  localStorage.setItem('serviceup.identifierKeyMap', JSON.stringify(map));
}
function getSlugEnabled(typeSlug) {
  try {
    const map = JSON.parse(localStorage.getItem('serviceup.slugEnabledMap')||'{}');
    return !!map[typeSlug];
  } catch { return false; }
}
function setSlugEnabled(typeSlug, enabled) {
  const raw = localStorage.getItem('serviceup.slugEnabledMap')||'{}';
  const map = (()=>{ try{return JSON.parse(raw)||{};}catch{return{};} })();
  map[typeSlug] = !!enabled;
  localStorage.setItem('serviceup.slugEnabledMap', JSON.stringify(map));
}

const API_BASE = import.meta.env.VITE_API_BASE || 'https://serviceup-api.onrender.com';
console.log('API_BASE', API_BASE);

// One place to define what the UI can create/edit
const BASE_FIELD_TYPES = [
  'text','textarea','number','boolean','date','json',
  'radio','dropdown','checkbox','relationship',
  'email','phone','url','address','rich_text','name',
  'datetime','daterange','time','price','image','file','video','color','video_embed','iframe_embed','tags'
, 'relation_user','taxonomy'];

// === Subfield UI helpers ===
const SUBFIELD_MAP = {
  name:    { title: 'Title', first: 'First', middle: 'Middle', last: 'Last', maiden: 'Maiden', suffix: 'Suffix' },
  address: { line1: 'Address line 1', line2: 'Address line 2', city: 'City', state: 'State/Province', postal: 'ZIP/Postal', country: 'Country' },
  image:   { alt: 'Alt text', title: 'Title', caption: 'Caption', credit: 'Credit' },
  file:    { title: 'Title', caption: 'Caption', credit: 'Credit' },
  video:   { title: 'Title', caption: 'Caption', credit: 'Credit' },
};

function supportsSubfields(type) {
  return !!SUBFIELD_MAP[String(type || '').toLowerCase()];
}

function normalizeSubfieldOptions(opts, type) {
  const t = String(type || '').toLowerCase();
  const base = { subfields: {} };
  const out = (opts && typeof opts === 'object') ? { ...opts } : base;
  if (!out.subfields || typeof out.subfields !== 'object') out.subfields = {};
  const schema = SUBFIELD_MAP[t] || {};
  for (const k of Object.keys(schema)) {
    const row = out.subfields[k] || {};
    const show = row.show === undefined ? true : !!row.show;
    const label = (typeof row.label === 'string' && row.label.length) ? row.label : schema[k];
    out.subfields[k] = { show, label };
  }
  // prune unknown keys
  for (const k of Object.keys(out.subfields)) {
    if (!schema[k]) delete out.subfields[k];
  }
  return out;
}

function SubfieldControls({ type, options, onChange }) {
  const t = String(type || '').toLowerCase();
  const schema = SUBFIELD_MAP[t] || null;
  if (!schema) return null;

  const normalized = normalizeSubfieldOptions(options, t);

  function updateRow(key, patch) {
    const next = normalizeSubfieldOptions(normalized, t);
    next.subfields[key] = { ...next.subfields[key], ...patch };
    onChange(next);
  }

  return (
    <div style={{ marginTop: 10, padding: 10, border: '1px dashed #bbb', borderRadius: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Subfields</div>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 80px 1fr', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 12, opacity: .6 }}>Key</div>
        <div style={{ fontSize: 12, opacity: .6 }}>Show</div>
        <div style={{ fontSize: 12, opacity: .6 }}>Label</div>
        {Object.entries(schema).map(([key, defaultLabel]) => {
          const row = normalized.subfields[key] || { show: true, label: defaultLabel };
          return (
            <>
              <div><code>{key}</code></div>
              <div>
                <input
                  type="checkbox"
                  checked={!!row.show}
                  onChange={e => updateRow(key, { show: !!e.target.checked })}
                />
              </div>
              <div>
                <input
                  value={row.label}
                  onChange={e => updateRow(key, { label: e.target.value })}
                />
              </div>
            </>
          );
        })}
      </div>
    </div>
  );
}

// === Options helpers ===
function normalizeOptionsForSave(field) {
  // Tags
  if (field.type === 'tags') {
    if (typeof field.options === 'object' && field.options?.sourceType) {
      const srcField = field.options.sourceField || 'title';
      return { sourceType: String(field.options.sourceType).trim(), sourceField: srcField };
    }
    if (!field.options) return { suggestions: [] };
    if (Array.isArray(field.options)) return { suggestions: field.options };
    return { suggestions: String(field.options).split(',').map(s => s.trim()).filter(Boolean) };
  }

  // Price
  if (field.type === 'price') {
    if (field.options && typeof field.options === 'object') {
      const cur = String(field.options.currency || 'USD').toUpperCase();
      const allow = field.options.allowOverride === false ? false : true;
      return { currency: cur, allowOverride: allow };
    }
    return { currency: 'USD', allowOverride: true };
  }

  // Choice fields
  if (['radio', 'dropdown', 'checkbox'].includes(field.type)) {
    if (typeof field.options === 'object' && field.options?.sourceType) {
      const srcField = field.options.sourceField || 'title';
      return { sourceType: String(field.options.sourceType).trim(), sourceField: srcField };
    }
    if (!field.options) return [];
    if (Array.isArray(field.options)) return field.options;              // already [{value,label}] or strings
    return String(field.options).split(',').map(s => s.trim()).filter(Boolean);
  }

// relation_user
if (field.type === 'relation_user') {
  const sel = (field.options && typeof field.options === 'object' && field.options.selection) || 'single';
  return { selection: sel === 'multiple' ? 'multiple' : 'single' };
}

// taxonomy
if (field.type === 'taxonomy') {
  const key = (field.options && typeof field.options === 'object' && field.options.taxonomyKey) || (typeof field.options === 'string' ? field.options : 'tag');
  const sel = (field.options && typeof field.options === 'object' && field.options.selection) || 'multiple';
  return { taxonomyKey: String(key || 'tag'), selection: sel === 'single' ? 'single' : 'multiple' };
}


  // Relationship
  if (field.type === 'relationship') {
    if (!field.options) return null;
    if (typeof field.options === 'object' && field.options.relatedType) {
      return { relatedType: String(field.options.relatedType).trim(), multiple: !!field.options.multiple, twoWay: !!field.options.twoWay, inverseKey: field.options.inverseKey || '' };
    }
    return { relatedType: String(field.options).trim(), multiple: false };
  }

  // Subfield-enabled types: pass options objects through
  if (supportsSubfields(field.type) && field.options && typeof field.options === 'object') {
    return field.options;
  }

  // JSON-in-string for power users
  if (typeof field.options === 'string' && field.options.trim().startsWith('{')) {
    try { return JSON.parse(field.options); } catch {}
  }

  return null;
}

function parseOptionsForEdit(type, options) {
  // Tags
  if (type === 'tags') {
    if (options && typeof options === 'object' && options.sourceType) {
      return { sourceType: options.sourceType, sourceField: options.sourceField || 'title' };
    }
    if (options && typeof options === 'object' && Array.isArray(options.suggestions)) {
      return options.suggestions.join(', ');
    }
    if (Array.isArray(options)) return options.join(', ');
    return typeof options === 'string' ? options : (options?.suggestions ? String(options.suggestions) : '');
  }

  // Choice fields
  if (['radio', 'dropdown', 'checkbox'].includes(type)) {
    if (options && typeof options === 'object' && options.sourceType) {
      return { sourceType: options.sourceType, sourceField: options.sourceField || 'title' };
    }
    if (Array.isArray(options)) return options.join(', ');   // display-friendly
    return typeof options === 'string' ? options : '';
  }

  // Relationship
  if (type === 'relationship') {
    if (!options) return { relatedType: '', multiple: false, twoWay: false, inverseKey: '' };
    if (typeof options === 'object') return { relatedType: options.relatedType || '', multiple: !!options.multiple, twoWay: !!options.twoWay, inverseKey: options.inverseKey || '' };
    return { relatedType: String(options), multiple: false, twoWay: false, inverseKey: '' };
  }

if (type === 'relation_user') {
  if (options && typeof options === 'object') {
    return { selection: options.selection === 'multiple' ? 'multiple' : 'single' };
  }
  if (typeof options === 'string') {
    return { selection: options === 'multiple' ? 'multiple' : 'single' };
  }
  return { selection: 'single' };
}

if (type === 'taxonomy') {
  if (options && typeof options === 'object') {
    return { taxonomyKey: options.taxonomyKey || 'tag', selection: options.selection === 'single' ? 'single' : 'multiple' };
  }
  if (typeof options === 'string') {
    return { taxonomyKey: options || 'tag', selection: 'multiple' };
  }
  return { taxonomyKey: 'tag', selection: 'multiple' };
}


  // Price
  if (type === 'price') {
    if (options && typeof options === 'object') {
      return { currency: (options.currency || 'USD').toUpperCase(), allowOverride: options.allowOverride !== false };
    }
    if (typeof options === 'string' && options) {
      return { currency: options.toUpperCase(), allowOverride: true };
    }
    return { currency: 'USD', allowOverride: true };
  }

  // Subfield-enabled: keep objects intact
  if (supportsSubfields(type) && options && typeof options === 'object') {
    return options;
  }

  return '';
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');

  const authedHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  // AUTH
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  async function login() {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    if (!res.ok) { alert('Login failed'); return; }
    const data = await res.json();
    setToken(data.token);
    localStorage.setItem('token', data.token);

    const { error: sbAuthErr } = await supabase.auth.signInWithPassword({
      email: loginEmail, password: loginPassword,
    });
    if (sbAuthErr) { console.error('Supabase auth failed:', sbAuthErr.message); alert('Supabase sign-in failed.'); return; }
  }

  // STATE
  const [types, setTypes] = useState([]);
  const [selectedTypeSlug, setSelectedTypeSlug] = useState('');
  const [selectedType, setSelectedType] = useState(null);

  // create new type form
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [newNameSingular, setNewNameSingular] = useState('');
  const [newNamePlural, setNewNamePlural] = useState('');
  const [newFields, setNewFields] = useState([
    { key: 'title', label: 'Title', type: 'text', required: true, sort: 0, options: '' },
  ]);

  // edit selected type
  const [editSlug, setEditSlug] = useState('');
  const [editName, setEditName] = useState('');
  const [editNameSingular, setEditNameSingular] = useState('');
  const [editNamePlural, setEditNamePlural] = useState('');
  const [editingFields, setEditingFields] = useState([]);

  // entries
  const [entries, setEntries] = useState([]);
  const [prevEntryData, setPrevEntryData] = useState(null);
  const [entryData, setEntryData] = useState({});
  function setEntryField(key, value) {
    setEntryData(prev => {
      const next = { ...prev, [key]: value };
      try {
        const idKey = getIdentifierKeyForType(selectedType?.slug || '');
        if (getSlugEnabled(selectedType?.slug || '') && key === idKey) {
          if (!next.slug || next.slug.length === 0) {
            next.slug = slugify(String(value||''));
          }
        }
      } catch {}
      return next;
    });
  }

  const [editingEntryId, setEditingEntryId] = useState(null);
  const [creatingNew, setCreatingNew] = useState(false);

  // caches
  const [relatedCache, setRelatedCache] = useState({});
  const [choicesCache, setChoicesCache] = useState({});

  // DATA FETCHERS
  async function fetchTypes() {
    const res = await fetch(`${API_BASE}/api/content-types`, { headers: authedHeaders });
    if (!res.ok) return setTypes([]);
    const data = await res.json();
    setTypes(data || []);
  }

  async function fetchType(slug) {
    const res = await fetch(`${API_BASE}/api/content-types/${slug}`, { headers: authedHeaders });
    if (!res.ok) { setSelectedType(null); return; }
    const data = await res.json();
    setSelectedType(data);
    setEditSlug(data.slug);
    setEditName(data.name);
    setEditNameSingular(data.nameSingular || data.name);
    setEditNamePlural(data.namePlural || data.name);
    setEditingFields(
      (data.fields || []).map(f => ({
        ...f,
        options: parseOptionsForEdit(f.type, f.options),
      }))
    );
  }

  async function fetchEntries(slug) {
    const res = await fetch(`${API_BASE}/api/content/${slug}`, { headers: authedHeaders });
    if (!res.ok) return setEntries([]);
    const data = await res.json();
    setEntries(data || []);
  }

  async function ensureRelatedLoaded(relatedSlug) {
    if (!relatedSlug || relatedCache[relatedSlug]) return;
    const res = await fetch(`${API_BASE}/api/content/${relatedSlug}`, { headers: authedHeaders });
    if (!res.ok) return;
    const data = await res.json();
    setRelatedCache(prev => ({ ...prev, [relatedSlug]: data || [] }));
  }

  async function ensureChoicesLoaded(sourceType) {
    if (!sourceType || choicesCache[sourceType]) return;
    const res = await fetch(`${API_BASE}/api/content/${sourceType}`, { headers: authedHeaders });
    if (!res.ok) return;
    const data = await res.json();
    setChoicesCache(prev => ({ ...prev, [sourceType]: data || [] }));
  }

  useEffect(() => { fetchTypes(); }, [token]);
  useEffect(() => {
    if (!token || !selectedTypeSlug) return;
    fetchType(selectedTypeSlug);
    fetchEntries(selectedTypeSlug);
  }, [token, selectedTypeSlug]);

  // CREATE TYPE
  function addNewFieldRow() {
    setNewFields(prev => [
      ...prev,
      { key: '', label: '', type: 'text', required: false, sort: prev.length, options: '' },
    ]);
  }
  function changeNewField(i, patch) {
    setNewFields(prev => { const arr = [...prev]; arr[i] = { ...arr[i], ...patch }; return arr; });
  }
  function toggleNewFieldDynamic(i, useDynamic) {
    setNewFields(prev => {
      const arr = [...prev]; const f = { ...arr[i] };
      f.options = useDynamic ? { sourceType: '', sourceField: 'title' } : '';
      arr[i] = f; return arr;
    });
  }

  async function createType() {
    if (!token) { alert('Please login'); return; }
    const normFields = newFields.map(f => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: !!f.required,
      sort: Number.isFinite(f.sort) ? f.sort : 0,
      options: normalizeOptionsForSave(f),
    }));

    const res = await fetch(`${API_BASE}/api/content-types`, {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({
        slug: newSlug,
        name: newName,
        nameSingular: newNameSingular || newName,
        namePlural: newNamePlural || newName,
        fields: normFields
      }),
    });
    if (!res.ok) { alert('Failed to create type'); return; }
    await fetchTypes();
    setSelectedTypeSlug(newSlug);
    setNewSlug('');
    setNewName(''); setNewNameSingular(''); setNewNamePlural('');
    setNewFields([{ key: 'title', label: 'Title', type: 'text', required: true, sort: 0, options: '' }]);
    alert('Type created');
  }

  // EDIT TYPE META
  async function saveTypeMeta() {
    if (!token || !selectedType) { alert('Please login/select type'); return; }
    const res = await fetch(`${API_BASE}/api/content-types/${selectedType.slug}`, {
      method: 'PUT',
      headers: authedHeaders,
      body: JSON.stringify({
        slug: editSlug,
        name: editName,
        nameSingular: editNameSingular || editName,
        namePlural: editNamePlural || editName
      }),
    });
    if (!res.ok) { alert('Failed to update type'); return; }
    await fetchTypes();
    setSelectedTypeSlug(editSlug);
    alert('Type updated');
  }

  // FIELD MANAGEMENT
  function changeEditingField(i, patch) {
    setEditingFields(prev => { const arr = [...prev]; arr[i] = { ...arr[i], ...patch }; return arr; });
  }
  function toggleEditingFieldDynamic(i, useDynamic) {
    setEditingFields(prev => {
      const arr = [...prev]; const f = { ...arr[i] };
      f.options = useDynamic ? { sourceType: '', sourceField: 'title' } : '';
      arr[i] = f; return arr;
    });
  }

  async function addFieldToType() {
    if (!token || !selectedType) { alert('Please login/select type'); return; }
    const newField = { key: '', label: '', type: 'text', required: false, sort: editingFields?.length || 0, options: '' };
    setEditingFields(prev => [...prev, newField]);
  }

  async function persistField(i) {
    if (!token || !selectedType) { alert('Please login/select type'); return; }
    const f = editingFields[i];
    const payload = {
      key: f.key || null,
      label: f.label || null,
      type: f.type || null,
      required: typeof f.required === 'boolean' ? f.required : false,
      sort: Number.isFinite(f.sort) ? f.sort : i,
      options: normalizeOptionsForSave(f),
    };

    if (f.id) {
      const res = await fetch(`${API_BASE}/api/content-types/${selectedType.slug}/fields/${f.id}`, {
        method: 'PUT', headers: authedHeaders, body: JSON.stringify(payload),
      });
      if (!res.ok) { alert('Failed to update field'); return; }
      alert('Field updated');
      if (f.type === 'relationship' && typeof f.options === 'object' && f.options.twoWay && f.options.relatedType) {
        try {
          const invKey = f.options.inverseKey || `${selectedType.slug}_${f.key || 'backref'}`;
          const invPayload = { key: invKey, label: (f.label || f.key || 'Backref') + ' (Backref)', type: 'relationship', required: false, sort: 9999, options: { relatedType: selectedType.slug, multiple: true } };
          await fetch(`${API_BASE}/api/content-types/${f.options.relatedType}/fields`, { method: 'POST', headers: authedHeaders, body: JSON.stringify(invPayload) });
        } catch (err) { console.warn('Two-way relation inverse create failed', err); }
      }
    } else {
      const res = await fetch(`${API_BASE}/api/content-types/${selectedType.slug}/fields`, {
        method: 'POST', headers: authedHeaders, body: JSON.stringify(payload),
      });
      if (!res.ok) { alert('Failed to add field'); return; }
      alert('Field added');
      if (f.type === 'relationship' && typeof f.options === 'object' && f.options.twoWay && f.options.relatedType) {
        try {
          const invKey = f.options.inverseKey || `${selectedType.slug}_${f.key || 'backref'}`;
          const invPayload = { key: invKey, label: (f.label || f.key || 'Backref') + ' (Backref)', type: 'relationship', required: false, sort: 9999, options: { relatedType: selectedType.slug, multiple: true } };
          await fetch(`${API_BASE}/api/content-types/${f.options.relatedType}/fields`, { method: 'POST', headers: authedHeaders, body: JSON.stringify(invPayload) });
        } catch (err) { console.warn('Two-way relation inverse create failed', err); }
      }
    }
    await fetchType(selectedType.slug);
  }

  async function _dbg(res) {
    let txt = '';
    try { txt = await res.text(); } catch {}
    alert(`Delete failed: ${res.status} ${res.statusText}\n${txt}`);
  }

  async function deleteType() {
    if (!selectedType) return;
    const ok = confirm(`Delete content type "${selectedType.name}" (${selectedType.slug}) and ALL its entries?`);
    if (!ok) return;

    let res = await fetch(`${API_BASE}/api/content-types/${selectedType.slug}`, { method:'DELETE', headers: authedHeaders });
    if (res.status === 404 && selectedType.id) {
      res = await fetch(`${API_BASE}/api/content/type/${selectedType.id}`, { method:'DELETE', headers: authedHeaders });
    }
    if (!res.ok) return _dbg(res);

    await fetchTypes();
    setSelectedTypeSlug(''); setSelectedType(null);
    setEditingFields([]); setEntries([]);
    alert('Type deleted');
  }

  async function deleteFieldById(fieldId) {
    if (!selectedType || !fieldId) return;
    const ok = confirm('Delete this field?');
    if (!ok) return;
    const res = await fetch(`${API_BASE}/api/content-types/${selectedType.slug}/fields/${fieldId}`, {
      method: 'DELETE', headers: authedHeaders,
    });
    if (!res.ok) return _dbg(res);
    await fetchType(selectedType.slug);
    alert('Field deleted');
  }

  async function deleteEntryById(entryId) {
    if (!selectedType || !entryId) return;
    const ok = confirm(`Delete entry #${entryId}?`);
    if (!ok) return;
    const res = await fetch(`${API_BASE}/api/content/${selectedType.slug}/${entryId}`, {
      method: 'DELETE', headers: authedHeaders,
    });
    if (!res.ok) return _dbg(res);
    await fetchEntries(selectedType.slug);
    if (editingEntryId === entryId) {
      setEditingEntryId(null); setCreatingNew(false); setEntryData({});
    }
    alert('Entry deleted');
  }

  function removeNewFieldRow(i) {
    setNewFields(prev => prev.filter((_, idx) => idx !== i));
  }
  function removeEditingFieldRow(i) {
    setEditingFields(prev => prev.filter((_, idx) => idx !== i));
  }

  // ENTRIES
  function startNewEntry() {
    setPrevEntryData(null);
    setEditingEntryId(null);
    setEntryData({});
    setCreatingNew(true);

    selectedType?.fields?.forEach(f => {
      if (f.type === 'relationship' && f.options?.relatedType) {
        ensureRelatedLoaded(f.options.relatedType);
      }
      if (
        ['radio', 'dropdown', 'checkbox', 'tags'].includes(f.type) &&
        f.options && typeof f.options === 'object' && f.options.sourceType
      ) {
        ensureChoicesLoaded(f.options.sourceType);
      }
    });
  }

  function editEntry(id) {
    const ent = entries.find(e => String(e.id) === String(id));
    setEditingEntryId(id);
    setCreatingNew(false);
    setEntryData(ent?.data || {});
    setPrevEntryData(ent?.data ? JSON.parse(JSON.stringify(ent.data)) : {});

    selectedType?.fields?.forEach(f => {
      if (f.type === 'relationship' && f.options?.relatedType) {
        ensureRelatedLoaded(f.options.relatedType);
      }
      if (
        ['radio', 'dropdown', 'checkbox', 'tags'].includes(f.type) &&
        f.options && typeof f.options === 'object' && f.options.sourceType
      ) {
        ensureChoicesLoaded(f.options.sourceType);
      }
    });
  }

  async function syncTwoWayRelationships(selfId, before, after) {
    if (!selectedType || !Array.isArray(selectedType.fields)) return;
    const relFields = selectedType.fields.filter(f => f.type === 'relationship' && f.options && f.options.relatedType && f.options.twoWay && (f.options.inverseKey || true));
    for (const f of relFields) {
      const relType = f.options.relatedType;
      const inverseKey = f.options.inverseKey || `${selectedType.slug}_${f.key || 'backref'}`;

      const norm = (v) => {
        if (v === null || v === undefined || v === '') return [];
        if (Array.isArray(v)) return v.map(x => String(x));
        return [String(v)];
      };
      const beforeIds = norm(before?.[f.key]);
      const afterIds  = norm(after?.[f.key]);

      const removed = beforeIds.filter(x => !afterIds.includes(x));
      const added   = afterIds.filter(x => !beforeIds.includes(x));

      async function fetchRelatedEntry(relId) {
        const r = await fetch(`${API_BASE}/api/content/${relType}/${relId}`, { headers: authedHeaders });
        if (!r.ok) return null;
        try { return await r.json(); } catch { return null; }
      }
      async function saveRelatedEntry(relId, dataPatch) {
        return await fetch(`${API_BASE}/api/content/${relType}/${relId}`, {
          method: 'PUT', headers: authedHeaders, body: JSON.stringify({ data: dataPatch }),
        });
      }

      for (const rid of removed) {
        const ent = await fetchRelatedEntry(rid);
        if (!ent) continue;
        const d = ent.data || {};
        const cur = d[inverseKey];
        if (Array.isArray(cur)) {
          d[inverseKey] = cur.map(String).filter(x => x !== String(selfId));
        } else if (String(cur) === String(selfId)) {
          d[inverseKey] = null;
        }
        await saveRelatedEntry(rid, d);
      }
      for (const rid of added) {
        const ent = await fetchRelatedEntry(rid);
        if (!ent) continue;
        const d = ent.data || {};
        const cur = d[inverseKey];
        if (Array.isArray(cur)) {
          const next = cur.map(String);
          if (!next.includes(String(selfId))) next.push(String(selfId));
          d[inverseKey] = next;
        } else if (cur === null || cur === undefined || cur === '') {
          d[inverseKey] = String(selfId);
        } else {
          const arr = [String(cur)];
          if (!arr.includes(String(selfId))) arr.push(String(selfId));
          d[inverseKey] = arr;
        }
        await saveRelatedEntry(rid, d);
      }
    }
  }

  async function saveEntry() {
    if (!token || !selectedType) { alert('Please login/select type'); return; }
    const method = editingEntryId ? 'PUT' : 'POST';
    const url = editingEntryId
      ? `${API_BASE}/api/content/${selectedType.slug}/${editingEntryId}`
      : `${API_BASE}/api/content/${selectedType.slug}`;

    const res = await fetch(url, {
      method, headers: authedHeaders, body: JSON.stringify({ data: entryData }),
    });
    if (!res.ok) { alert('Failed to save entry'); return; }
    let saved = null;
    try { saved = await res.json(); } catch {}
    const selfId = editingEntryId || (saved && saved.id);
    if (selfId) {
      try { await syncTwoWayRelationships(selfId, prevEntryData || {}, entryData || {}); } catch (e) { console.warn('Two-way sync failed', e); }
    }
    await fetchEntries(selectedType.slug);
    setEditingEntryId(null); setCreatingNew(false); setEntryData({});
    alert('Entry saved');
  }

  // RENDER
  if (!token) {
    return (
      <div style={{ padding: 20, maxWidth: 700 }}>
        <h2>Login</h2>
        <input placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
        <br />
        <input placeholder="Password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
        <br />
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 24, gridTemplateColumns: '1fr 1fr' }}>
      {/* Left: Types & Meta */}
      <div>
        <h2>Content Types</h2>

        <div style={{ marginBottom: 16 }}>
          <label>Choose Type: </label>
          <select value={selectedTypeSlug} onChange={e => setSelectedTypeSlug(e.target.value)}>
            <option value="">—</option>
            {types.map(t => (
              <option key={t.slug} value={t.slug}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </div>
        {selectedType && (
          <div style={{ marginTop: 8 }}>
            <button onClick={deleteType} style={{ color: '#b00' }}>Delete Type</button>
          </div>
        )}

        <h3>Create New Type</h3>
        <div style={{ border: '1px solid #ddd', padding: 12, marginBottom: 24 }}>
          <div>
            <label>Slug: </label>
            <input value={newSlug} onChange={e => setNewSlug(e.target.value)} />
          </div>
          <div>
            <label>Name: </label>
            <input value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
          {/* NEW: singular/plural */}
          <div>
            <label>Singular Label: </label>
            <input value={newNameSingular} onChange={e => setNewNameSingular(e.target.value)} />
          </div>
          <div>
            <label>Plural Label: </label>
            <input value={newNamePlural} onChange={e => setNewNamePlural(e.target.value)} />
          </div>

          <h4>Fields</h4>
          {newFields.map((f, i) => (
            <div key={i} style={{ border: '1px dashed #bbb', padding: 8, margin: '8px 0' }}>
              <div>
                <label>Key: </label>
                <input value={f.key} onChange={e => changeNewField(i, { key: e.target.value })} />
              </div>
              <div>
                <label>Label: </label>
                <input value={f.label} onChange={e => changeNewField(i, { label: e.target.value })} />
              </div>
              <div>
                <label>Type: </label>
                <select
                  value={f.type}
                  onChange={e => changeNewField(i, { type: e.target.value })}
                >
                  {[...new Set([...BASE_FIELD_TYPES, f.type].filter(Boolean))].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Required: </label>
                <input
                  type="checkbox"
                  checked={!!f.required}
                  onChange={e => changeNewField(i, { required: !!e.target.checked })}
                />
              </div>
              <div>
                <label>Sort: </label>
                <input type="number" value={f.sort ?? 0} onChange={e => changeNewField(i, { sort: Number(e.target.value) })} />
              </div>

              {/* Options mode */}
              <div>
                <label>Options Mode: </label>
                {['radio', 'dropdown', 'checkbox', 'tags'].includes(f.type) && (
                  <label style={{ marginLeft: 8 }}>
                    <input
                      type="checkbox"
                      checked={typeof f.options === 'object' && !!f.options.sourceType}
                      onChange={e => toggleNewFieldDynamic(i, !!e.target.checked)}
                    />{' '}
                    Use dynamic options (from content type)
                  </label>
                )}
              </div>

              {/* Options editor */}
              <div>
                <label>Options: </label>
                {f.type === 'relationship' ? (
                  <>
                    <input
                      placeholder="related content type slug"
                      value={typeof f.options === 'object' ? f.options.relatedType || '' : f.options || ''}
                      onChange={e => {
                        const v = e.target.value;
                        changeNewField(i, { options: { relatedType: v, multiple: false } });
                      }}
                    />
                    <label style={{ marginLeft: 8 }}>
                      <input
                        type="checkbox"
                        checked={typeof f.options === 'object' ? !!f.options.multiple : false}
                        onChange={e => {
                          const v = typeof f.options === 'object' ? f.options.relatedType : f.options || '';
                          changeNewField(i, { options: { relatedType: v, multiple: !!e.target.checked } });
                        }}
                      />{' '}
                      Multiple
                    </label>
                    <label style={{ marginLeft: 12 }}>
                      <input
                        type="checkbox"
                        checked={typeof f.options === 'object' ? !!f.options.twoWay : false}
                        onChange={e => {
                          const rel = typeof f.options === 'object' ? f.options.relatedType || '' : f.options || '';
                          const inv = typeof f.options === 'object' ? (f.options.inverseKey || '') : '';
                          changeNewField(i, { options: { ...(typeof f.options==='object'?f.options:{}), relatedType: rel, multiple: !!(typeof f.options==='object' && f.options.multiple), twoWay: !!e.target.checked, inverseKey: inv } });
                        }}
                      />{' '}
                      Two-way (create inverse)
                    </label>
                    <input
                      placeholder="Inverse field key (on related type)"
                      style={{ marginLeft: 8 }}
                      value={typeof f.options==='object' ? (f.options.inverseKey || '') : ''}
                      onChange={e => {
                        const rel = typeof f.options === 'object' ? f.options.relatedType || '' : f.options || '';
                        changeNewField(i, { options: { ...(typeof f.options==='object'?f.options:{}), relatedType: rel, multiple: !!(typeof f.options==='object' && f.options.multiple), twoWay: !!(typeof f.options==='object' && f.options.twoWay), inverseKey: e.target.value } });
                      }}
                    />
                  </>
                ) : 
(f.type === 'relation_user') ? (
  <>
    <label style={{ marginLeft: 8 }}>
      <input
        type="checkbox"
        checked={typeof f.options === 'object' ? (f.options.selection === 'multiple') : false}
        onChange={e => {
          const sel = e.target.checked ? 'multiple' : 'single';
          changeEditingField(i, { options: { selection: sel } });
        }}
      /> Multiple selection
    </label>
  </>
) : (f.type === 'taxonomy') ? (
  <>
    <input
      placeholder="taxonomy key (e.g., category, tag)"
      value={typeof f.options === 'object' ? (f.options.taxonomyKey || '') : (typeof f.options==='string'?f.options:'')}
      onChange={e => {
        const key = e.target.value;
        const sel = (typeof f.options === 'object' && f.options.selection) || 'multiple';
        changeEditingField(i, { options: { taxonomyKey: key, selection: sel } });
      }}
    />
    <label style={{ marginLeft: 8 }}>
      <input
        type="checkbox"
        checked={typeof f.options === 'object' ? (f.options.selection === 'single') : false}
        onChange={e => {
          const key = (typeof f.options === 'object' && f.options.taxonomyKey) || (typeof f.options==='string'?f.options:'tag');
          changeEditingField(i, { options: { taxonomyKey: key, selection: e.target.checked ? 'single' : 'multiple' } });
        }}
      /> Single only
    </label>
  </>
) : 
['radio', 'dropdown', 'checkbox', 'tags'].includes(f.type) &&
                  typeof f.options === 'object' &&
                  f.options.sourceType ? (
                  <>
                    <input
                      placeholder="source content type slug (e.g., categories)"
                      value={f.options.sourceType || ''}
                      onChange={e => changeNewField(i, { options: { ...f.options, sourceType: e.target.value } })}
                    />
                    <input
                      style={{ marginLeft: 8 }}
                      placeholder="source field (default: title)"
                      value={f.options.sourceField || 'title'}
                      onChange={e =>
                        changeNewField(i, { options: { ...f.options, sourceField: e.target.value || 'title' } })
                      }
                    />
                  </>
                ) : (
                  <input
                    placeholder={['radio', 'dropdown', 'checkbox', 'tags'].includes(f.type) ? 'comma,separated,choices' : 'n/a'}
                    value={typeof f.options === 'string' ? f.options : ''}
                    onChange={e => changeNewField(i, { options: e.target.value })}
                    disabled={!['radio', 'dropdown', 'checkbox', 'relationship', 'tags'].includes(f.type)}
                  />
                )}

                {/* NEW: Simple/Advanced for choices */}
                {['radio','dropdown','checkbox'].includes(f.type) && (
                  <div style={{marginTop:6}}>
                    <details>
                      <summary>Simple options (value|label)</summary>
                      <small>One per line, e.g. <code>kpop|K-Pop</code>. Label defaults to value.</small>
                      <textarea
                        rows={4}
                        placeholder={"value|label\nvalue2|Label 2"}
                        value={
                          Array.isArray(f.options)
                            ? f.options.map(o =>
                                typeof o === 'string'
                                  ? o
                                  : (o?.value ? `${o.value}|${o.label ?? o.value}` : '')
                              ).filter(Boolean).join('\n')
                            : (typeof f.options === 'string' ? f.options : '')
                        }
                        onChange={e=>{
                          const lines = e.target.value.split('\n').map(s=>s.trim()).filter(Boolean);
                          const arr = lines.map(line=>{
                            const [val, lab] = line.split('|');
                            const v = (val||'').trim();
                            const l = (lab||val||'').trim();
                            return v ? { value:v, label:l||v } : null;
                          }).filter(Boolean);
                          changeNewField(i, { options: arr });
                        }}
                      />
                    </details>
                  </div>
                )}

                {/* NEW: Simple upload limits */}
                {['image','file','video'].includes(f.type) && (
                  <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:6}}>
                    <input
                      placeholder="Accept MIME(s) e.g. image/*,application/pdf"
                      value={typeof f.options==='object' ? (f.options.accept||'') : ''}
                      onChange={e=> changeNewField(i, { options: { ...(typeof f.options==='object'?f.options:{}), accept: e.target.value } })}
                    />
                    <input
                      type="number"
                      placeholder="Max size (MB)"
                      value={typeof f.options==='object' ? (f.options.maxSizeMB||'') : ''}
                      onChange={e=> changeNewField(i, { options: { ...(typeof f.options==='object'?f.options:{}), maxSizeMB: e.target.value ? Number(e.target.value) : undefined } })}
                      style={{width:140}}
                    />
                  </div>
                )}

                {/* NEW: Advanced upload policy (JSON) */}
                {['image','file','video'].includes(f.type) && (
                  <div style={{marginTop:6}}>
                    <details>
                      <summary>Advanced upload policy (JSON)</summary>
                      <small>{`Example: { "rules":[{"accept":"image/*","maxSizeMB":10}] }`}</small>
                      <textarea
                        rows={4}
                        placeholder='{"rules":[{"accept":"image/*","maxSizeMB":10}]}'
                        value={typeof f.options==='object' && f.options.rules ? JSON.stringify({rules:f.options.rules}, null, 2) : ''}
                        onChange={e=>{
                          try {
                            const obj = JSON.parse(e.target.value||'{}');
                            const rules = Array.isArray(obj.rules) ? obj.rules : undefined;
                            changeNewField(i, { options: { ...(typeof f.options==='object'?f.options:{}), rules } });
                          } catch {}
                        }}
                      />
                    </details>
                  </div>
                )}

              </div>

              {supportsSubfields(f.type) && (
                <SubfieldControls
                  type={f.type}
                  options={typeof f.options === 'object' ? f.options : {}}
                  onChange={(opts) => changeNewField(i, { options: opts })}
                />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addNewFieldRow}>+ Add Field Row</button>
            <button onClick={createType}>Create Type</button>
          </div>
        </div>

        {selectedType && (
          <>
            <h3>
              Edit Type: {selectedType.name} ({selectedType.slug})
            </h3>
            <div style={{ border: '1px solid #ddd', padding: 12 }}>
              <div>
                <label>Slug: </label>
                <input value={editSlug} onChange={e => setEditSlug(e.target.value)} />
              </div>
              <div>
                <label>Name: </label>
                <input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              {/* NEW: singular/plural */}
              <div>
                <label>Singular Label: </label>
                <input value={editNameSingular} onChange={e => setEditNameSingular(e.target.value)} />
              </div>
              <div>
                <label>Plural Label: </label>
                <input value={editNamePlural} onChange={e => setEditNamePlural(e.target.value)} />
              </div>

              <div style={{marginTop:8}}>
                <label>Identifier field:&nbsp;</label>
                <select
                  value={getIdentifierKeyForType(selectedType.slug)}
                  onChange={e => setIdentifierKeyForType(selectedType.slug, e.target.value)}
                >
                  {selectedType.fields?.map(ff => (
                    <option key={ff.key} value={ff.key}>{ff.label || ff.key}</option>
                  ))}
                </select>
                <label style={{marginLeft:12}}>
                  <input
                    type="checkbox"
                    checked={getSlugEnabled(selectedType.slug)}
                    onChange={e => setSlugEnabled(selectedType.slug, e.target.checked)}
                  /> Enable slugs for entries
                </label>
              </div>
              <button onClick={saveTypeMeta}>Save Type</button>
              {selectedType && (
                <button onClick={deleteType} style={{ marginLeft: 8, color: '#b00' }}>Delete Type</button>
              )}

              <h4 style={{ marginTop: 16 }}>Fields</h4>
              <button onClick={addFieldToType}>+ Add Field</button>

              {(editingFields || []).map((f, i) => (
                <div key={f.id ?? `new-${i}`} style={{ border: '1px dashed #bbb', padding: 8, margin: '8px 0' }}>
                  <div>
                    <label>Key: </label>
                    <input value={f.key || ''} onChange={e => changeEditingField(i, { key: e.target.value })} />
                  </div>
                  <div>
                    <label>Label: </label>
                    <input value={f.label || ''} onChange={e => changeEditingField(i, { label: e.target.value })} />
                  </div>
                  <div>
                    <label>Type: </label>
                    <select
                      value={f.type || 'text'}
                      onChange={e => changeEditingField(i, { type: e.target.value })}
                    >
                      {[...new Set([...BASE_FIELD_TYPES, f.type].filter(Boolean))].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label>Required: </label>
                    <input
                      type="checkbox"
                      checked={!!f.required}
                      onChange={e => changeEditingField(i, { required: !!e.target.checked })}
                    />
                  </div>
                  <div>
                    <label>Sort: </label>
                    <input
                      type="number"
                      value={Number.isFinite(f.sort) ? f.sort : i}
                      onChange={e => changeEditingField(i, { sort: Number(e.target.value) })}
                    />
                  </div>

                  {['radio', 'dropdown', 'checkbox', 'tags'].includes(f.type) && (
                    <div>
                      <label>Options Mode: </label>
                      <label style={{ marginLeft: 8 }}>
                        <input
                          type="checkbox"
                          checked={typeof f.options === 'object' && !!f.options.sourceType}
                          onChange={e => toggleEditingFieldDynamic(i, !!e.target.checked)}
                        />{' '}
                        Use dynamic options (from content type)
                      </label>
                    </div>
                  )}

                  <div>
                    <label>Options: </label>
                    {f.type === 'relationship' ? (
                      <>
                        <input
                          placeholder="related content type slug"
                          value={typeof f.options === 'object' ? f.options.relatedType || '' : f.options || ''}
                          onChange={e => {
                            const v = e.target.value;
                            changeEditingField(i, {
                              options: { relatedType: v, multiple: !!(typeof f.options === 'object' && f.options.multiple), twoWay: !!(typeof f.options === 'object' && f.options.twoWay), inverseKey: (typeof f.options === 'object' && f.options.inverseKey) || '' },
                            });
                          }}
                        />
                        <label style={{ marginLeft: 8 }}>
                          <input
                            type="checkbox"
                            checked={typeof f.options === 'object' ? !!f.options.multiple : false}
                            onChange={e => {
                              const rel = typeof f.options === 'object' ? f.options.relatedType || '' : f.options || '';
                              changeEditingField(i, { options: { relatedType: rel, multiple: !!e.target.checked, twoWay: !!(typeof f.options === 'object' && f.options.twoWay), inverseKey: (typeof f.options === 'object' && f.options.inverseKey) || '' } });
                            }}
                          />{' '}
                          Multiple
                        </label>
                        <label style={{ marginLeft: 12 }}>
                          <input
                            type="checkbox"
                            checked={typeof f.options === 'object' ? !!f.options.twoWay : false}
                            onChange={e => {
                              const rel = typeof f.options === 'object' ? f.options.relatedType || '' : f.options || '';
                              const inv = typeof f.options === 'object' ? (f.options.inverseKey || '') : '';
                              changeEditingField(i, { options: { ...(typeof f.options==='object'?f.options:{}), relatedType: rel, multiple: !!(typeof f.options==='object' && f.options.multiple), twoWay: !!e.target.checked, inverseKey: inv } });
                            }}
                          />{' '}
                          Two-way (create inverse)
                        </label>
                        <input
                          placeholder="Inverse field key (on related type)"
                          style={{ marginLeft: 8 }}
                          value={typeof f.options==='object' ? (f.options.inverseKey || '') : ''}
                          onChange={e => {
                            const rel = typeof f.options === 'object' ? f.options.relatedType || '' : f.options || '';
                            changeEditingField(i, { options: { ...(typeof f.options==='object'?f.options:{}), relatedType: rel, multiple: !!(typeof f.options==='object' && f.options.multiple), twoWay: !!(typeof f.options==='object' && f.options.twoWay), inverseKey: e.target.value } });
                          }}
                        />
                      </>
                    ) : ['radio', 'dropdown', 'checkbox', 'tags'].includes(f.type) &&
                      typeof f.options === 'object' &&
                      f.options.sourceType ? (
                      <>
                        <input
                          placeholder="source content type slug (e.g., categories)"
                          value={f.options.sourceType || ''}
                          onChange={e => changeEditingField(i, { options: { ...f.options, sourceType: e.target.value } })}
                        />
                        <input
                          style={{ marginLeft: 8 }}
                          placeholder="source field (default: title)"
                          value={f.options.sourceField || 'title'}
                          onChange={e =>
                            changeEditingField(i, { options: { ...f.options, sourceField: e.target.value || 'title' } })
                          }
                        />
                      </>
                    ) : (
                      <input
                        placeholder={['radio', 'dropdown', 'checkbox', 'tags'].includes(f.type) ? 'comma,separated,choices' : 'n/a'}
                        value={
                          typeof f.options === 'string'
                            ? f.options
                            : Array.isArray(f.options)
                            ? f.options.join(', ')
                            : ''
                        }
                        onChange={e => changeEditingField(i, { options: e.target.value })}
                        disabled={!['radio', 'dropdown', 'checkbox', 'relationship', 'tags'].includes(f.type)}
                      />
                    )}

                    {/* NEW: Simple/Advanced for choices */}
                    {['radio','dropdown','checkbox'].includes(f.type) && (
                      <div style={{marginTop:6}}>
                        <details>
                          <summary>Simple options (value|label)</summary>
                          <small>One per line, e.g. <code>kpop|K-Pop</code>. Label defaults to value.</small>
                          <textarea
                            rows={4}
                            placeholder={"value|label\nvalue2|Label 2"}
                            value={
                              Array.isArray(f.options)
                                ? f.options.map(o =>
                                    typeof o === 'string'
                                      ? o
                                      : (o?.value ? `${o.value}|${o.label ?? o.value}` : '')
                                  ).filter(Boolean).join('\n')
                                : (typeof f.options === 'string' ? f.options : '')
                            }
                            onChange={e=>{
                              const lines = e.target.value.split('\n').map(s=>s.trim()).filter(Boolean);
                              const arr = lines.map(line=>{
                                const [val, lab] = line.split('|');
                                const v = (val||'').trim();
                                const l = (lab||val||'').trim();
                                return v ? { value:v, label:l||v } : null;
                              }).filter(Boolean);
                              changeEditingField(i, { options: arr });
                            }}
                          />
                        </details>
                      </div>
                    )}

                    {/* NEW: Simple upload limits */}
                    {['image','file','video'].includes(f.type) && (
                      <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:6}}>
                        <input
                          placeholder="Accept MIME(s) e.g. image/*,application/pdf"
                          value={typeof f.options==='object' ? (f.options.accept||'') : ''}
                          onChange={e=> changeEditingField(i, { options: { ...(typeof f.options==='object'?f.options:{}), accept: e.target.value } })}
                        />
                        <input
                          type="number"
                          placeholder="Max size (MB)"
                          value={typeof f.options==='object' ? (f.options.maxSizeMB||'') : ''}
                          onChange={e=> changeEditingField(i, { options: { ...(typeof f.options==='object'?f.options:{}), maxSizeMB: e.target.value ? Number(e.target.value) : undefined } })}
                          style={{width:140}}
                        />
                      </div>
                    )}

                    {/* NEW: Advanced upload policy (JSON) */}
                    {['image','file','video'].includes(f.type) && (
                      <div style={{marginTop:6}}>
                        <details>
                          <summary>Advanced upload policy (JSON)</summary>
                          <small>{`Example: { "rules":[{"accept":"image/*","maxSizeMB":10}] }`}</small>
                          <textarea
                            rows={4}
                            placeholder='{"rules":[{"accept":"image/*","maxSizeMB":10}]}'
                            value={typeof f.options==='object' && f.options.rules ? JSON.stringify({rules:f.options.rules}, null, 2) : ''}
                            onChange={e=>{
                              try {
                                const obj = JSON.parse(e.target.value||'{}');
                                const rules = Array.isArray(obj.rules) ? obj.rules : undefined;
                                changeEditingField(i, { options: { ...(typeof f.options==='object'?f.options:{}), rules } });
                              } catch {}
                            }}
                          />
                        </details>
                      </div>
                    )}

                  </div>

                  {supportsSubfields(f.type) && (
                    <SubfieldControls
                      type={f.type}
                      options={typeof f.options === 'object' ? f.options : {}}
                      onChange={(opts) => changeEditingField(i, { options: opts })}
                    />
                  )}

                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button onClick={() => persistField(i)}>{f.id ? 'Save Field' : 'Add Field'}</button>
                    {f.id ? (
                      <button type="button" onClick={() => deleteFieldById(f.id)} style={{ color: '#b00' }}>
                        Delete Field
                      </button>
                    ) : (
                      <button type="button" onClick={() => removeEditingFieldRow(i)} style={{ color: '#b00' }}>
                        Remove Row
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right: Entries */}
      <div>
        <h2>Entries {selectedType ? `— ${selectedType.namePlural || selectedType.name}` : ''}</h2>
        {selectedType && (
          <>
            <div style={{ marginBottom: 8 }}>
              <button onClick={startNewEntry}>+ {`New ${selectedType?.nameSingular || 'Entry'}`}</button>
            </div>

            {(creatingNew || editingEntryId !== null) && (
              <div style={{ border: '1px solid #ddd', padding: 12, marginBottom: 16 }}>
                <h4>{editingEntryId ? `Edit ${selectedType?.nameSingular || 'Entry'} #${editingEntryId}` : `New ${selectedType?.nameSingular || 'Entry'}`}</h4>
                {getSlugEnabled(selectedType.slug) && (
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', fontWeight: 600 }}>Slug</label>
                    <input
                      type="text"
                      value={entryData.slug || ''}
                      onChange={e => setEntryData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="auto-generated from identifier…"
                      style={{ width: '100%' }}
                    />
                    <button type="button" onClick={() => {
                      const idKey = getIdentifierKeyForType(selectedType.slug);
                      const base = (entryData[idKey] || '').toString();
                      setEntryData(prev => ({ ...prev, slug: slugify(base) }));
                    }} style={{ marginTop: 6 }}>Generate from identifier</button>
                  </div>
                )}
                
                {(selectedType.fields || []).map(f => (
                  <div key={f.id} style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', fontWeight: 600 }}>
                      {f.label} ({f.key})
                    </label>
                    <FieldInput
                      field={f}
                      value={entryData[f.key]}
                      onChange={v => setEntryField(f.key, v)}
                      relatedCache={relatedCache}
                      choicesCache={choicesCache}
                      entryContext={{ typeSlug: selectedType.slug, entryId: editingEntryId || 'new' }}
                    />
                  </div>
                ))}
                <button onClick={saveEntry}>Save Entry</button>
                <button type="button" onClick={() => { setEditingEntryId(null); setCreatingNew(false); setEntryData({}); }} style={{ marginLeft: 8 }}>Cancel</button>
              </div>
            )}

            <ul style={{ paddingLeft: 18 }}>
              {entries.map(ent => {
                const idKey = selectedType ? getIdentifierKeyForType(selectedType.slug) : 'title';
                const identifier = ent.data?.[idKey] ?? ent.data?.title ?? '';
                const slug = ent.data?.slug ?? '';
                return (
                  <li key={ent.id}>
                    <button onClick={() => editEntry(ent.id)}>Edit</button>{' '}
                    <button onClick={() => deleteEntryById(ent.id)} style={{ color: '#b00', marginLeft: 6 }}>Delete</button>{' '}
                    <strong>#{ent.id}</strong> — {identifier ? String(identifier) : '(no identifier)'} {slug ? `— ${slug}` : ''}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
