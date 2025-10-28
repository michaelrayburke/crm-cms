import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase setup (unused in this component but kept for future use)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  // auth
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [emailLogin, setEmailLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');

  // content type lists and creation
  const [contentTypes, setContentTypes] = useState([]);
  const [newTypeSlug, setNewTypeSlug] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeFields, setNewTypeFields] = useState([
    { key: 'title', label: 'Title', type: 'text', required: true, sort: 0, options: '' }
  ]);

  // selected type for management
  const [selectedType, setSelectedType] = useState(null);
  const [editSlug, setEditSlug] = useState('');
  const [editName, setEditName] = useState('');
  const [editingFields, setEditingFields] = useState([]);

  // entry management
  const [entries, setEntries] = useState([]);
  const [entryData, setEntryData] = useState({});
  const [editingEntryId, setEditingEntryId] = useState(null);

  const apiBase = import.meta.env.VITE_API_BASE || '';

  // fetch content types on mount
  useEffect(() => {
    fetchTypes();
  }, []);

  async function login() {
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLogin, password: passwordLogin })
      });
      const json = await res.json();
      if (res.ok) {
        setToken(json.token);
        localStorage.setItem('token', json.token);
        setEmailLogin('');
        setPasswordLogin('');
      } else {
        alert(json.error || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      alert('Login failed');
    }
  }

  async function fetchTypes() {
    try {
      const res = await fetch(`${apiBase}/api/content-types`);
      if (res.ok) {
        const data = await res.json();
        setContentTypes(data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // create a new content type
  async function createType() {
    if (!newTypeSlug || !newTypeName) return;
    try {
      const res = await fetch(`${apiBase}/api/content-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ slug: newTypeSlug, name: newTypeName, fields: newTypeFields })
      });
      if (res.ok) {
        const created = await res.json();
        setContentTypes([...contentTypes, created]);
        setNewTypeSlug('');
        setNewTypeName('');
        setNewTypeFields([
          { key: 'title', label: 'Title', type: 'text', required: true, sort: 0, options: '' }
        ]);
      } else {
        alert('Failed to create content type');
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleNewFieldChange(index, key, value) {
    const updated = [...newTypeFields];
    updated[index][key] = value;
    setNewTypeFields(updated);
  }

  function addNewTypeField() {
    setNewTypeFields([
      ...newTypeFields,
      { key: '', label: '', type: 'text', required: false, sort: newTypeFields.length, options: '' }
    ]);
  }

  // select a type for management
  async function selectType(type) {
    try {
      const resType = await fetch(`${apiBase}/api/content-types/${type.slug}`);
      if (!resType.ok) {
        alert('Could not fetch type details');
        return;
      }
      const typeWithFields = await resType.json();
      setSelectedType(typeWithFields);
      setEditSlug(typeWithFields.slug);
      setEditName(typeWithFields.name);
      // copy fields for editing (ensure options is string)
      const editable = (typeWithFields.fields || []).map((f) => ({
        ...f,
        options: f.options ? (typeof f.options === 'string' ? f.options : JSON.stringify(f.options)) : ''
      }));
      setEditingFields(editable);
      // fetch entries
      const entriesRes = await fetch(`${apiBase}/api/content/${type.slug}`);
      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setEntries(data);
      } else {
        setEntries([]);
      }
      // initialize entry data for creation
      const init = {};
      editable.forEach((f) => {
        if (f.type === 'boolean') init[f.key] = false;
        else init[f.key] = f.type === 'checkbox' ? [] : '';
      });
      setEntryData(init);
      setEditingEntryId(null);
    } catch (err) {
      console.error(err);
    }
  }

  function handleEditingFieldChange(index, key, value) {
    const updated = [...editingFields];
    updated[index][key] = value;
    setEditingFields(updated);
  }

  function addEditingField() {
    setEditingFields([
      ...editingFields,
      { key: '', label: '', type: 'text', required: false, sort: editingFields.length, options: '' }
    ]);
  }

  function parseOptions(input) {
    if (!input) return null;
    try {
      // try to parse JSON
      return JSON.parse(input);
    } catch {
      // treat as comma-separated values
      return input.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  // save changes to the selected type (slug, name, fields)
  async function saveTypeChanges() {
    if (!selectedType) return;
    try {
      // update type slug and name
      await fetch(`${apiBase}/api/content-types/${selectedType.slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ slug: editSlug, name: editName })
      });
      // update or create fields
      for (const f of editingFields) {
        const body = {
          name: f.label,
          type: f.type,
          options: f.options ? parseOptions(f.options) : null
        };
        if (f.id) {
          await fetch(`${apiBase}/api/content-types/${editSlug}/fields/${f.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(body)
          });
        } else {
          await fetch(`${apiBase}/api/content-types/${editSlug}/fields`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(body)
          });
        }
      }
      // refresh types and reselect updated type
      await fetchTypes();
      const updated = { slug: editSlug };
      await selectType(updated);
      alert('Type updated');
    } catch (err) {
      console.error(err);
      alert('Failed to save changes');
    }
  }

  // entry handlers
  function handleEntryChange(key, value) {
    setEntryData({ ...entryData, [key]: value });
  }

  async function saveEntry() {
    if (!selectedType) return;
    try {
      const method = editingEntryId ? 'PUT' : 'POST';
      const url = editingEntryId
        ? `${apiBase}/api/content/${selectedType.slug}/${editingEntryId}`
        : `${apiBase}/api/content/${selectedType.slug}`;
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ data: entryData })
      });
      if (res.ok) {
        const entry = await res.json();
        if (editingEntryId) {
          // update local list
          setEntries(entries.map((e) => (e.id === editingEntryId ? entry : e)));
        } else {
          setEntries([entry, ...entries]);
        }
        // reset form
        const init = {};
        editingFields.forEach((f) => {
          init[f.key] = f.type === 'boolean' ? false : f.type === 'checkbox' ? [] : '';
        });
        setEntryData(init);
        setEditingEntryId(null);
      } else {
        alert('Failed to save entry');
      }
    } catch (err) {
      console.error(err);
    }
  }

  function startEditEntry(entry) {
    setEditingEntryId(entry.id);
    // copy data; ensure arrays for checkbox
    const init = {};
    editingFields.forEach((f) => {
      init[f.key] = entry.data[f.key] !== undefined ? entry.data[f.key] : f.type === 'checkbox' ? [] : f.type === 'boolean' ? false : '';
    });
    setEntryData({ ...init, ...entry.data });
  }

  // UI rendering
  if (!token) {
    return (
      <div style={{ padding: '1rem' }}>
        <h1>CRM CMS Dashboard</h1>
        <h2>Login</h2>
        <input
          placeholder="Email"
          value={emailLogin}
          onChange={(e) => setEmailLogin(e.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={passwordLogin}
          onChange={(e) => setPasswordLogin(e.target.value)}
        />
        <button onClick={login}>Login</button>
      </div>
    );
  }

  // create type view
  if (!selectedType) {
    return (
      <div style={{ padding: '1rem' }}>
        <h1>CRM CMS Dashboard</h1>
        <h2>Create Content Type</h2>
        <input
          placeholder="Slug"
          value={newTypeSlug}
          onChange={(e) => setNewTypeSlug(e.target.value)}
        />
        <input
          placeholder="Name"
          value={newTypeName}
          onChange={(e) => setNewTypeName(e.target.value)}
        />
        <h3>Fields</h3>
        {newTypeFields.map((f, i) => (
          <div key={i} style={{ marginBottom: '0.5rem' }}>
            <input
              placeholder="Key"
              value={f.key}
              onChange={(e) => handleNewFieldChange(i, 'key', e.target.value)}
            />
            <input
              placeholder="Label"
              value={f.label}
              onChange={(e) => handleNewFieldChange(i, 'label', e.target.value)}
            />
            <select
              value={f.type}
              onChange={(e) => handleNewFieldChange(i, 'type', e.target.value)}
            >
              <option value="text">Text</option>
              <option value="textarea">Textarea</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="date">Date</option>
              <option value="json">JSON</option>
              <option value="radio">Radio</option>
              <option value="dropdown">Dropdown</option>
              <option value="checkbox">Checkbox</option>
              <option value="relationship">Relationship</option>
            </select>
            <input
              placeholder="Options (comma separated or JSON)"
              value={f.options}
              onChange={(e) => handleNewFieldChange(i, 'options', e.target.value)}
            />
            <label style={{ marginLeft: '0.5rem' }}>
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => handleNewFieldChange(i, 'required', e.target.checked)}
              />
              Required
            </label>
          </div>
        ))}
        <button onClick={addNewTypeField}>Add Field</button>
        <button onClick={createType}>Create Content Type</button>
        <h2>Existing Content Types</h2>
        <ul>
          {contentTypes.map((t) => (
            <li key={t.id}>
              {t.name} ({t.slug}){' '}
              <button onClick={() => selectType(t)}>Manage</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // type management view
  return (
    <div style={{ padding: '1rem' }}>
      <button
        onClick={() => {
          setSelectedType(null);
          setEntries([]);
        }}
      >
        Back
      </button>
      <h2>Edit Content Type</h2>
      <div>
        <label>
          Slug:
          <input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
        </label>
        <label style={{ marginLeft: '1rem' }}>
          Name:
          <input value={editName} onChange={(e) => setEditName(e.target.value)} />
        </label>
      </div>
      <h3>Fields</h3>
      {editingFields.map((f, i) => (
        <div key={i} style={{ marginBottom: '0.5rem' }}>
          <input
            placeholder="Key"
            value={f.key}
            onChange={(e) => handleEditingFieldChange(i, 'key', e.target.value)}
          />
          <input
            placeholder="Label"
            value={f.label}
            onChange={(e) => handleEditingFieldChange(i, 'label', e.target.value)}
          />
          <select
            value={f.type}
            onChange={(e) => handleEditingFieldChange(i, 'type', e.target.value)}
          >
            <option value="text">Text</option>
            <option value="textarea">Textarea</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="date">Date</option>
            <option value="json">JSON</option>
            <option value="radio">Radio</option>
            <option value="dropdown">Dropdown</option>
            <option value="checkbox">Checkbox</option>
            <option value="relationship">Relationship</option>
          </select>
          <input
            placeholder="Options (comma separated or JSON)"
            value={f.options}
            onChange={(e) => handleEditingFieldChange(i, 'options', e.target.value)}
          />
          <label style={{ marginLeft: '0.5rem' }}>
            <input
              type="checkbox"
              checked={!!f.required}
              onChange={(e) => handleEditingFieldChange(i, 'required', e.target.checked)}
            />
            Required
          </label>
        </div>
      ))}
      <button onClick={addEditingField}>Add Field</button>
      <button onClick={saveTypeChanges}>Save Changes</button>
      <h2>Entries for {editName}</h2>
      <div style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
        <h3>{editingEntryId ? 'Edit Entry' : 'Create Entry'}</h3>
        {editingFields.map((f) => {
          const opts = f.options ? parseOptions(f.options) : [];
          const value = entryData[f.key];
          return (
            <div key={f.id || f.key} style={{ marginBottom: '0.5rem' }}>
              <label>
                {f.label}{' '}
                {f.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => handleEntryChange(f.key, e.target.checked)}
                  />
                ) : f.type === 'textarea' ? (
                  <textarea
                    value={value || ''}
                    onChange={(e) => handleEntryChange(f.key, e.target.value)}
                  />
                ) : f.type === 'number' ? (
                  <input
                    type="number"
                    value={value || ''}
                    onChange={(e) => handleEntryChange(f.key, e.target.value)}
                  />
                ) : f.type === 'radio' ? (
                  <select
                    value={value || ''}
                    onChange={(e) => handleEntryChange(f.key, e.target.value)}
                  >
                    <option value="">--Select--</option>
                    {Array.isArray(opts) && opts.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'dropdown' ? (
                  <select
                    value={value || ''}
                    onChange={(e) => handleEntryChange(f.key, e.target.value)}
                  >
                    <option value="">--Select--</option>
                    {Array.isArray(opts) && opts.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <div>
                    {Array.isArray(opts) && opts.map((o) => (
                      <label key={o} style={{ marginRight: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={Array.isArray(value) ? value.includes(o) : false}
                          onChange={(e) => {
                            let arr = Array.isArray(value) ? [...value] : [];
                            if (e.target.checked) arr.push(o);
                            else arr = arr.filter((v) => v !== o);
                            handleEntryChange(f.key, arr);
                          }}
                        />
                        {o}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => handleEntryChange(f.key, e.target.value)}
                  />
                )}
              </label>
            </div>
          );
        })}
        <button onClick={saveEntry}>{editingEntryId ? 'Update Entry' : 'Create Entry'}</button>
      </div>
      <ul>
        {entries.map((e) => (
          <li key={e.id} style={{ marginBottom: '0.5rem' }}>
            {Object.entries(e.data).map(([k, v]) => (
              <span key={k} style={{ marginRight: '1rem' }}>
                <strong>{k}:</strong> {Array.isArray(v) ? v.join(', ') : String(v)}
              </span>
            ))}
            <button style={{ marginLeft: '1rem' }} onClick={() => startEditEntry(e)}>
              Edit
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
