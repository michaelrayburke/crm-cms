import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

/*
 * EntryViews (Widget Builder)
 *
 * This settings page lets administrators configure the entry editor for each
 * content type. It mirrors the List Views builder: you choose a content
 * type, then select or create an editor view, and then edit that view.
 *
 * Each editor view stores:
 *  - slug: unique per type
 *  - label: human name
 *  - roles: roles that can use this view (multi‑select)
 *  - default_roles: roles for which this view is default
 *  - sections: array of widgets { id, title, description, layout, fields }
 *
 * We exclude built‑in fields (title, slug, status, created_at, updated_at) from
 * the configurable list because they are always shown in the editor and
 * cannot be reordered or hidden. Custom fields defined in the content type
 * builder are available to assign to widgets.
 */

// Simple slugify helper for view slugs
function slugify(str) {
  return (str || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Built‑in fields that always appear in the editor; not configurable
const BUILTIN_FIELDS = [
  { key: "title", label: "Title" },
  { key: "slug", label: "Slug" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created" },
  { key: "updated_at", label: "Updated" },
];

export default function EntryViews() {
  const params = useParams();
  const navigate = useNavigate();

  // stages: selecting content type, selecting a view, editing a view
  const [stage, setStage] = useState("types"); // 'types' | 'views' | 'edit'

  // All content types
  const [contentTypes, setContentTypes] = useState([]);
  // Selected content type ID (slug or id)
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [contentTypeDetail, setContentTypeDetail] = useState(null);

  // All editor views for the selected type
  const [views, setViews] = useState([]);
  // Current view slug being edited
  const [activeViewSlug, setActiveViewSlug] = useState("");

  // Form state for editing/creating a view
  const [currentLabel, setCurrentLabel] = useState("");
  const [assignedRoles, setAssignedRoles] = useState([]);
  const [defaultRoles, setDefaultRoles] = useState([]);
  const [adminOnly, setAdminOnly] = useState(false);
  const [sections, setSections] = useState([]); // widgets
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);

  // Available roles (loaded from /api/roles)
  const [allRoles, setAllRoles] = useState(["ADMIN"]);

  // Available custom fields for this content type (built‑ins removed)
  const [availableFields, setAvailableFields] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  // Sync stage and selection from URL params
  useEffect(() => {
    const typeSlug = params.typeSlug || params.typeId;
    const viewSlug = params.viewSlug || "";
    if (!typeSlug) {
      setStage("types");
      setSelectedTypeId("");
      setActiveViewSlug("");
      return;
    }
    setSelectedTypeId(typeSlug);
    if (viewSlug) {
      setStage("edit");
      setActiveViewSlug(viewSlug);
    } else {
      setStage("views");
      setActiveViewSlug("");
    }
  }, [params.typeId, params.typeSlug, params.viewSlug]);

  // Load content types and roles on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingTypes(true);
        // Load all roles (optional)
        try {
          const rolesRes = await api.get("/api/roles");
          const raw = rolesRes?.data || rolesRes || [];
          if (Array.isArray(raw) && raw.length) {
            const roleList = raw
              .map((r) => (r.slug || r.name || r.role || "").toUpperCase())
              .filter(Boolean);
            if (roleList.length) setAllRoles(roleList);
          }
        } catch {
          // ignore
        }
        const res = await api.get("/api/content-types");
        const list = Array.isArray(res) ? res : res?.data || [];
        // sort by name
        list.sort((a, b) => {
          const an = (a.name || a.slug || "").toLowerCase();
          const bn = (b.name || b.slug || "").toLowerCase();
          return an.localeCompare(bn);
        });
        if (!cancelled) {
          setContentTypes(list);
          // If nothing selected and no param, auto choose first
          const hasParam = params.typeSlug || params.typeId;
          if (list.length && !hasParam && !selectedTypeId) {
            navigate(`/admin/settings/entry-views/${list[0].id}`);
          }
        }
      } catch (err) {
        if (!cancelled) setError("Failed to load content types");
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute available fields from content type: exclude built‑ins
  const computeAvailableFields = (ct) => {
    if (!ct || !Array.isArray(ct.fields)) return [];
    return ct.fields
      .map((f) => {
        const key = f.key || f.field_key;
        return key
          ? {
              key,
              label: f.label || f.name || key,
            }
          : null;
      })
      .filter(Boolean);
  };

  // Load content type detail and editor views whenever selectedTypeId changes
  useEffect(() => {
    if (!selectedTypeId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        setSaveMessage("");
        setDirty(false);
        // fetch content type detail
        const ctRes = await api.get(`/api/content-types/${selectedTypeId}`);
        const ct = ctRes?.data || ctRes || null;
        if (cancelled) return;
        setContentTypeDetail(ct);
        // compute available fields
        const av = computeAvailableFields(ct);
        setAvailableFields(av);
        // fetch editor views
        const viewsRes = await api.get(
          `/api/content-types/${selectedTypeId}/editor-views?all=true&_=${Date.now()}`,
        );
        const rawViews = viewsRes?.data || viewsRes || [];
        const loadedViews = Array.isArray(rawViews)
          ? rawViews
          : rawViews?.views || [];
        if (cancelled) return;
        setViews(loadedViews);
        // If we have a view slug in URL, load that view; otherwise stay in views stage
        if (activeViewSlug) {
          const found = loadedViews.find((v) => v.slug === activeViewSlug);
          if (found) {
            loadViewForEdit(found, av);
          }
        } else {
          // reset form state when switching content types
          setCurrentLabel("");
          setAssignedRoles(["ADMIN"]);
          setDefaultRoles([]);
          setAdminOnly(false);
          setSections([]);
          setSelectedSectionIndex(0);
          setDirty(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to load editor views");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTypeId, activeViewSlug]);

  // Helper: load a view into form state for editing
  const loadViewForEdit = (view, av) => {
    if (!view) return;
    setActiveViewSlug(view.slug);
    setCurrentLabel(view.label || view.slug);
    // roles
    const cfgRoles = Array.isArray(view?.config?.roles)
      ? view.config.roles.map((r) => String(r || "").toUpperCase())
      : view.role
      ? [String(view.role || "").toUpperCase()]
      : [];
    setAssignedRoles(cfgRoles);
    const cfgDefaults = Array.isArray(view?.config?.default_roles)
      ? view.config.default_roles.map((r) => String(r || "").toUpperCase())
      : [];
    setDefaultRoles(cfgDefaults);
    // adminOnly: if only ADMIN in roles
    const nonAdmin = cfgRoles.filter((r) => r.toUpperCase() !== "ADMIN");
    setAdminOnly(nonAdmin.length === 0);
    // sections
    const secs = Array.isArray(view?.config?.sections)
      ? view.config.sections.map((s, idx) => {
          return {
            id: s.id || `widget-${idx + 1}`,
            title: s.title || `Widget ${idx + 1}`,
            description: s.description || "",
            layout: s.layout || "one-column",
            fields: Array.isArray(s.fields)
              ? s.fields
                  .map((f) => (typeof f === "string" ? f : f.key))
                  .filter((k) => !BUILTIN_FIELDS.some((b) => b.key === k))
              : [],
          };
        })
      : [];
    setSections(secs);
    setSelectedSectionIndex(0);
    setDirty(false);
  };

  // Derived: fields that are not yet assigned to any section
  const unassignedFields = useMemo(() => {
    const assignedKeys = new Set();
    for (const sec of sections) {
      for (const fk of sec.fields) assignedKeys.add(fk);
    }
    return availableFields.filter((f) => !assignedKeys.has(f.key));
  }, [availableFields, sections]);

  // Role toggles
  const toggleAssignedRole = (roleValue) => {
    const upper = roleValue.toUpperCase();
    if (adminOnly) {
      setAdminOnly(false);
    }
    setAssignedRoles((prev) => {
      const exists = prev.includes(upper);
      let next;
      if (exists) {
        // remove
        next = prev.filter((r) => r !== upper);
        // also remove from defaults
        setDefaultRoles((defPrev) => defPrev.filter((r) => r !== upper));
      } else {
        next = [...prev, upper];
      }
      return next;
    });
    setDirty(true);
  };

  const toggleAdminOnly = () => {
    if (!adminOnly) {
      setAdminOnly(true);
      setAssignedRoles([]);
      setDefaultRoles([]);
    } else {
      setAdminOnly(false);
    }
    setDirty(true);
  };

  const toggleDefaultRole = (roleValue) => {
    const upper = roleValue.toUpperCase();
    setDefaultRoles((prev) => {
      const exists = prev.includes(upper);
      let next;
      if (exists) {
        next = prev.filter((r) => r !== upper);
      } else {
        next = [...prev, upper];
      }
      return next;
    });
    setDirty(true);
  };

  // Section (widget) helpers
  const addSection = () => {
    setSections((prev) => {
      const index = prev.length + 1;
      return [
        ...prev,
        {
          id: `widget-${index}`,
          title: `Widget ${index}`,
          description: "",
          layout: "one-column",
          fields: [],
        },
      ];
    });
    setSelectedSectionIndex(sections.length);
    setDirty(true);
  };

  const removeSection = (idx) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev; // do not remove last
      const removed = prev[idx];
      const rest = prev.filter((_, i) => i !== idx);
      // move removed fields back to unassigned by simply not including them
      // in any section; unassignedFields will pick them up
      return rest;
    });
    setSelectedSectionIndex((prev) => (prev > 0 ? prev - 1 : 0));
    setDirty(true);
  };

  const moveSection = (idx, direction) => {
    setSections((prev) => {
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[target];
      next[target] = tmp;
      return next;
    });
    setSelectedSectionIndex((prev) => {
      const target = direction === "up" ? prev - 1 : prev + 1;
      return target;
    });
    setDirty(true);
  };

  const updateSection = (idx, field, value) => {
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

  const addFieldToSection = (fieldKey, sectionIdx) => {
    if (!fieldKey) return;
    setSections((prev) => {
      const next = [...prev];
      if (!next[sectionIdx].fields.includes(fieldKey)) {
        next[sectionIdx].fields = [...next[sectionIdx].fields, fieldKey];
      }
      return next;
    });
    setDirty(true);
  };

  const removeFieldFromSection = (fieldKey, sectionIdx) => {
    setSections((prev) => {
      const next = [...prev];
      next[sectionIdx].fields = next[sectionIdx].fields.filter((f) => f !== fieldKey);
      return next;
    });
    setDirty(true);
  };

  const moveFieldWithinSection = (fieldKey, sectionIdx, direction) => {
    setSections((prev) => {
      const next = [...prev];
      const list = next[sectionIdx].fields;
      const idx = list.indexOf(fieldKey);
      if (idx === -1) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= list.length) return prev;
      const tmp = list[idx];
      list[idx] = list[target];
      list[target] = tmp;
      next[sectionIdx].fields = [...list];
      return next;
    });
    setDirty(true);
  };

  // Handlers for selecting type and view
  const handleSelectType = (val) => {
    if (!val) return;
    navigate(`/admin/settings/entry-views/${val}`);
  };

  const handleSelectView = (slug) => {
    if (!slug) return;
    navigate(`/admin/settings/entry-views/${selectedTypeId}/${slug}`);
  };

  const handleNewView = () => {
    if (!selectedTypeId) return;
    // create a unique slug
    const baseLabel = "New editor";
    let label = baseLabel;
    let suffix = 1;
    const existing = views.map((v) => (v.label || v.slug || "").toLowerCase());
    while (existing.includes(label.toLowerCase())) {
      suffix += 1;
      label = `${baseLabel} ${suffix}`;
    }
    const slug = slugify(label);
    // Prepare new view state
    setCurrentLabel(label);
    setAssignedRoles(["ADMIN"]);
    setDefaultRoles(["ADMIN"]);
    setAdminOnly(false);
    setSections([
      {
        id: "widget-1",
        title: "Widget 1",
        description: "",
        layout: "one-column",
        fields: [],
      },
    ]);
    setSelectedSectionIndex(0);
    setActiveViewSlug(slug);
    setStage("edit");
    setDirty(true);
    navigate(`/admin/settings/entry-views/${selectedTypeId}/${slug}`);
  };

  // Save view configuration
  const handleSave = async () => {
    if (!currentLabel.trim()) {
      setError("Label is required");
      return;
    }
    const slug = slugify(currentLabel);
    // ensure unique slug
    const dup = views.find(
      (v) => v.slug && v.slug.toLowerCase() === slug.toLowerCase() && v.slug !== activeViewSlug,
    );
    if (dup) {
      setError(
        `A view with the slug "${slug}" already exists. Please choose a different label or slug.`,
      );
      return;
    }
    // Build payload
    const rolesSet = new Set(assignedRoles.map((r) => r.toUpperCase()));
    rolesSet.add("ADMIN");
    const rolesArray = Array.from(rolesSet);
    const defaults = defaultRoles.map((r) => r.toUpperCase());
    // Compile sections: filter out empty and remove built‑ins
    const payloadSections = sections
      .map((sec) => {
        const customFields = sec.fields.filter(
          (k) => !BUILTIN_FIELDS.some((b) => b.key === k),
        );
        return {
          id: sec.id,
          title: sec.title,
          description: sec.description,
          layout: sec.layout,
          fields: customFields,
        };
      })
      .filter((s) => s.fields.length);
    if (payloadSections.length === 0) {
      setError("Please add at least one widget with a field");
      return;
    }
    const payload = {
      slug,
      label: currentLabel,
      roles: rolesArray,
      default_roles: defaults,
      sections: payloadSections,
    };
    try {
      setLoading(true);
      setError("");
      setSaveMessage("");
      await api.put(`/api/content-types/${selectedTypeId}/editor-view`, payload);
      // reload views
      const res = await api.get(
        `/api/content-types/${selectedTypeId}/editor-views?all=true&_=${Date.now()}`,
      );
      const raw = res?.data || res || [];
      const newViews = Array.isArray(raw) ? raw : raw.views || [];
      setViews(newViews);
      // update active view
      const newly = newViews.find((v) => v.slug === slug) || null;
      if (newly) {
        setActiveViewSlug(newly.slug);
        setCurrentLabel(newly.label);
        // update roles/defaults from newly saved
        const cfgRoles = Array.isArray(newly?.config?.roles)
          ? newly.config.roles.map((r) => String(r || "").toUpperCase())
          : newly.role
          ? [String(newly.role || "").toUpperCase()]
          : [];
        setAssignedRoles(cfgRoles);
        const cfgDefaults = Array.isArray(newly?.config?.default_roles)
          ? newly.config.default_roles.map((r) => String(r || "").toUpperCase())
          : [];
        setDefaultRoles(cfgDefaults);
        const nonAdminAfter = cfgRoles.filter((r) => r.toUpperCase() !== "ADMIN");
        setAdminOnly(nonAdminAfter.length === 0);
        const secs = Array.isArray(newly?.config?.sections)
          ? newly.config.sections.map((s, idx) => {
              return {
                id: s.id || `widget-${idx + 1}`,
                title: s.title || `Widget ${idx + 1}`,
                description: s.description || "",
                layout: s.layout || "one-column",
                fields: Array.isArray(s.fields)
                  ? s.fields
                      .map((f) => (typeof f === "string" ? f : f.key))
                      .filter((k) => !BUILTIN_FIELDS.some((b) => b.key === k))
                  : [],
              };
            })
          : [];
        setSections(secs);
        setSelectedSectionIndex(0);
      }
      setDirty(false);
      setSaveMessage("View saved.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save view");
    } finally {
      setLoading(false);
    }
  };

  // Delete view
  const handleDelete = async () => {
    if (!activeViewSlug) return;
    if (!window.confirm("Delete this entry editor view?")) return;
    try {
      setLoading(true);
      await api.delete(
        `/api/content-types/${selectedTypeId}/editor-view/${activeViewSlug}`,
      );
      const remaining = views.filter((v) => v.slug !== activeViewSlug);
      setViews(remaining);
      setActiveViewSlug("");
      setCurrentLabel("");
      setAssignedRoles(["ADMIN"]);
      setDefaultRoles([]);
      setAdminOnly(false);
      setSections([]);
      setSelectedSectionIndex(0);
      setDirty(false);
      setSaveMessage("");
      navigate(`/admin/settings/entry-views/${selectedTypeId}`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete view");
    } finally {
      setLoading(false);
    }
  };

  // Rendering helpers
  const renderTypeStage = () => (
    <div className="su-card">
      <div className="su-card-body su-flex su-flex-wrap su-gap-sm">
        {contentTypes.map((ct) => (
          <button
            key={ct.id}
            className={
              "su-chip" + (ct.id == selectedTypeId ? " su-chip--active" : "")
            }
            onClick={() => handleSelectType(ct.id)}
          >
            {ct.name || ct.label || ct.slug}
          </button>
        ))}
      </div>
    </div>
  );

  const renderViewsStage = () => (
    <>
      <div className="su-card su-mb-md">
        <div className="su-card-body su-flex su-flex-wrap su-gap-sm su-items-center">
          <span className="su-text-sm su-text-muted">Views:</span>
          {views.map((v) => {
            const cfg = v.config || {};
            const dRoles = Array.isArray(cfg.default_roles)
              ? cfg.default_roles.map((r) => String(r || "").toUpperCase())
              : [];
            const isDef = dRoles.includes("ADMIN") || !!v.is_default;
            return (
              <button
                key={v.slug}
                className={
                  "su-chip" + (v.slug === activeViewSlug ? " su-chip--active" : "")
                }
                onClick={() => handleSelectView(v.slug)}
              >
                {v.label || v.slug}
                {isDef && <span className="su-chip-badge">default</span>}
              </button>
            );
          })}
          <button className="su-chip" onClick={handleNewView}>
            + New editor view
          </button>
        </div>
      </div>
      <div className="su-card">
        <div className="su-card-body">
          <p className="su-text-sm su-text-muted">
            Choose an existing view or create a new one to configure which fields appear in the
            entry editor.
          </p>
        </div>
      </div>
    </>
  );

  const renderEditStage = () => {
    // Section controls UI
    const renderSectionList = () => (
      <div className="su-space-y-sm">
        {sections.map((sec, idx) => (
          <div
            key={sec.id}
            className={
              "su-card" + (idx === selectedSectionIndex ? " su-card--active" : "")
            }
            style={{ padding: "0.5rem" }}
          >
            <div className="su-flex su-justify-between su-items-center">
              <div
                className="su-flex su-flex-col"
                style={{ flex: 1, cursor: "pointer" }}
                onClick={() => setSelectedSectionIndex(idx)}
              >
                <strong>{sec.title || `Widget ${idx + 1}`}</strong>
                <small className="su-text-xs su-text-muted">
                  {sec.fields.length} field{sec.fields.length !== 1 ? "s" : ""}
                </small>
              </div>
              <div className="su-flex su-gap-xs">
                <button
                  className="su-icon-btn"
                  onClick={() => moveSection(idx, "up")}
                  disabled={idx === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  className="su-icon-btn"
                  onClick={() => moveSection(idx, "down")}
                  disabled={idx === sections.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  className="su-icon-btn"
                  onClick={() => removeSection(idx)}
                  disabled={sections.length <= 1}
                  title="Delete widget"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
        <button className="su-btn su-btn-secondary su-w-full" onClick={addSection}>
          + Add widget
        </button>
      </div>
    );

    // Selected section details
    const renderSelectedSection = () => {
      const sec = sections[selectedSectionIndex];
      if (!sec) return null;
      return (
        <div className="su-space-y-md">
          <div>
            <label className="su-form-label">Widget title</label>
            <input
              className="su-input"
              value={sec.title || ""}
              onChange={(e) => updateSection(selectedSectionIndex, "title", e.target.value)}
            />
          </div>
          <div>
            <label className="su-form-label">Description (optional)</label>
            <textarea
              className="su-input"
              value={sec.description || ""}
              onChange={(e) => updateSection(selectedSectionIndex, "description", e.target.value)}
            />
          </div>
          <div>
            <label className="su-form-label">Layout</label>
            <select
              className="su-input"
              value={sec.layout || "one-column"}
              onChange={(e) => updateSection(selectedSectionIndex, "layout", e.target.value)}
            >
              <option value="one-column">One column</option>
              <option value="two-column">Two columns</option>
            </select>
          </div>
          {/* Fields management for this section */}
          <div>
            <h4 className="su-text-sm su-font-semibold">Fields in this widget</h4>
            {sec.fields.length === 0 && (
              <p className="su-text-xs su-text-muted">No fields assigned.</p>
            )}
            <div className="su-space-y-xs">
              {sec.fields.map((fk, idx) => {
                const fieldDef = availableFields.find((f) => f.key === fk);
                const label = fieldDef ? fieldDef.label || fk : fk;
                return (
                  <div key={fk} className="su-chip su-w-full su-justify-between">
                    <span>{label}</span>
                    <span className="su-flex su-gap-xs">
                      <button
                        className="su-icon-btn"
                        onClick={() => moveFieldWithinSection(fk, selectedSectionIndex, "up")}
                        disabled={idx === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="su-icon-btn"
                        onClick={() => moveFieldWithinSection(fk, selectedSectionIndex, "down")}
                        disabled={idx === sec.fields.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        className="su-icon-btn"
                        onClick={() => removeFieldFromSection(fk, selectedSectionIndex)}
                        title="Remove field"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h4 className="su-text-sm su-font-semibold">Unassigned fields</h4>
            {unassignedFields.length === 0 && (
              <p className="su-text-xs su-text-muted">All fields assigned.</p>
            )}
            <div className="su-space-y-xs">
              {unassignedFields.map((f) => (
                <button
                  key={f.key}
                  className="su-chip su-w-full su-justify-between"
                  onClick={() => addFieldToSection(f.key, selectedSectionIndex)}
                >
                  {f.label || f.key}
                  <span className="su-chip-badge">Add</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    };

    return (
      <>
        <div className="su-card su-mb-md">
          <div className="su-card-body">
            <button
              type="button"
              className="su-chip"
              onClick={() => {
                // back to views list
                navigate(`/admin/settings/entry-views/${selectedTypeId}`);
              }}
            >
              ← Back
            </button>
          </div>
        </div>
        <div className="su-grid md:grid-cols-2 gap-md">
          {/* Left column: view metadata */}
          <div className="su-card">
            <div className="su-card-body su-space-y-md">
              <div>
                <label className="su-form-label">Label</label>
                <input
                  className="su-input"
                  value={currentLabel}
                  onChange={(e) => {
                    setCurrentLabel(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <label className="su-form-label">Slug</label>
                <input
                  className="su-input"
                  value={activeViewSlug}
                  onChange={(e) => {
                    setActiveViewSlug(slugify(e.target.value));
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <label className="su-form-label">Assigned roles</label>
                <div className="su-flex su-flex-wrap su-gap-sm">
                  {allRoles.map((r) => (
                    <label key={r} className="su-chip su-items-center su-gap-xs">
                      <input
                        type="checkbox"
                        checked={assignedRoles.includes(r)}
                        onChange={() => toggleAssignedRole(r)}
                      />
                      {r}
                    </label>
                  ))}
                  <label className="su-chip su-items-center su-gap-xs">
                    <input
                      type="checkbox"
                      checked={adminOnly}
                      onChange={toggleAdminOnly}
                    />
                    Admin only
                  </label>
                </div>
              </div>
              <div>
                <label className="su-form-label">Default roles</label>
                <div className="su-flex su-flex-wrap su-gap-sm">
                  {assignedRoles
                    .filter((r) => !adminOnly || r === "ADMIN")
                    .map((r) => (
                      <label
                        key={r}
                        className="su-chip su-items-center su-gap-xs"
                      >
                        <input
                          type="checkbox"
                          checked={defaultRoles.includes(r)}
                          onChange={() => toggleDefaultRole(r)}
                        />
                        {r}
                      </label>
                    ))}
                </div>
              </div>
              <div>
                <small className="su-text-xs su-text-muted">
                  Slug preview: /admin/content/{contentTypeDetail?.slug || contentTypeDetail?.key || selectedTypeId}/
                  <strong>{activeViewSlug || slugify(currentLabel || "view")}</strong>
                </small>
              </div>
              <div className="su-flex su-gap-sm">
                <button
                  className="su-btn su-btn-primary"
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || loading}
                >
                  {loading ? "Saving…" : "Save"}
                </button>
                {activeViewSlug && (
                  <button
                    className="su-btn su-btn-error"
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    Delete
                  </button>
                )}
                {saveMessage && (
                  <span className="su-text-xs su-text-success">{saveMessage}</span>
                )}
              </div>
              {error && (
                <div className="su-alert su-alert-danger su-mt-sm">{error}</div>
              )}
            </div>
          </div>
          {/* Right column: widget builder */}
          <div className="su-grid md:grid-cols-2 gap-md">
            {/* List of widgets */}
            <div className="">
              <h3 className="su-card-title su-mb-sm">Widgets</h3>
              {renderSectionList()}
            </div>
            {/* Selected widget details */}
            <div className="">
              <h3 className="su-card-title su-mb-sm">
                {sections[selectedSectionIndex]?.title || `Widget ${selectedSectionIndex + 1}`}
              </h3>
              {renderSelectedSection()}
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="su-page">
      <div className="su-page-header su-flex su-justify-between su-items-center su-mb-md">
        <h1 className="su-page-title">Entry Editor Views</h1>
        <p className="su-page-subtitle">
          Configure the entry editor for your content types.
        </p>
      </div>
      {loadingTypes ? (
        <p>Loading…</p>
      ) : stage === "types" ? (
        renderTypeStage()
      ) : stage === "views" ? (
        renderViewsStage()
      ) : (
        renderEditStage()
      )}
    </div>
  );
}