import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';

/*
 * EntryViews settings page with widget/section grouping.
 *
 * This component lets administrators build rich entry editor views for each
 * content type. A view consists of one or more sections (widgets). Each
 * section has a title, description, column count and an ordered list of
 * fields. Only one view per slug is stored per content type. Users can
 * assign the view to multiple roles, set default roles, toggle admin‑only,
 * and manage slugs and labels. The page mirrors the ListViews settings
 * behaviour for multi‑role assignment and default role handling.
 */

// Helper to slugify labels into URL‑friendly strings
function slugify(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Built‑in fields available on every entry. These are shown in the editor
// outside of the widget configuration. Including them in a widget is
// optional; if present they will appear in order within that section.
const BUILTIN_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'slug', label: 'Slug' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created' },
  { key: 'updated_at', label: 'Updated' },
];

export default function EntryViews() {
  const params = useParams();
  const navigate = useNavigate();

  // Stage: choose type, choose view, edit view
  const [stage, setStage] = useState('types');
  // All content types
  const [contentTypes, setContentTypes] = useState([]);
  // Currently selected type id (or slug) from params
  const [selectedTypeId, setSelectedTypeId] = useState('');
  // Currently selected view slug
  const [activeViewSlug, setActiveViewSlug] = useState('');

  // Editor views loaded for selected type
  const [views, setViews] = useState([]);
  // Available fields for the selected type (built‑ins + custom)
  const [availableFields, setAvailableFields] = useState([]);
  // Sections for the view being edited
  const [sections, setSections] = useState([]);
  // Index of the currently selected section (for editing)
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  // Assigned roles for this view
  const [assignedRoles, setAssignedRoles] = useState(['ADMIN']);
  // Default roles (subset of assignedRoles)
  const [defaultRoles, setDefaultRoles] = useState([]);
  // Admin only toggle
  const [adminOnly, setAdminOnly] = useState(false);
  // Label and slug for the view
  const [currentLabel, setCurrentLabel] = useState('');
  const [currentSlug, setCurrentSlug] = useState('');
  // Flags
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  // Sync stage and type from route params
  useEffect(() => {
    const typeParam = params.typeSlug || params.typeId;
    const viewParam = params.viewSlug || '';
    if (!typeParam) {
      setStage('types');
      setSelectedTypeId('');
      setActiveViewSlug('');
      return;
    }
    setSelectedTypeId(typeParam);
    if (viewParam) {
      setStage('edit');
      setActiveViewSlug(viewParam);
    } else {
      setStage('views');
      setActiveViewSlug('');
    }
  }, [params.typeSlug, params.typeId, params.viewSlug]);

  // Load content types and roles on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingTypes(true);
        setError('');
        // Fetch roles (for assignment). If fails, we keep defaults.
        try {
          const rolesRes = await api.get('/api/roles');
          const rawRoles = rolesRes?.data || rolesRes || [];
          if (Array.isArray(rawRoles) && rawRoles.length) {
            const extracted = rawRoles
              .map((r) => (r.slug || r.name || r.role || '').toUpperCase())
              .filter(Boolean);
            if (extracted.length) setAssignedRoles((prev) => {
              // ensure ADMIN always included
              const set = new Set(['ADMIN', ...extracted]);
              return Array.from(set);
            });
          }
        } catch (_) {
          // ignore errors; we use default roles set
        }
        // Fetch content types
        const ctRes = await api.get('/api/content-types');
        const list = Array.isArray(ctRes) ? ctRes : ctRes?.data || [];
        list.sort((a, b) => {
          const an = (a.name || a.slug || '').toLowerCase();
          const bn = (b.name || b.slug || '').toLowerCase();
          return an.localeCompare(bn);
        });
        setContentTypes(list);
        // If nothing selected and no param, select first type
        const hasParam = params?.typeSlug || params?.typeId;
        if (list.length && !hasParam && !selectedTypeId) {
          setSelectedTypeId(list[0].id);
        }
      } catch (err) {
        console.error('[EntryViews] failed to load content types', err);
        if (!cancelled) setError('Failed to load content types');
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute available fields (built‑ins + custom) for a given content type
  const computeAvailableFields = (ct) => {
    if (!ct) return BUILTIN_FIELDS;
    const ctFields = Array.isArray(ct.fields)
      ? ct.fields.map((f) => {
          const key = f.key || f.field_key;
          return {
            key: key,
            label: f.label || f.name || key,
          };
        })
      : [];
    const all = [...BUILTIN_FIELDS];
    for (const f of ctFields) {
      if (!all.find((x) => x.key === f.key)) all.push(f);
    }
    return all;
  };

  // Load views and fields when type changes
  useEffect(() => {
    if (!selectedTypeId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        setSaveMessage('');
        setDirty(false);
        // Fetch full type definition
        const ctRes = await api.get(`/api/content-types/${selectedTypeId}`);
        const ct = ctRes?.data || ctRes || null;
        setAvailableFields(computeAvailableFields(ct));
        // Fetch views for this type (all roles)
        const viewsRes = await api.get(
          `/api/content-types/${selectedTypeId}/editor-views?all=true&_=${Date.now()}`
        );
        const rawViews = viewsRes?.data || viewsRes || [];
        let loadedViews = [];
        if (Array.isArray(rawViews)) loadedViews = rawViews;
        else if (rawViews && Array.isArray(rawViews.views)) loadedViews = rawViews.views;
        setViews(loadedViews);
        // If no view slug specified, pick default or first
        if (!activeViewSlug) {
          if (loadedViews.length === 0) {
            setStage('views');
            return;
          }
          const def = loadedViews.find((v) => {
            const cfg = v.config || {};
            const dRoles = Array.isArray(cfg.default_roles)
              ? cfg.default_roles.map((r) => String(r || '').toUpperCase())
              : [];
            return dRoles.includes('ADMIN') || !!v.is_default;
          }) || loadedViews[0];
          setActiveViewSlug(def.slug);
          setCurrentLabel(def.label || def.slug);
          setCurrentSlug(def.slug);
          // assign roles from view
          const cfgRoles = Array.isArray(def.config?.roles)
            ? def.config.roles.map((r) => r.toUpperCase())
            : def.role
            ? [String(def.role || '').toUpperCase()]
            : [];
          setAssignedRoles(cfgRoles.length ? cfgRoles : ['ADMIN']);
          const cfgDefaults = Array.isArray(def.config?.default_roles)
            ? def.config.default_roles.map((r) => r.toUpperCase())
            : [];
          setDefaultRoles(cfgDefaults);
          setAdminOnly(cfgRoles.length === 0 || cfgRoles.every((r) => r === 'ADMIN'));
          // load sections
          const sects = Array.isArray(def.config?.sections) ? def.config.sections : [];
          setSections(
            sects.map((sec, idx) => ({
              id: sec.id || `section-${idx + 1}`,
              title: sec.title || `Section ${idx + 1}`,
              description: sec.description || '',
              columns:
                typeof sec.columns === 'number'
                  ? sec.columns
                  : sec.layout && sec.layout.includes('two')
                  ? 2
                  : 1,
              fields: Array.isArray(sec.fields)
                ? sec.fields.map((f) => (typeof f === 'string' ? f : f.key))
                : [],
            }))
          );
          setSelectedSectionIndex(0);
          setStage('edit');
        } else {
          // a specific view slug is in URL; load it
          const v = loadedViews.find((x) => x.slug === activeViewSlug);
          if (v) {
            setCurrentLabel(v.label || v.slug);
            setCurrentSlug(v.slug);
            const cfgRoles = Array.isArray(v.config?.roles)
              ? v.config.roles.map((r) => r.toUpperCase())
              : v.role
              ? [String(v.role || '').toUpperCase()]
              : [];
            setAssignedRoles(cfgRoles.length ? cfgRoles : ['ADMIN']);
            const cfgDefaults = Array.isArray(v.config?.default_roles)
              ? v.config.default_roles.map((r) => r.toUpperCase())
              : [];
            setDefaultRoles(cfgDefaults);
            setAdminOnly(cfgRoles.length === 0 || cfgRoles.every((r) => r === 'ADMIN'));
            const sects = Array.isArray(v.config?.sections) ? v.config.sections : [];
            setSections(
              sects.map((sec, idx) => ({
                id: sec.id || `section-${idx + 1}`,
                title: sec.title || `Section ${idx + 1}`,
                description: sec.description || '',
                columns:
                  typeof sec.columns === 'number'
                    ? sec.columns
                    : sec.layout && sec.layout.includes('two')
                    ? 2
                    : 1,
                fields: Array.isArray(sec.fields)
                  ? sec.fields.map((f) => (typeof f === 'string' ? f : f.key))
                  : [],
              }))
            );
            setSelectedSectionIndex(0);
            setStage('edit');
          }
        }
      } catch (err) {
        console.error('[EntryViews] load error', err);
        if (!cancelled) setError('Failed to load editor views');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTypeId, activeViewSlug]);

  // Derived: unassigned fields are those available but not assigned to any section
  const unassignedFields = useMemo(() => {
    const allAssigned = new Set();
    sections.forEach((sec) => {
      for (const k of sec.fields) allAssigned.add(k);
    });
    return availableFields.filter((f) => !allAssigned.has(f.key));
  }, [availableFields, sections]);

  // Helper to update roles and default roles when toggling adminOnly
  const applyAdminOnly = (val) => {
    if (val) {
      setAdminOnly(true);
      setAssignedRoles([]);
      setDefaultRoles([]);
    } else {
      setAdminOnly(false);
    }
    setDirty(true);
  };

  // Handlers for role assignment
  const toggleAssignedRole = (role) => {
    const upper = role.toUpperCase();
    if (adminOnly) setAdminOnly(false);
    setAssignedRoles((prev) => {
      const exists = prev.includes(upper);
      if (exists) {
        // remove
        const next = prev.filter((r) => r !== upper);
        // remove from defaultRoles as well
        setDefaultRoles((d) => d.filter((r) => r !== upper));
        return next;
      }
      return [...prev, upper];
    });
    setDirty(true);
  };

  const toggleDefaultRole = (role) => {
    const upper = role.toUpperCase();
    setDefaultRoles((prev) => {
      const exists = prev.includes(upper);
      let next;
      if (exists) {
        next = prev.filter((r) => r !== upper);
      } else {
        next = [...prev, upper];
        // Only allow defaults for assigned roles
        next = next.filter((r) => assignedRoles.includes(r) || r === 'ADMIN');
      }
      return next;
    });
    setDirty(true);
  };

  // Section management
  const addSection = () => {
    const index = sections.length + 1;
    setSections((prev) => [
      ...prev,
      {
        id: `section-${index}`,
        title: `Section ${index}`,
        description: '',
        columns: 1,
        fields: [],
      },
    ]);
    setSelectedSectionIndex(sections.length);
    setDirty(true);
  };

  const selectSection = (idx) => {
    setSelectedSectionIndex(idx);
  };

  const deleteSection = (idx) => {
    setSections((prev) => {
      const next = prev.filter((_s, i) => i !== idx);
      // ensure at least one section
      if (next.length === 0) {
        return [
          {
            id: 'section-1',
            title: 'Section 1',
            description: '',
            columns: 1,
            fields: [],
          },
        ];
      }
      return next;
    });
    setSelectedSectionIndex((prev) => Math.max(0, prev - 1));
    setDirty(true);
  };

  const moveSection = (idx, direction) => {
    setSections((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[target];
      next[target] = tmp;
      return next;
    });
    if (selectedSectionIndex === idx) {
      setSelectedSectionIndex(direction === 'up' ? idx - 1 : idx + 1);
    } else if (selectedSectionIndex === idx - 1 && direction === 'down') {
      setSelectedSectionIndex(idx);
    } else if (selectedSectionIndex === idx + 1 && direction === 'up') {
      setSelectedSectionIndex(idx);
    }
    setDirty(true);
  };

  // Update section title/description/columns
  const updateSectionField = (idx, field, value) => {
    setSections((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [field]: value,
      };
      return next;
    });
    setDirty(true);
  };

  // Add a field to a section; ensure field is removed from other sections
  const addFieldToSection = (sectionIdx, fieldKey) => {
    setSections((prev) => {
      const next = prev.map((sec, idx) => {
        const keys = sec.fields || [];
        if (idx === sectionIdx) {
          // skip if already exists
          if (keys.includes(fieldKey)) return sec;
          return {
            ...sec,
            fields: [...keys, fieldKey],
          };
        }
        // remove if present in other sections
        return {
          ...sec,
          fields: keys.filter((k) => k !== fieldKey),
        };
      });
      return next;
    });
    setDirty(true);
  };

  // Remove field from a section
  const removeFieldFromSection = (sectionIdx, fieldKey) => {
    setSections((prev) => {
      const next = [...prev];
      next[sectionIdx] = {
        ...next[sectionIdx],
        fields: next[sectionIdx].fields.filter((k) => k !== fieldKey),
      };
      return next;
    });
    setDirty(true);
  };

  // Reorder fields within a section
  const moveFieldInSection = (sectionIdx, fieldKey, direction) => {
    setSections((prev) => {
      const next = [...prev];
      const sec = next[sectionIdx];
      const idx = sec.fields.indexOf(fieldKey);
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= sec.fields.length) return prev;
      const arr = [...sec.fields];
      const tmp = arr[idx];
      arr[idx] = arr[target];
      arr[target] = tmp;
      next[sectionIdx] = { ...sec, fields: arr };
      return next;
    });
    setDirty(true);
  };

  // Save handler
  const handleSave = async () => {
    if (!selectedTypeId) return;
    setError('');
    setSaveMessage('');
    const label = (currentLabel || '').trim();
    const slug = currentSlug || slugify(label || 'view');
    if (!label) {
      setError('Label is required');
      return;
    }
    // Ensure at least one section
    if (!sections || !sections.length) {
      setError('Please add at least one section');
      return;
    }
    // Each section must have at least one field
    if (sections.some((sec) => !sec.fields || sec.fields.length === 0)) {
      setError('Each section must contain at least one field');
      return;
    }
    // Duplicate slug detection
    const dup = (views || []).find(
      (v) => v.slug && v.slug.toLowerCase() === slug.toLowerCase() && v.slug !== activeViewSlug
    );
    if (dup) {
      setError(`A view with the slug "${slug}" already exists. Choose a different label or slug.`);
      return;
    }
    try {
      setLoading(true);
      // Ensure ADMIN always in roles
      const rolesSet = new Set(assignedRoles.map((r) => r.toUpperCase()));
      rolesSet.add('ADMIN');
      const rolesArray = Array.from(rolesSet);
      // Default roles: only assigned roles
      const defaults = defaultRoles.filter((r) => rolesArray.includes(r));
      // Build sections payload: map to objects with id, title, description, layout or columns, and fields
      const payloadSections = sections.map((sec) => ({
        id: sec.id,
        title: sec.title || '',
        description: sec.description || '',
        // Use layout string for compatibility
        layout: sec.columns === 2 ? 'two-column' : 'one-column',
        fields: sec.fields.map((k) => k),
      }));
      const payload = {
        slug,
        label,
        roles: rolesArray,
        default_roles: defaults,
        sections: payloadSections,
      };
      await api.put(`/api/content-types/${selectedTypeId}/editor-view`, payload);
      // Reload views after save
      const res = await api.get(
        `/api/content-types/${selectedTypeId}/editor-views?all=true&_=${Date.now()}`
      );
      const raw = res?.data || res || [];
      let newViews;
      if (Array.isArray(raw)) newViews = raw;
      else if (raw && Array.isArray(raw.views)) newViews = raw.views;
      else newViews = [];
      setViews(newViews);
      setSaveMessage('Editor view saved');
      setDirty(false);
      // Navigate back to view list
      navigate(`/admin/settings/entry-views/${selectedTypeId}`);
    } catch (err) {
      console.error('[EntryViews] save error', err);
      setError('Failed to save editor view');
    } finally {
      setLoading(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!selectedTypeId || !activeViewSlug) return;
    if (!window.confirm('Are you sure you want to delete this view? This cannot be undone.')) return;
    try {
      setLoading(true);
      await api.del(`/api/content-types/${selectedTypeId}/editor-view/${encodeURIComponent(activeViewSlug)}`);
      // reload views
      const res = await api.get(
        `/api/content-types/${selectedTypeId}/editor-views?all=true&_=${Date.now()}`
      );
      const raw = res?.data || res || [];
      let newViews;
      if (Array.isArray(raw)) newViews = raw;
      else if (raw && Array.isArray(raw.views)) newViews = raw.views;
      else newViews = [];
      setViews(newViews);
      setSaveMessage('Editor view deleted');
      // Reset view slug and navigate back
      setActiveViewSlug('');
      setCurrentLabel('');
      setCurrentSlug('');
      setSections([]);
      navigate(`/admin/settings/entry-views/${selectedTypeId}`);
    } catch (err) {
      console.error('[EntryViews] delete error', err);
      setError('Failed to delete view');
    } finally {
      setLoading(false);
    }
  };

  // Render functions
  const renderTypeSelection = () => (
    <div className="su-card su-mb-md">
      <div className="su-card-body su-flex su-flex-wrap su-gap-sm su-items-center">
        <span className="su-text-sm su-text-muted">Content types:</span>
        {contentTypes.map((ct) => (
          <button
            key={ct.id}
            type="button"
            className={`su-chip${selectedTypeId === ct.id || selectedTypeId === ct.slug ? ' su-chip--active' : ''}`}
            onClick={() => navigate(`/admin/settings/entry-views/${ct.id}`)}
          >
            {ct.name || ct.label || ct.slug}
          </button>
        ))}
      </div>
    </div>
  );

  const renderViewSelection = () => (
    <div className="su-card su-mb-md">
      <div className="su-card-body su-flex su-flex-wrap su-gap-sm su-items-center">
        <span className="su-text-sm su-text-muted">Views:</span>
        {views.map((v) => {
          const cfg = v.config || {};
          const dRoles = Array.isArray(cfg.default_roles)
            ? cfg.default_roles.map((r) => String(r || '').toUpperCase())
            : [];
          const isDefaultForRole = dRoles.includes('ADMIN') || !!v.is_default;
          return (
            <button
              key={v.slug}
              type="button"
              className={`su-chip${v.slug === activeViewSlug ? ' su-chip--active' : ''}`}
              onClick={() => navigate(`/admin/settings/entry-views/${selectedTypeId}/${v.slug}`)}
            >
              {v.label || v.slug}
              {isDefaultForRole && <span className="su-chip-badge">default</span>}
            </button>
          );
        })}
        <button
          type="button"
          className="su-chip new"
          onClick={() => {
            // Start new view with default settings
            const baseLabel = 'New editor';
            let label = baseLabel;
            let suffix = 1;
            const existing = views.map((v) => (v.label || '').toLowerCase());
            while (existing.includes(label.toLowerCase())) {
              suffix += 1;
              label = `${baseLabel} ${suffix}`;
            }
            const slug = slugify(label);
            setCurrentLabel(label);
            setCurrentSlug(slug);
            setActiveViewSlug(slug);
            setAssignedRoles(['ADMIN']);
            setDefaultRoles([]);
            setAdminOnly(false);
            // initialize one empty section
            setSections([
              {
                id: 'section-1',
                title: 'Section 1',
                description: '',
                columns: 1,
                fields: [],
              },
            ]);
            setSelectedSectionIndex(0);
            setDirty(true);
            navigate(`/admin/settings/entry-views/${selectedTypeId}/${slug}`);
            setStage('edit');
          }}
        >
          + New editor view
        </button>
      </div>
    </div>
  );

  const renderSectionList = () => (
    <div className="su-card su-mb-md">
      <div className="su-card-header">
        <h3 className="su-card-title">Sections</h3>
      </div>
      <div className="su-card-body">
        {sections.map((sec, idx) => (
          <div key={sec.id} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              onClick={() => selectSection(idx)}
              className={`su-btn${idx === selectedSectionIndex ? ' su-btn-primary' : ''}`}
              style={{ flexGrow: 1 }}
            >
              {sec.title || sec.id}
            </button>
            <button type="button" className="su-btn sm" onClick={() => moveSection(idx, 'up')} disabled={idx === 0}>
              ↑
            </button>
            <button type="button" className="su-btn sm" onClick={() => moveSection(idx, 'down')} disabled={idx === sections.length - 1}>
              ↓
            </button>
            <button type="button" className="su-btn sm" onClick={() => deleteSection(idx)} disabled={sections.length === 1}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="su-btn" onClick={addSection} style={{ marginTop: 8 }}>
          + Add section
        </button>
      </div>
    </div>
  );

  const renderSectionEditor = () => {
    const sec = sections[selectedSectionIndex] || null;
    if (!sec) return null;
    // fields in this section
    const fieldsInSection = sec.fields
      .map((key) => availableFields.find((f) => f.key === key))
      .filter(Boolean);
    return (
      <div className="su-card">
        <div className="su-card-header">
          <h3 className="su-card-title">Edit section</h3>
        </div>
        <div className="su-card-body">
          <label className="su-label" style={{ marginBottom: 6 }}>
            Title
            <input
              className="su-input"
              type="text"
              value={sec.title}
              onChange={(e) => updateSectionField(selectedSectionIndex, 'title', e.target.value)}
            />
          </label>
          <label className="su-label" style={{ marginBottom: 6 }}>
            Description
            <textarea
              className="su-input"
              value={sec.description}
              onChange={(e) => updateSectionField(selectedSectionIndex, 'description', e.target.value)}
              placeholder="Optional description or helper text"
            />
          </label>
          <label className="su-label" style={{ marginBottom: 6 }}>
            Columns
            <select
              className="su-select"
              value={sec.columns}
              onChange={(e) => updateSectionField(selectedSectionIndex, 'columns', parseInt(e.target.value, 10))}
            >
              <option value={1}>One column</option>
              <option value={2}>Two columns</option>
            </select>
          </label>
          <div style={{ marginTop: 12 }}>
            <strong>Fields in this section</strong>
            {fieldsInSection.length === 0 && <p className="su-text-muted" style={{ fontSize: 12 }}>No fields assigned</p>}
            {fieldsInSection.map((f, idx) => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ flexGrow: 1 }}>{f.label}</span>
                <button type="button" className="su-btn sm" onClick={() => moveFieldInSection(selectedSectionIndex, f.key, 'up')} disabled={idx === 0}>
                  ↑
                </button>
                <button type="button" className="su-btn sm" onClick={() => moveFieldInSection(selectedSectionIndex, f.key, 'down')} disabled={idx === fieldsInSection.length - 1}>
                  ↓
                </button>
                <button type="button" className="su-btn sm" onClick={() => removeFieldFromSection(selectedSectionIndex, f.key)}>
                  ✕
                </button>
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              <strong>Available fields</strong>
              {unassignedFields.length === 0 && <p className="su-text-muted" style={{ fontSize: 12 }}>No unassigned fields</p>}
              {unassignedFields.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="su-btn sm"
                  onClick={() => addFieldToSection(selectedSectionIndex, f.key)}
                  style={{ marginRight: 4, marginBottom: 4 }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEditView = () => (
    <div>
      {error && (
        <div className="su-alert su-alert-danger" style={{ marginBottom: 12 }}>{error}</div>
      )}
      {saveMessage && (
        <div className="su-alert su-alert-success" style={{ marginBottom: 12 }}>{saveMessage}</div>
      )}
      <div className="su-grid cols-2" style={{ gap: 16 }}>
        {/* Left: view details */}
        <div>
          <div className="su-card su-mb-md">
            <div className="su-card-header">
              <h3 className="su-card-title">View Details</h3>
            </div>
            <div className="su-card-body">
              <label className="su-label" style={{ marginBottom: 6 }}>
                Label
                <input
                  className="su-input"
                  type="text"
                  value={currentLabel}
                  onChange={(e) => {
                    setCurrentLabel(e.target.value);
                    setCurrentSlug(slugify(e.target.value || 'view'));
                    setDirty(true);
                  }}
                />
              </label>
              <label className="su-label" style={{ marginBottom: 6 }}>
                Slug
                <input
                  className="su-input"
                  type="text"
                  value={currentSlug}
                  onChange={(e) => {
                    setCurrentSlug(slugify(e.target.value));
                    setDirty(true);
                  }}
                />
              </label>
              <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--su-muted)' }}>
                Slug preview: /admin/content/{selectedTypeId}/{currentSlug || slugify(currentLabel || 'view')}
              </div>
              {/* Roles assignment */}
              <div style={{ marginBottom: 6 }}>
                <strong>Assigned roles</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {['ADMIN', 'EDITOR', 'AUTHOR', 'VIEWER'].map((r) => (
                    <label key={r} style={{ fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={assignedRoles.includes(r)}
                        onChange={() => toggleAssignedRole(r)}
                      />{' '}
                      {r}
                    </label>
                  ))}
                  <label style={{ fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={adminOnly}
                      onChange={() => applyAdminOnly(!adminOnly)}
                    />{' '}
                    Admin only
                  </label>
                </div>
              </div>
              {/* Default roles */}
              <div style={{ marginBottom: 6 }}>
                <strong>Default roles</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {['ADMIN', 'EDITOR', 'AUTHOR', 'VIEWER'].map((r) => (
                    <label key={r} style={{ fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={defaultRoles.includes(r)}
                        onChange={() => toggleDefaultRole(r)}
                        disabled={!assignedRoles.includes(r) && !(r === 'ADMIN')}
                      />{' '}
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" className="su-btn primary" onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving…' : 'Save view'}
                </button>
                {activeViewSlug && (
                  <button type="button" className="su-btn" onClick={handleDelete} disabled={loading}>
                    Delete view
                  </button>
                )}
                <button type="button" className="su-btn" onClick={() => navigate(-1)} disabled={loading}>
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Right: sections builder */}
        <div>
          {renderSectionList()}
          {renderSectionEditor()}
        </div>
      </div>
    </div>
  );

  return (
    <div className="su-page">
      <h2 className="su-page-title">Entry Editor Views</h2>
      <p className="su-page-subtitle">Configure the entry editor for your content types.</p>
      {loadingTypes && <p>Loading types…</p>}
      {!loadingTypes && stage === 'types' && renderTypeSelection()}
      {!loadingTypes && stage === 'views' && (
        <>
          {renderTypeSelection()}
          {renderViewSelection()}
        </>
      )}
      {!loadingTypes && stage === 'edit' && renderEditView()}
    </div>
  );
}