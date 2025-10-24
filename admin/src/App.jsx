import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [emailLogin, setEmailLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');

  const [contentTypes, setContentTypes] = useState([]);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [fields, setFields] = useState([
    { key: 'title', label: 'Title', type: 'text', required: true, sort: 0 }
  ]);
  const [selectedType, setSelectedType] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entryData, setEntryData] = useState({});

  useEffect(() => {
    fetchTypes();
  }, []);

  const apiBase = import.meta.env.VITE_API_BASE || '';

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

  async function createType() {
    if (!slug || !name) return;
    try {
      const res = await fetch(`${apiBase}/api/content-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ slug, name, fields })
      });
      if (res.ok) {
        const created = await res.json();
        setContentTypes([...contentTypes, created]);
        setSlug('');
        setName('');
        setFields([{ key: 'title', label: 'Title', type: 'text', required: true, sort: 0 }]);
      } else {
        alert('Failed to create content type');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function selectType(type) {
    try {
      const resType = await fetch(`${apiBase}/api/content-types/${type.slug}`);
      if (!resType.ok) {
        alert('Could not fetch type details');
        return;
      }
      const typeWithFields = await resType.json();
      setSelectedType(typeWithFields);
      const entriesRes = await fetch(`${apiBase}/api/content/${type.slug}`);
      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setEntries(data);
      } else {
        setEntries([]);
      }
      const init = {};
      if (typeWithFields.fields) {
        typeWithFields.fields.forEach((f) => {
          init[f.key] = f.type === 'boolean' ? false : '';
        });
      }
      setEntryData(init);
    } catch (err) {
      console.error(err);
    }
  }

  async function createEntry() {
    if (!selectedType) return;
    try {
      const res = await fetch(`${apiBase}/api/content/${selectedType.slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ data: entryData })
      });
      if (res.ok) {
        const entry = await res.json();
        setEntries([entry, ...entries]);
        const init = {};
        selectedType.fields.forEach((f) => {
          init[f.key] = f.type === 'boolean' ? false : '';
        });
        setEntryData(init);
      } else {
        alert('Failed to create entry');
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleFieldChange(index, key, value) {
    const updated = [...fields];
    updated[index][key] = value;
    setFields(updated);
  }

  function addField() {
    setFields([...fields, { key: '', label: '', type: 'text', required: false, sort: fields.length }]);
  }

  function updateEntryField(key, value) {
    setEntryData({ ...entryData, [key]: value });
  }

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

  if (!selectedType) {
    return (
      <div style={{ padding: '1rem' }}>
        <h1>CRM CMS Dashboard</h1>
        <h2>Create Content Type</h2>
        <input
          placeholder="Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <h3>Fields</h3>
        {fields.map((f, i) => (
          <div key={i} style={{ marginBottom: '0.5rem' }}>
            <input
              placeholder="Key"
              value={f.key}
              onChange={(e) => handleFieldChange(i, 'key', e.target.value)}
            />
            <input
              placeholder="Label"
              value={f.label}
              onChange={(e) => handleFieldChange(i, 'label', e.target.value)}
            />
            <select
              value={f.type}
              onChange={(e) => handleFieldChange(i, 'type', e.target.value)}
            >
              <option value="text">Text</option>
              <option value="textarea">Textarea</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="date">Date</option>
              <option value="json">JSON</option>
            </select>
            <label style={{ marginLeft: '0.5rem' }}>
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => handleFieldChange(i, 'required', e.target.checked)}
              />
              Required
            </label>
          </div>
        ))}
        <button onClick={addField}>Add Field</button>
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
      <h2>{selectedType.name} Entries</h2>
      <div
        style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}
      >
        <h3>Create Entry</h3>
        {selectedType.fields.map((f) => (
          <div key={f.id || f.key} style={{ marginBottom: '0.5rem' }}>
            <label>
              {f.label}{' '}
              {f.type === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={!!entryData[f.key]}
                  onChange={(e) => updateEntryField(f.key, e.target.checked)}
                />
              ) : f.type === 'textarea' ? (
                <textarea
                  value={entryData[f.key] || ''}
                  onChange={(e) => updateEntryField(f.key, e.target.value)}
                />
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={entryData[f.key] || ''}
                  onChange={(e) => updateEntryField(f.key, e.target.value)}
                />
              )}
            </label>
          </div>
        ))}
        <button onClick={createEntry}>Create Entry</button>
      </div>
      <ul>
        {entries.map((e) => (
          <li key={e.id}>
            {Object.entries(e.data).map(([k, v]) => (
              <span key={k} style={{ marginRight: '1rem' }}>
                <strong>{k}:</strong> {String(v)}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
