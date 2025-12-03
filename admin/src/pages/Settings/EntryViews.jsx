import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

/*
 * EntryViews.jsx
 *
 * This settings page allows administrators to configure the layout of the entry
 * editor for each content type. It is intentionally modelled off of the
 * ListViews settings page so you get the same capabilities: multiple role
 * assignment, admin‑only toggling, default roles, slug handling and
 * refresh‑stable routing. Rather than configuring list columns, we allow
 * choosing and ordering which fields appear in the entry editor. The
 * configuration is persisted via the entry‑views API in a single row per view
 * with `roles`, `default_roles` and `sections` arrays.
 */

// Simple slugify for view slugs. Mirrors the slugify in ListViews.jsx.
function slugify(str) {
  return (str || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Built‑in fields that exist on every entry. We mirror the list view built‑ins.
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

  // Top‑level state. The stages mirror the ListViews page: selecting a type,
  // selecting/creating a view for that type, then editing the view.
  const [stage, setStage] = useState("types"); // 'types' | 'views' | 'edit'
  const [contentTypes, setContentTypes] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");

  // The role dropdown is still present to filter views when loading, but
  // assignment is multi‑select via checkboxes like ListViews.
  const [role, setRole] = useState("ADMIN");
  const [allRoles, setAllRoles] = useState(["ADMIN", "EDITOR", "AUTHOR", "VIEWER"]);
  const [assignedRoles, setAssignedRoles] = useState(["ADMIN"]);
  const [defaultRoles, setDefaultRoles] = useState([]);
  const [adminOnly, setAdminOnly] = useState(false);
  const isAdminOnly = adminOnly;

  // List of views for the selected type. Each view is a single row with
  // `slug`, `label`, and `config` containing `roles`, `default_roles` and
  // `sections` (for entry editor layout).
  const [views, setViews] = useState([]);
  const [activeViewSlug, setActiveViewSlug] = useState("");
  const [currentLabel, setCurrentLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  // Fields chosen for the editor layout. Each entry is { key, label }.
  const [fields, setFields] = useState([]);
  const [availableFields, setAvailableFields] = useState([]);
  const [contentTypeDetail, setContentTypeDetail] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  // Sync stage and selection from the URL params. We support either a
  // `:typeSlug` or `:typeId` parameter to identify the content type and an
  // optional `:viewSlug` parameter to edit a specific view.
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

  // Load content types and available roles on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingTypes(true);
        // Fetch roles first; fall back to defaults on error.
        try {
          const rolesRes = await api.get("/api/roles");
          const rawRoles = rolesRes?.data || rolesRes || [];
          if (Array.isArray(rawRoles) && rawRoles.length) {
            const extracted = rawRoles
              .map((r) => (r.slug || r.name || r.role || "").toUpperCase())
              .filter(Boolean);
            if (extracted.length) {
              setAllRoles(extracted);
            }
          }
        } catch (_err) {
          // ignore; use defaults
        }
        const res = await api.get("/api/content-types");
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res?.data || [];
        // sort by name for predictable order
        list.sort((a, b) => {
          const an = (a.name || a.slug || "").toLowerCase();
          const bn = (b.name || b.slug || "").toLowerCase();
          return an.localeCompare(bn);
        });
        setContentTypes(list);
        // If nothing selected and no URL param, choose the first type.
        const hasParam = params?.typeSlug || params?.typeId;
        if (list.length && !hasParam && !selectedTypeId) {
          setSelectedTypeId(list[0].id);
        }
      } catch (err) {
        console.error("[EntryViews] failed to load content types", err);
        if (!cancelled) {
          setError("Failed to load content types");
        }
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute available fields for a given content type. We reuse built‑ins and
  // combine them with the custom fields of the type, ensuring no duplicates.
  const computeAvailableFields = (ct) => {
    if (!ct) return BUILTIN_FIELDS;
    const ctFields = Array.isArray(ct.fields)
      ? ct.fields.map((f) => {
          const fieldKey = f.key || f.field_key;
          return {
            key: fieldKey,
            label: f.label || f.name || fieldKey,
          };
        })
      : [];
    const all = [...BUILTIN_FIELDS];
    for (const f of ctFields) {
      if (!all.find((x) => x.key === f.key)) {
        all.push(f);
      }
    }
    return all;
  };

  // Load views and content type details whenever the selected type or role changes.
  useEffect(() => {
    if (!selectedTypeId || !role) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        setSaveMessage("");
        setDirty(false);

        const [ctRes, viewsRes] = await Promise.all([
          api.get(`/api/content-types/${selectedTypeId}`),
          api.get(
            `/api/content-types/${selectedTypeId}/editor-views?all=true&_=${Date.now()}`,
          ),
        ]);
        if (cancelled) return;
        const ct = ctRes?.data || ctRes || null;
        setContentTypeDetail(ct);
        const av = computeAvailableFields(ct);
        setAvailableFields(av);
        // normalize views response
        const rawViews = viewsRes?.data || viewsRes || [];
        let loaded = [];
        if (Array.isArray(rawViews)) {
          loaded = rawViews;
        } else if (rawViews && Array.isArray(rawViews.views)) {
          loaded = rawViews.views;
        }
        setViews(loaded);
        // Pick default or first view
        if (loaded.length === 0) {
          // no saved views: synthesize default layout using all fields
          const defaultFields = av.slice(0, 3); // choose three default fields
          setActiveViewSlug("default");
          setCurrentLabel("Default editor");
          setIsDefault(true);
          setFields(defaultFields);
          setAssignedRoles([role.toUpperCase()]);
          setDefaultRoles([role.toUpperCase()]);
          setAdminOnly(false);
          setDirty(false);
        } else {
          const def = loaded.find((v) => v.is_default) || loaded[0];
          setActiveViewSlug(def.slug);
          setCurrentLabel(def.label);
          const cfgRoles = Array.isArray(def?.config?.roles)
            ? def.config.roles.map((r) => String(r || "").toUpperCase())
            : def.role
            ? [String(def.role || "").toUpperCase()]
            : [];
          setAssignedRoles(cfgRoles);
          const cfgDefault = Array.isArray(def?.config?.default_roles)
            ? def.config.default_roles.map((r) => String(r || "").toUpperCase())
            : [];
          setDefaultRoles(cfgDefault);
          setIsDefault(cfgDefault.includes(role.toUpperCase()) || !!def.is_default);
          // Flatten fields: use first section or fallback to built‑ins
          const sect = Array.isArray(def?.config?.sections) && def.config.sections.length
            ? def.config.sections[0]
            : null;
          const fldKeys = sect && Array.isArray(sect.fields)
            ? sect.fields.map((f) => (typeof f === "string" ? f : f.key))
            : [];
          const flds = av.filter((f) => fldKeys.includes(f.key));
          setFields(flds.length ? flds : av.slice(0, 3));
          setAdminOnly(false);
          // Determine adminOnly: if no roles besides ADMIN, mark as admin only.
          const nonAdminRoles = cfgRoles.filter((r) => r.toUpperCase() !== "ADMIN");
          setAdminOnly(nonAdminRoles.length === 0);
        }
      } catch (err) {
        console.error("[EntryViews] load error", err);
        if (!cancelled) {
          setError("Failed to load editor views");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTypeId, role]);

  // Derived: active view object
  const activeView = useMemo(() => {
    if (!views || !views.length) return null;
    return views.find((v) => v.slug === activeViewSlug) || null;
  }, [views, activeViewSlug]);

  // Handlers -------------------------------------------------------
  const handleSelectType = (val) => {
    if (!val) return;
    navigate(`/admin/settings/entry-views/${val}`);
  };

  const handleSelectRole = (e) => {
    setRole(e.target.value);
  };

  const handleSelectView = (slug) => {
    if (!views || !views.length) return;
    const v = views.find((x) => x.slug === slug);
    if (!v) return;
    setActiveViewSlug(slug);
    setCurrentLabel(v.label);
    const vRoles = Array.isArray(v?.config?.roles)
      ? v.config.roles.map((r) => String(r || "").toUpperCase())
      : v.role
      ? [String(v.role || "").toUpperCase()]
      : [];
    setAssignedRoles(vRoles);
    const vDefault = Array.isArray(v?.config?.default_roles)
      ? v.config.default_roles.map((r) => String(r || "").toUpperCase())
      : [];
    setDefaultRoles(vDefault);
    setIsDefault(vDefault.includes(role.toUpperCase()) || !!v.is_default);
    // fields
    const sect = Array.isArray(v?.config?.sections) && v.config.sections.length
      ? v.config.sections[0]
      : null;
    const keys = sect && Array.isArray(sect.fields)
      ? sect.fields.map((f) => (typeof f === "string" ? f : f.key))
      : [];
    const flds = availableFields.filter((f) => keys.includes(f.key));
    setFields(flds);
    const nonAdmin = vRoles.filter((r) => r !== "ADMIN");
    setAdminOnly(nonAdmin.length === 0);
    setDirty(false);
    setSaveMessage("");
    setError("");
    navigate(`/admin/settings/entry-views/${selectedTypeId}/${slug}`);
  };

  const handleNewView = () => {
    const baseLabel = "New editor";
    let label = baseLabel;
    let suffix = 1;
    const existingLabels = (views || []).map((v) => (v.label || "").toLowerCase());
    while (existingLabels.includes(label.toLowerCase())) {
      suffix += 1;
      label = `${baseLabel} ${suffix}`;
    }
    const slug = slugify(label);
    setActiveViewSlug(slug);
    setCurrentLabel(label);
    setIsDefault(false);
    setAssignedRoles([role.toUpperCase()]);
    setDefaultRoles([role.toUpperCase()]);
    // choose default fields
    if (!fields || !fields.length) {
      const defaults = availableFields.slice(0, 3);
      setFields(defaults);
    }
    setDirty(true);
    setSaveMessage("");
    setError("");
    navigate(`/admin/settings/entry-views/${selectedTypeId}/${slug}`);
  };

  const handleLabelChange = (e) => {
    const val = e.target.value;
    setCurrentLabel(val);
    if (!activeView || activeView.slug === "default") {
      setActiveViewSlug(slugify(val || "view"));
    }
    setDirty(true);
  };

  const handleAddField = (fieldKey) => {
    const field = availableFields.find((f) => f.key === fieldKey);
    if (!field) return;
    if (fields.find((c) => c.key === field.key)) return;
    setFields((prev) => [...prev, { key: field.key, label: field.label }]);
    setDirty(true);
  };

  const handleRemoveField = (fieldKey) => {
    setFields((prev) => prev.filter((c) => c.key !== fieldKey));
    setDirty(true);
  };

  const moveField = (fieldKey, direction) => {
    setFields((prev) => {
      const idx = prev.findIndex((c) => c.key === fieldKey);
      if (idx === -1) return prev;
      const next = [...prev];
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[target];
      next[target] = tmp;
      return next;
    });
    setDirty(true);
  };

  const toggleAssignedRole = (roleValue) => {
    const upper = roleValue.toUpperCase();
    if (adminOnly) {
      setAdminOnly(false);
    }
    setAssignedRoles((prev) => {
      const exists = prev.includes(upper);
      if (exists) {
        setDefaultRoles((dprev) => {
          const newList = dprev.filter((r) => r !== upper);
          setIsDefault(newList.includes(role.toUpperCase()));
          return newList;
        });
        return prev.filter((r) => r !== upper);
      }
      return [...prev, upper];
    });
    setDirty(true);
  };

  const toggleAdminOnly = () => {
    if (!adminOnly) {
      setAdminOnly(true);
      setAssignedRoles([]);
      setDefaultRoles((prev) => prev.filter((r) => r.toUpperCase() === "ADMIN"));
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
      setIsDefault(next.includes(role.toUpperCase()));
      return next;
    });
    setDirty(true);
  };

  // Save view configuration
  const handleSave = async () => {
    if (!currentLabel.trim()) {
      setError("Label is required");
      return;
    }
    const slug = slugify(currentLabel);
    // Validate fields
    if (!fields || !fields.length) {
      setError("Please choose at least one field");
      return;
    }
    // Prevent duplicate slug for another view
    const dup = (views || []).find(
      (v) => v.slug && v.slug.toLowerCase() === slug.toLowerCase() && v.slug !== activeViewSlug,
    );
    if (dup) {
      setError(
        `A view with the slug "${slug}" already exists. Please choose a different label or slug.`,
      );
      return;
    }
    try {
      setLoading(true);
      const rolesSet = new Set(assignedRoles.map((r) => r.toUpperCase()));
      rolesSet.add("ADMIN");
      const rolesArray = Array.from(rolesSet);
      const effectiveDefaults = defaultRoles.map((r) => r.toUpperCase());
      // Build sections config: one section with all selected fields
      const section = {
        id: "main",
        title: "Main",
        fields: fields.map((f) => f.key),
      };
      const payload = {
        slug,
        label: currentLabel,
        roles: rolesArray,
        default_roles: effectiveDefaults,
        sections: [section],
      };
      await api.put(
        `/api/content-types/${selectedTypeId}/editor-view`,
        payload,
      );
      // reload views
      try {
        const res = await api.get(
          `/api/content-types/${selectedTypeId}/editor-views?all=true&_=${Date.now()}`,
        );
        const raw = res?.data || res || [];
        let newViews;
        if (Array.isArray(raw)) {
          newViews = raw;
        } else if (raw && Array.isArray(raw.views)) {
          newViews = raw.views;
        } else {
          newViews = [];
        }
        setViews(newViews);
        const next = newViews.find((v) => v.slug === slug) || newViews[0] || null;
        if (next) {
          setActiveViewSlug(next.slug);
          setCurrentLabel(next.label);
          const cfgRoles = Array.isArray(next?.config?.roles)
            ? next.config.roles.map((r) => String(r || "").toUpperCase())
            : next.role
            ? [String(next.role || "").toUpperCase()]
            : [];
          setAssignedRoles(cfgRoles);
          const cfgDefault = Array.isArray(next?.config?.default_roles)
            ? next.config.default_roles.map((r) => String(r || "").toUpperCase())
            : [];
          setDefaultRoles(cfgDefault);
          setIsDefault(
            cfgDefault.includes(role.toUpperCase()) || !!next.is_default,
          );
          const sect2 = Array.isArray(next?.config?.sections) && next.config.sections.length
            ? next.config.sections[0]
            : null;
          const keys2 = sect2 && Array.isArray(sect2.fields)
            ? sect2.fields.map((f) => (typeof f === "string" ? f : f.key))
            : [];
          const flds2 = availableFields.filter((f) => keys2.includes(f.key));
          setFields(flds2);
          const nonAdmin2 = cfgRoles.filter((r) => r !== "ADMIN");
          setAdminOnly(nonAdmin2.length === 0);
        }
        setDirty(false);
        setSaveMessage("View saved.");
      } catch (_err) {
        // ignore reload failure
        setDirty(false);
        setSaveMessage("View saved.");
      }
    } catch (err) {
      console.error("[EntryViews] save error", err);
      setError(err.message || "Failed to save view");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!activeViewSlug) return;
    if (!window.confirm("Delete this entry editor view?")) return;
    try {
      setLoading(true);
      await api.delete(
        `/api/content-types/${selectedTypeId}/editor-view/${activeViewSlug}`,
      );
      // remove locally
      const nextViews = views.filter((v) => v.slug !== activeViewSlug);
      setViews(nextViews);
      // choose next view or go back to list
      if (nextViews.length) {
        const next = nextViews[0];
        handleSelectView(next.slug);
      } else {
        setActiveViewSlug("");
        setCurrentLabel("");
        setFields([]);
        setAssignedRoles([role.toUpperCase()]);
        setDefaultRoles([]);
        setAdminOnly(false);
        setDirty(false);
        setSaveMessage("");
        navigate(`/admin/settings/entry-views/${selectedTypeId}`);
      }
    } catch (err) {
      console.error("[EntryViews] delete error", err);
      setError(err.message || "Failed to delete view");
    } finally {
      setLoading(false);
    }
  };

  // UI rendering helpers ----------------------------------------------------
  const renderTypeStage = () => (
    <div className="su-card">
      <div className="su-card-body su-flex su-flex-wrap su-gap-sm">
        {contentTypes.map((ct) => (
          <button
            key={ct.id}
            className={
              "su-chip" + (ct.id === selectedTypeId ? " su-chip--active" : "")
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
            const isDef = dRoles.includes(role.toUpperCase()) || !!v.is_default;
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

  const renderEditStage = () => (
    <>
      <div className="su-card su-mb-md">
        <div className="su-card-body">
          <div className="su-flex su-gap-sm">
            <button
              type="button"
              className="su-chip"
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>
      <div className="su-grid md:grid-cols-2 gap-md">
        {/* Left column: details and roles */}
        <div className="su-card">
          <div className="su-card-body su-space-y-md">
            <div>
              <label className="su-form-label" htmlFor="view-label">
                Label
              </label>
              <input
                id="view-label"
                className="su-input"
                value={currentLabel}
                onChange={handleLabelChange}
              />
            </div>
            <div>
              <label className="su-form-label" htmlFor="view-slug">
                Slug
              </label>
              <input
                id="view-slug"
                className="su-input"
                value={activeViewSlug}
                onChange={(e) => setActiveViewSlug(slugify(e.target.value))}
                disabled={!!activeView && !!activeView.slug && activeView.slug !== "default"}
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
                    <label key={r} className="su-chip su-items-center su-gap-xs">
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
              {activeView && activeView.slug && activeView.slug !== "default" && (
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
        {/* Right column: field selection */}
        <div className="su-card">
          <div className="su-card-body">
            <h3 className="su-card-title">Fields</h3>
            <p className="su-text-sm su-text-muted">
              Choose which fields should appear in the entry editor. Drag to reorder.
            </p>
            <div className="su-grid md:grid-cols-2 gap-md su-mt-md">
              {/* Available fields */}
              <div>
                <h4 className="su-text-sm su-font-semibold">Available</h4>
                <div className="su-space-y-xs">
                  {availableFields
                    .filter((f) => !fields.find((c) => c.key === f.key))
                    .map((f) => (
                      <button
                        key={f.key}
                        className="su-chip su-w-full su-justify-between"
                        onClick={() => handleAddField(f.key)}
                      >
                        {f.label || f.key}
                        <span className="su-chip-badge">Add</span>
                      </button>
                    ))}
                </div>
              </div>
              {/* Selected fields */}
              <div>
                <h4 className="su-text-sm su-font-semibold">In view</h4>
                {fields.length === 0 && (
                  <p className="su-text-sm su-text-muted">No fields selected.</p>
                )}
                <div className="su-space-y-xs">
                  {fields.map((f, idx) => (
                    <div key={f.key} className="su-chip su-w-full su-justify-between">
                      <span>
                        <strong>{f.label || f.key}</strong>
                      </span>
                      <span className="su-flex su-gap-xs">
                        <button
                          className="su-icon-btn"
                          onClick={() => moveField(f.key, "up")}
                          disabled={idx === 0}
                        >
                          ↑
                        </button>
                        <button
                          className="su-icon-btn"
                          onClick={() => moveField(f.key, "down")}
                          disabled={idx === fields.length - 1}
                        >
                          ↓
                        </button>
                        <button className="su-icon-btn" onClick={() => handleRemoveField(f.key)}>
                          ✕
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="su-page">
      <div className="su-page-header su-flex su-justify-between su-items-center su-mb-md">
        <h1 className="su-page-title">Entry Editor Views</h1>
        <p className="su-page-subtitle">Configure the entry editor for your content types.</p>
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
