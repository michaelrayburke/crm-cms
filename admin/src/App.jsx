import { useEffect, useMemo, useState } from 'react';

// === CONFIG ===
const API_BASE = import.meta.env.VITE_API_BASE || 'https://serviceup-api.onrender.com';

function normalizeOptionsForSave(field) {
  if (['radio','dropdown','checkbox'].includes(field.type)) {
    if (!field.options) return [];
    if (Array.isArray(field.options)) return field.options;
    return String(field.options).split(',').map(s => s.trim()).filter(Boolean);
  }
  if (field.type === 'relationship') {
    if (!field.options) return null;
    if (typeof field.options === 'object' && field.options.relatedType) return field.options;
    return { relatedType: String(field.options).trim(), multiple: false };
  }
  return null;
}

function parseOptionsForEdit(type, options) {
  if (['radio','dropdown','checkbox'].includes(type)) {
    if (Array.isArray(options)) return options.join(', ');
    return Array.isArray(options) ? options : '';
  }
  if (type === 'relationship') {
    return options || { relatedType: '', multiple: false };
  }
  return '';
}

function FieldInput({ field, value, onChange, relatedCache }) {
  if (['radio','dropdown'].includes(field.type)) {
    const choices = Array.isArray(field.options) ? field.options : [];
    return (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="" disabled>Select…</option>
        {choices.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }
  if (field.type === 'checkbox') {
    const choices = Array.isArray(field.options) ? field.options : [];
    const current = Array.isArray(value) ? value : [];
    return (
      <div>
        {choices.map(opt => {
          const checked = current.includes(opt);
          return (
            <label key={opt} style={{display:'block'}}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = checked
                    ? current.filter(v => v !== opt)
                    : [...current, opt];
                  onChange(next);
                }}
              />
              {opt}
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
    const list = (rel && relatedCache?.[rel]) || [];
    return (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="" disabled>Select related…</option>
        {list.map(ent => {
          const label = ent.data?.title || ent.id;
          return <option key={ent.id} value={String(ent.id)}>{label}</option>;
        })}
      </select>
    );
  }
  if (field.type === 'textarea') {
    return <textarea value={value ?? ''} onChange={e => onChange(e.target.value)} />;
  }
  if (field.type === 'number') {
    return <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
  }
  if (field.type === 'date') {
    return <input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)} />;
  }
  if (field.type === 'json') {
    return (
      <textarea
        value={value ? JSON.stringify(value, null, 2) : ''}
        onChange={e => {
          try { onChange(JSON.parse(e.target.value || 'null')); }
          catch { onChange(e.target.value); }
        }}
        placeholder="Enter JSON"
      />
    );
  }
  return <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} />;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const authedHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }),
    [token]
  );

  // auth
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  async function login() {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: loginEmail, password: loginPassword })
    });
    if (!res.ok) { alert('Login failed'); return; }
    const data = await res.json();
    setToken(data.token);
    localStorage.setItem('token', data.token);
  }

  // content types list
  const [types, setTypes] = useState([]);
  const [selectedTypeSlug, setSelectedTypeSlug] = useState('');
  const [selectedType, setSelectedType] = useState(null);

  // create new type form
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [newFields, setNewFields] = useState([
    { key: 'title', label: 'Title', type: 'text', required: true, sort: 0, options: '' }
  ]);

  // edit selected type
  const [editSlug, setEditSlug] = useState('');
  const [editName, setEditName] = useState('');
  const [editingFields, setEditingFields] = useState([]);

  // entries
  const [entries, setEntries] = useState([]);
  const [entryData, setEntryData] = useState({});
  const [editingEntryId, setEditingEntryId] = useState(null);

  // related cache for relationship inputs
  const [relatedCache, setRelatedCache] = useState({});

  async function fetchTypes() {
    const res = await fetch(`${API_BASE}/api/content-types`);
    const data = await res.json();
    setTypes(data || []);
  }

  async function fetchType(slug) {
    const res = await fetch(`${API_BASE}/api/content-types/${slug}`);
    if (!res.ok) { setSelectedType(null); return; }
    const data = await res.json();
    setSelectedType(data);
    setEditSlug(data.slug);
    setEditName(data.name);
    setEditingFields(
      (data.fields || []).map(f => ({
        ...f,
        options: parseOptionsForEdit(f.type, f.options),
      }))
    );
  }

  async function fetchEntries(slug) {
    const res = await fetch(`${API_BASE}/api/content/${slug}`);
    const data = await res.json();
    setEntries(data || []);
  }

  async function ensureRelatedLoaded(relatedSlug) {
    if (!relatedSlug || relatedCache[relatedSlug]) return;
    const res = await fetch(`${API_BASE}/api/content/${relatedSlug}`);
    const data = await res.json();
    setRelatedCache(prev => ({ ...prev, [relatedSlug]: data || [] }));
  }

  useEffect(() => { fetchTypes(); }, []);

  useEffect(() => {
    if (!selectedTypeSlug) return;
    fetchType(selectedTypeSlug);
    fetchEntries(selectedTypeSlug);
  }, [selectedTypeSlug]);

  // ---------- CREATE TYPE ----------

  function addNewFieldRow() {
    setNewFields(prev => ([
      ...prev,
      { key: '', label: '', type: 'text', required: false, sort: prev.length, options: '' }
    ]));
  }

  function changeNewField(i, patch) {
    setNewFields(prev => {
      const arr = [...prev];
      arr[i] = { ...arr[i], ...patch };
      return arr;
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
      options: normalizeOptionsForSave(f)
    }));

    const res = await fetch(`${API_BASE}/api/content-types`, {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({ slug: newSlug, name: newName, fields: normFields })
    });
    if (!res.ok) { alert('Failed to create type'); return; }
    await fetchTypes();
    setSelectedTypeSlug(newSlug);
    setNewSlug('');
    setNewName('');
    setNewFields([{ key: 'title', label: 'Title', type: 'text', required: true, sort: 0, options: '' }]);
    alert('Type created');
  }

  // ---------- EDIT TYPE (slug/name) ----------

  async function saveTypeMeta() {
    if (!token || !selectedType) { alert('Please login/select type'); return; }
    const res = await fetch(`${API_BASE}/api/content-types/${selectedType.slug}`, {
      method: 'PUT',
      headers: authedHeaders,
      body: JSON.stringify({ slug: editSlug, name: editName })
    });
    if (!res.ok) { alert('Failed to update type'); return; }
    await fetchTypes();
    setSelectedTypeSlug(editSlug);
    alert('Type updated');
  }

  // ---------- FIELD MANAGEMENT ----------

  function changeEditingField(i, patch) {
    setEditingFields(prev => {
      const arr = [...prev];
      arr[i] = { ...arr[i], ...patch };
      return arr;
    });
  }

  async function addFieldToType() {
    if (!token || !selectedType) { alert('Please login/select type'); return; }
    const newField = { key: '', label: '', type: 'text', required: false, sort: (editingFields?.length || 0), options: '' };
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
      options: normalizeOptionsForSave(f)
    };

    if (f.id) {
      const res = await fetch(`${API_BASE}/api/content-types/${selectedType.slug}/fields/${f.id}`, {
        method: 'PUT',
        headers: authedHeaders,
        body: JSON.stringify(payload)
      });
      if (!res.ok) { alert('Failed to update field'); return; }
      alert('Field updated');
    } else {
      const res = await fetch(`${API_BASE}/api/content-types/${selectedType.slug}/fields`, {
        method: 'POST',
        headers: authedHeaders,
        body: JSON.stringify(payload)
      });
      if (!res.ok) { alert('Failed to add field'); return; }
      alert('Field added');
    }

    await fetchType(selectedType.slug);
  }

  // ---------- ENTRIES ----------

  function startNewEntry() {
    setEditingEntryId(null);
    setEntryData({});
    selectedType?.fields?.forEach(f => {
      if (f.type === 'relationship' && f.options?.relatedType) {
        ensureRelatedLoaded(f.options.relatedType);
      }
    });
  }

  function editEntry(id) {
    const ent = entries.find(e => String(e.id) === String(id));
    setEditingEntryId(id);
    setEntryData(ent?.data || {});
    selectedType?.fields?.forEach(f => {
      if (f.type === 'relationship' && f.options?.relatedType) {
        ensureRelatedLoaded(f.options.relatedType);
      }
    });
  }

  async function saveEntry() {
    if (!token || !selectedType) { alert('Please login/select type'); return; }
    const method = editingEntryId ? 'PUT' : 'POST';
    const url = editingEntryId
      ? `${API_BASE}/api/content/${selectedType.slug}/${editingEntryId}`
      : `${API_BASE}/api/content/${selectedType.slug}`;

    const res = await fetch(url, {
      method,
      headers: authedHeaders,
      body: JSON.stringify({ data: entryData })
    });
    if (!res.ok) { alert('Failed to save entry'); return; }
    await fetchEntries(selectedType.slug);
    setEditingEntryId(null);
    setEntryData({});
    alert('Entry saved');
  }

  // ---------- RENDER ----------

  if (!token) {
    return (
      <div style={{padding:20, maxWidth: 700}}>
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
    <div style={{padding:20, display:'grid', gap:24, gridTemplateColumns:'1fr 1fr'}}>
      {/* Left: Types & Meta */}
      <div>
        <h2>Content Types</h2>

        <div style={{marginBottom:16}}>
          <label>Choose Type: </label>
          <select value={selectedTypeSlug} onChange={e => setSelectedTypeSlug(e.target.value)}>
            <option value="">—</option>
            {types.map(t => <option key={t.slug} value={t.slug}>{t.name} ({t.slug})</option>)}
          </select>
        </div>

        <h3>Create New Type</h3>
        <div style={{border:'1px solid #ddd', padding:12, marginBottom:24}}>
          <div>
            <label>Slug: </label>
            <input value={newSlug} onChange={e => setNewSlug(e.target.value)} />
          </div>
          <div>
            <label>Name: </label>
            <input value={newName} onChange={e => setNewName(e.target.value)} />
          </div>

          <h4>Fields</h4>
          {newFields.map((f, i) => (
            <div key={i} style={{border:'1px dashed #bbb', padding:8, margin:'8px 0'}}>
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
                <select value={f.type} onChange={e => changeNewField(i, { type: e.target.value })}>
                  <option value="text">text</option>
                  <option value="textarea">textarea</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="date">date</option>
                  <option value="json">json</option>
                  <option value="radio">radio</option>
                  <option value="dropdown">dropdown</option>
                  <option value="checkbox">checkbox</option>
                  <option value="relationship">relationship</option>
                </select>
              </div>
              <div>
                <label>Required: </label>
                <input type="checkbox" checked={!!f.required} onChange={e => changeNewField(i, { required: !!e.target.checked })} />
              </div>
              <div>
                <label>Sort: </label>
                <input type="number" value={f.sort ?? 0} onChange={e => changeNewField(i, { sort: Number(e.target.value) })} />
              </div>
              <div>
                <label>Options: </label>
                {f.type === 'relationship' ? (
                  <>
                    <input
                      placeholder="related content type slug"
                      value={typeof f.options === 'object' ? (f.options.relatedType || '') : (f.options || '')}
                      onChange={e => {
                        const v = e.target.value;
                        changeNewField(i, { options: { relatedType: v, multiple: false } });
                      }}
                    />
                    <label style={{marginLeft:8}}>
                      <input
                        type="checkbox"
                        checked={typeof f.options === 'object' ? !!f.options.multiple : false}
                        onChange={e => {
                          const v = (typeof f.options === 'object' ? f.options.relatedType : (f.options || ''));
                          changeNewField(i, { options: { relatedType: v, multiple: !!e.target.checked } });
                        }}
                      /> Multiple
                    </label>
                  </>
                ) : (
                  <input
                    placeholder={['radio','dropdown','checkbox'].includes(f.type) ? 'comma,separated,choices' : 'n/a'}
                    value={typeof f.options === 'string' ? f.options : ''}
                    onChange={e => changeNewField(i, { options: e.target.value })}
                    disabled={!['radio','dropdown','checkbox','relationship'].includes(f.type)}
                  />
                )}
              </div>
            </div>
          ))}
          <div style={{display:'flex', gap:8}}>
            <button onClick={addNewFieldRow}>+ Add Field Row</button>
            <button onClick={createType}>Create Type</button>
          </div>
        </div>

        {selectedType && (
          <>
            <h3>Edit Type: {selectedType.name} ({selectedType.slug})</h3>
            <div style={{border:'1px solid #ddd', padding:12}}>
              <div>
                <label>Slug: </label>
                <input value={editSlug} onChange={e => setEditSlug(e.target.value)} />
              </div>
              <div>
                <label>Name: </label>
                <input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <button onClick={saveTypeMeta}>Save Type</button>

              <h4 style={{marginTop:16}}>Fields</h4>
              <button onClick={addFieldToType}>+ Add Field</button>

              {(editingFields || []).map((f, i) => (
                <div key={f.id ?? `new-${i}`} style={{border:'1px dashed #bbb', padding:8, margin:'8px 0'}}>
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
                    <select value={f.type || 'text'} onChange={e => changeEditingField(i, { type: e.target.value })}>
                      <option value="text">text</option>
                      <option value="textarea">textarea</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="date">date</option>
                      <option value="json">json</option>
                      <option value="radio">radio</option>
                      <option value="dropdown">dropdown</option>
                      <option value="checkbox">checkbox</option>
                      <option value="relationship">relationship</option>
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

                  <div>
                    <label>Options: </label>
                    {f.type === 'relationship' ? (
                      <>
                        <input
                          placeholder="related content type slug"
                          value={typeof f.options === 'object' ? (f.options.relatedType || '') : (f.options || '')}
                          onChange={e => {
                            const v = e.target.value;
                            changeEditingField(i, { options: { relatedType: v, multiple: !!(typeof f.options === 'object' && f.options.multiple) }});
                          }}
                        />
                        <label style={{marginLeft:8}}>
                          <input
                            type="checkbox"
                            checked={typeof f.options === 'object' ? !!f.options.multiple : false}
                            onChange={e => {
                              const rel = (typeof f.options === 'object' ? (f.options.relatedType || '') : (f.options || ''));
                              changeEditingField(i, { options: { relatedType: rel, multiple: !!e.target.checked }});
                            }}
                          /> Multiple
                        </label>
                      </>
                    ) : (
                      <input
                        placeholder={['radio','dropdown','checkbox'].includes(f.type) ? 'comma,separated,choices' : 'n/a'}
                        value={typeof f.options === 'string' ? f.options : (
                          Array.isArray(f.options) ? f.options.join(', ') : ''
                        )}
                        onChange={e => changeEditingField(i, { options: e.target.value })}
                        disabled={!['radio','dropdown','checkbox','relationship'].includes(f.type)}
                      />
                    )}
                  </div>

                  <div style={{marginTop:8}}>
                    <button onClick={() => persistField(i)}>{f.id ? 'Save Field' : 'Add Field'}</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Right: Entries */}
      <div>
        <h2>Entries {selectedType ? `— ${selectedType.name}` : ''}</h2>
        {selectedType && (
          <>
            <div style={{marginBottom:8}}>
              <button onClick={startNewEntry}>+ New Entry</button>
            </div>

            {(editingEntryId !== null || Object.keys(entryData).length > 0) && (
              <div style={{border:'1px solid #ddd', padding:12, marginBottom:16}}>
                <h4>{editingEntryId ? `Edit #${editingEntryId}` : 'New Entry'}</h4>
                {(selectedType.fields || []).map(f => (
                  <div key={f.id} style={{marginBottom:8}}>
                    <label style={{display:'block', fontWeight:600}}>{f.label} ({f.key})</label>
                    <FieldInput
                      field={f}
                      value={entryData[f.key]}
                      onChange={(v) => setEntryData(prev => ({ ...prev, [f.key]: v }))}
                      relatedCache={relatedCache}
                    />
                  </div>
                ))}
                <button onClick={saveEntry}>Save Entry</button>
              </div>
            )}

            <ul style={{paddingLeft:18}}>
              {entries.map(ent => {
                const title = ent.data?.title || ent.id;
                return (
                  <li key={ent.id}>
                    <button onClick={() => editEntry(ent.id)}>Edit</button>{' '}
                    <strong>#{ent.id}</strong> — {String(title)}
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
