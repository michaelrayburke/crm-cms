import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

// Simple slugify for view slugs
function slugify(str) {
  return (str || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Built-in columns that exist on every entry
const BUILTIN_COLUMNS = [
  { key: "title", label: "Title" },
  { key: "slug", label: "Slug" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created" },
  { key: "updated_at", label: "Updated" },
];

export default function ListViewsSettings() {
  const [contentTypes, setContentTypes] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  // Role used for filtering list views when loading.  This is the single role
  // the admin is currently editing for.  We still support multiple roles
  // assigned to a single view via the `assignedRoles` state below.
  const [role, setRole] = useState("ADMIN");

  // Assigned roles for the current view being edited.  A view can be
  // associated with one or more roles.  When saving, this array is
  // passed as the `roles` field in the API payload.  If the view is
  // marked as default, the same list is used for `default_roles`.
  const [assignedRoles, setAssignedRoles] = useState(["ADMIN"]);

  const [contentTypeDetail, setContentTypeDetail] = useState(null);

  // All views for this type+role
  const [views, setViews] = useState([]);
  const [activeViewSlug, setActiveViewSlug] = useState("");
  const [currentLabel, setCurrentLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [columns, setColumns] = useState([]);

  const [availableFields, setAvailableFields] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  // List of all possible roles. We will fetch these from the API
  // (`/api/roles`) on mount. If the call fails, we fall back to the
  // default roles below. Each role is stored in uppercase.
  const [allRoles, setAllRoles] = useState(["ADMIN", "EDITOR", "AUTHOR", "VIEWER"]);

  // Default roles for this view. A view can be default for multiple
  // roles. When saving, this array is passed as `default_roles`.
  const [defaultRoles, setDefaultRoles] = useState([]);

  // ---------------------------------------------
  // Load content types on mount
  // ---------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingTypes(true);
        // Fetch available roles. If this call fails, we keep the
        // existing default roles. Roles endpoint should return an array
        // of role objects with a `slug` or `name` field.
        try {
          const rolesRes = await api.get("/api/roles");
          const rawRoles = rolesRes?.data || rolesRes || [];
          if (Array.isArray(rawRoles) && rawRoles.length) {
            const extracted = rawRoles.map((r) => (r.slug || r.name || r.role || "").toUpperCase()).filter(Boolean);
            if (extracted.length) {
              setAllRoles(extracted);
            }
          }
        } catch (_e) {
          // ignore errors; fallback to default roles
        }

        const res = await api.get("/api/content-types");
        if (cancelled) return;
        // API may return a plain array or an object with a `.data` property.
        const list = Array.isArray(res) ? res : res?.data || [];

        // predictable sort
        list.sort((a, b) => {
          const an = (a.name || a.slug || "").toLowerCase();
          const bn = (b.name || b.slug || "").toLowerCase();
          return an.localeCompare(bn);
        });

        setContentTypes(list);
        if (list.length && !selectedTypeId) {
          setSelectedTypeId(list[0].id);
        }
      } catch (err) {
        console.error("[ListViews] failed to load content types", err);
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
  }, []); // run once on mount

  // ---------------------------------------------
  // Build available fields = builtins + CT fields
  // ---------------------------------------------
  const computeAvailableFields = (ct) => {
    if (!ct) return BUILTIN_COLUMNS;
    const ctFields = Array.isArray(ct.fields)
      ? ct.fields.map((f) => {
          // Prefer f.key but fall back to f.field_key if present
          const fieldKey = f.key || f.field_key;
          return {
            key: fieldKey,
            label: f.label || f.name || fieldKey,
          };
        })
      : [];
    const all = [...BUILTIN_COLUMNS];
    for (const f of ctFields) {
      if (!all.find((x) => x.key === f.key)) {
        all.push(f);
      }
    }
    return all;
  };

  // ---------------------------------------------
  // Load views + CT details whenever type/role changes
  // ---------------------------------------------
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
          api.get(`/api/content-types/${selectedTypeId}/list-views`, {
            params: { role },
          }),
        ]);

        if (cancelled) return;

        // handle both axios response { data: ... } and raw object
        const ct = ctRes?.data || ctRes || null;
        setContentTypeDetail(ct);

        const av = computeAvailableFields(ct);
        setAvailableFields(av);

        // ---- NEW: handle both array & { views: [] } shapes + expose debug ----
        // viewsRes may be either an axios response (with a .data property)
        // or a plain array/object. Normalize it here so we can handle
        // both cases consistently.
        const rawViews = viewsRes?.data || viewsRes || [];
        const raw = rawViews;
        let loadedViews = [];

        if (Array.isArray(raw)) {
          loadedViews = raw;
        } else if (raw && Array.isArray(raw.views)) {
          loadedViews = raw.views;
        } else if (raw && typeof raw === "object") {
          console.warn("[ListViews] Unexpected list views shape", raw);
        }

        setViews(loadedViews);

        // global debug helper so we can inspect from DevTools
        window.__debugListViews = {
          typeId: selectedTypeId,
          role,
          raw,
          loadedViews,
        };
        console.log("[ListViews] Loaded list views", window.__debugListViews);
        // ---------------------------------------------------------------------

        if (loadedViews.length === 0) {
          // No views yet: synthesize a default config
          const defaultCols = [
            { key: "title", label: "Title" },
            { key: "status", label: "Status" },
            { key: "updated_at", label: "Updated" },
          ];
          setActiveViewSlug("default");
          setCurrentLabel("Default list");
          setIsDefault(true);
          setColumns(defaultCols);
          setDirty(false);
        } else {
          // Pick default or first view
          const def =
            loadedViews.find((v) => v.is_default) || loadedViews[0];
          setActiveViewSlug(def.slug);
          setCurrentLabel(def.label);
          // Determine default roles: use config.default_roles if present, otherwise
          // fall back to the legacy is_default boolean.  If multiple default
          // roles were stored, the view will be default for all of them.
          const cfgRoles = Array.isArray(def?.config?.roles)
            ? def.config.roles
            : [];
          const cfgDefaultRoles = Array.isArray(def?.config?.default_roles)
            ? def.config.default_roles
            : [];
          // If no roles array was provided, fall back to the legacy role column
          const legacyRole = def.role ? [def.role.toUpperCase()] : [];
          setAssignedRoles(cfgRoles.length ? cfgRoles : legacyRole);
          // Normalize default roles to uppercase and update state.  If none
          // provided, use an empty list.  Determine whether the current
          // view is default for the selected role based on this list or
          // legacy is_default flag.
          const normalizedDefaultRoles = cfgDefaultRoles.map((r) => r.toUpperCase());
          setDefaultRoles(normalizedDefaultRoles);
          if (normalizedDefaultRoles.length) {
            setIsDefault(normalizedDefaultRoles.includes(role.toUpperCase()));
          } else {
            setIsDefault(!!def.is_default);
          }

          const cfg = (def.config && def.config.columns) || [];
          if (cfg.length) {
            setColumns(cfg);
          } else {
            // fallback if somehow empty
            const defaultCols = [
              { key: "title", label: "Title" },
              { key: "status", label: "Status" },
              { key: "updated_at", label: "Updated" },
            ];
            setColumns(defaultCols);
          }
        }
      } catch (err) {
        console.error("[ListViews] load views error", err);
        if (!cancelled) {
          setError("Failed to load list views");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTypeId, role]);

  // ---------------------------------------------
  // Derived: chosen view object
  // ---------------------------------------------
  const activeView = useMemo(() => {
    if (!views || !views.length) return null;
    return views.find((v) => v.slug === activeViewSlug) || null;
  }, [views, activeViewSlug]);

  // ---------------------------------------------
  // Handlers
  // ---------------------------------------------
  const handleSelectType = (e) => {
    setSelectedTypeId(e.target.value);
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
    // When selecting a saved view, load its assigned roles and default status.
    const vRoles = Array.isArray(v?.config?.roles)
      ? v.config.roles
      : v.role
      ? [v.role.toUpperCase()]
      : [];
    setAssignedRoles(vRoles);

    // Load default roles for this view.  If the view stores an array of
    // default_roles, use it.  Otherwise fall back to the legacy is_default
    // flag for the single stored role.  We also update our defaultRoles
    // state so the UI can present a checkbox per role.
    const vDefaultRoles = Array.isArray(v?.config?.default_roles)
      ? v.config.default_roles.map((r) => r.toUpperCase())
      : [];
    setDefaultRoles(vDefaultRoles);
    if (vDefaultRoles.length) {
      setIsDefault(vDefaultRoles.includes(role.toUpperCase()));
    } else {
      setIsDefault(!!v.is_default);
    }

    const cfg = (v.config && v.config.columns) || [];
    if (cfg.length) {
      setColumns(cfg);
    } else {
      const defaultCols = [
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "updated_at", label: "Updated" },
      ];
      setColumns(defaultCols);
    }
    setDirty(false);
    setSaveMessage("");
    setError("");
  };

  const handleNewView = () => {
    const baseLabel = "New view";
    let label = baseLabel;
    let suffix = 1;
    const existingLabels = (views || []).map((v) => v.label.toLowerCase());
    while (existingLabels.includes(label.toLowerCase())) {
      suffix += 1;
      label = `${baseLabel} ${suffix}`;
    }
    const slug = slugify(label);

    setActiveViewSlug(slug);
    setCurrentLabel(label);
    // When creating a new view, clear default status and set default roles
    // equal to the currently selected role.  The user can toggle default
    // assignments separately.
    setIsDefault(false);
    setAssignedRoles([role]);
    setDefaultRoles([role]);

    if (!columns || !columns.length) {
      const defaultCols = [
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "updated_at", label: "Updated" },
      ];
      setColumns(defaultCols);
    }

    setDirty(true);
    setSaveMessage("");
    setError("");
  };

  const handleLabelChange = (e) => {
    const val = e.target.value;
    setCurrentLabel(val);

    // If we're on a synthetic/default or new view, keep slug in sync
    if (!activeView || activeView.slug === "default") {
      setActiveViewSlug(slugify(val || "view"));
    }

    setDirty(true);
  };

  // No longer used: default roles are toggled individually via toggleDefaultRole

  const handleAddColumn = (fieldKey) => {
    const field = availableFields.find((f) => f.key === fieldKey);
    if (!field) return;
    if (columns.find((c) => c.key === field.key)) return;
    setColumns((prev) => [...prev, { key: field.key, label: field.label }]);
    setDirty(true);
  };

  const handleRemoveColumn = (fieldKey) => {
    setColumns((prev) => prev.filter((c) => c.key !== fieldKey));
    setDirty(true);
  };

  const moveColumn = (fieldKey, direction) => {
    setColumns((prev) => {
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

  // Toggle a role in the assignedRoles array.  Adds the role if not present,
  // removes it if already present.  Marks the view as dirty so the user
  // knows to save changes.
  const toggleAssignedRole = (roleValue) => {
    const upper = roleValue.toUpperCase();
    setAssignedRoles((prev) => {
      const exists = prev.includes(upper);
       if (exists) {
        // If removing a role, also remove it from the defaultRoles list and
        // update isDefault accordingly
        setDefaultRoles((dprev) => {
          const newList = dprev.filter((r) => r !== upper);
          // update isDefault: whether current role is still default
          setIsDefault(newList.includes(role.toUpperCase()));
          return newList;
        });
        return prev.filter((r) => r !== upper);
      }
      return [...prev, upper];
    });
    setDirty(true);
  };

  // Toggle a role in the defaultRoles array.  Only roles that are currently
  // assigned can be marked as default.  Updates isDefault to reflect
  // whether the currently selected role is included in defaultRoles.
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
      // Keep default roles only among assigned roles
      next = next.filter((r) => assignedRoles.includes(r));
      // Update isDefault based on whether current role is default
      setIsDefault(next.includes(role.toUpperCase()));
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedTypeId || !role) return;
    setError("");
    setSaveMessage("");

    const label = (currentLabel || "").trim();
    const slug = slugify(label || "view");

    if (!label) {
      setError("Label is required");
      return;
    }
    if (!columns || !columns.length) {
      setError("Please choose at least one column");
      return;
    }

    try {
      setLoading(true);
      // Build payload.  We include both the new multi-role fields (roles,
      // default_roles) and the legacy single-role fields (role, is_default)
      // so that the API can support both formats.  assignedRoles is an
      // array of strings (uppercased), and if isDefault is true we pass
      // the same list as default_roles; otherwise default_roles is empty.
       // When saving, include both new multi-role fields (roles, default_roles)
       // and legacy fields (role, is_default).  We compute is_default
       // as whether the current role is in the list of defaultRoles.
       const payload = {
         slug,
         label,
         // Legacy single-role fields for backwards compatibility
         role,
         is_default: defaultRoles.includes(role.toUpperCase()),
         // New multi-role fields
         roles: assignedRoles,
         default_roles: defaultRoles,
         config: { columns },
       };
      const res = await api.put(
        `/api/content-types/${selectedTypeId}/list-view`,
        payload
      );

      // Response may include an array of views (res.data.views) or a single view
      let savedRow;
      if (res?.data?.views && Array.isArray(res.data.views)) {
        const arr = res.data.views;
        // Find the view for the current role (case-insensitive) or fall back
        savedRow =
          arr.find(
            (v) =>
              (v.role || "").toUpperCase() === role.toUpperCase() &&
              v.slug === slug
          ) || arr.find((v) => v.slug === slug) || arr[0];
      } else if (Array.isArray(res)) {
        // Raw array
        const arr = res;
        savedRow =
          arr.find(
            (v) =>
              (v.role || "").toUpperCase() === role.toUpperCase() &&
              v.slug === slug
          ) || arr.find((v) => v.slug === slug) || arr[0];
      } else {
        // Legacy: res.data.view or res.data is a single view
        savedRow = res?.data?.view || res?.data || null;
      }

      if (!savedRow) {
        setSaveMessage("List view saved");
        setDirty(false);
        return;
      }

      setViews((prev) => {
        const idx = prev.findIndex((v) => v.slug === savedRow.slug);
        if (idx === -1) {
          return [...prev, savedRow];
        }
        const next = [...prev];
        next[idx] = savedRow;
        return next;
      });

      setActiveViewSlug(savedRow.slug);
      setIsDefault(!!savedRow.is_default);
      setSaveMessage("List view saved");
      setDirty(false);
    } catch (err) {
      console.error("[ListViews] save error", err);
      setError("Failed to save list view");
    } finally {
      setLoading(false);
    }
  };

  const availableNotSelected = useMemo(() => {
    if (!availableFields || !availableFields.length) return [];
    const selectedKeys = new Set((columns || []).map((c) => c.key));
    return (availableFields || []).filter((f) => !selectedKeys.has(f.key));
  }, [availableFields, columns]);

  // ---------------------------------------------
  // Render
  // ---------------------------------------------
  return (
    <div className="su-page su-page-settings">
      <div className="su-page-header">
        <h1 className="su-page-title">List Views</h1>
        <p className="su-page-subtitle">
          Control which columns show in entry lists, per content type, role, and
          view.
        </p>
      </div>

      <div className="su-card su-mb-lg">
        <div className="su-card-body su-flex su-gap-md su-flex-wrap">
          <div className="su-field">
            <label className="su-label">Content type</label>
            <select
              className="su-input"
              value={selectedTypeId || ""}
              onChange={handleSelectType}
              disabled={loadingTypes || !contentTypes.length}
            >
              {!contentTypes.length && (
                <option value="">No content types yet</option>
              )}
              {contentTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.name || ct.slug}
                </option>
              ))}
            </select>
          </div>

          <div className="su-field">
            <label className="su-label">Role</label>
            <select
              className="su-input"
              value={role}
              onChange={handleSelectRole}
            >
              {allRoles.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Multi-role assignment for the current view */}
          <div className="su-field">
            <label className="su-label">Assigned roles</label>
            <div className="su-flex su-gap-sm su-flex-wrap">
               {allRoles.map((r) => (
                <label key={r} className="su-checkbox">
                  <input
                    type="checkbox"
                    value={r}
                    checked={assignedRoles.includes(r)}
                    onChange={() => toggleAssignedRole(r)}
                  />
                  <span>{r.charAt(0) + r.slice(1).toLowerCase()}</span>
                </label>
              ))}
            </div>
             <small className="su-text-muted">
               Select one or more roles that can use this view.  You can mark
               individual roles as default in the section below.
             </small>
          </div>
        </div>
      </div>

      <div className="su-layout-grid su-grid-cols-3 su-gap-lg su-mb-xl">
        {/* Left column: view selector */}
        <div className="su-card">
          <div className="su-card-header">
            <h2 className="su-card-title">Views for this role</h2>
          </div>
          <div className="su-card-body">
            {views.length === 0 && (
              <p className="su-text-muted">No saved views yet for this role.</p>
            )}
            <div className="su-chip-row su-mb-md">
              {views.map((v) => (
                <button
                  key={v.slug}
                  type="button"
                  onClick={() => handleSelectView(v.slug)}
                  className={
                    "su-chip" +
                    (v.slug === activeViewSlug ? " su-chip--active" : "")
                  }
                >
                  {v.label}
                  {v.is_default && (
                    <span className="su-chip-badge">default</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                className="su-chip su-chip--ghost"
                onClick={handleNewView}
              >
                + New view
              </button>
            </div>

            <div className="su-field">
              <label className="su-label">View label</label>
              <input
                className="su-input"
                value={currentLabel}
                onChange={handleLabelChange}
                placeholder="e.g. All entries"
              />
            </div>
            <div className="su-field su-mt-sm">
               <label className="su-label">Default roles</label>
               <div className="su-flex su-gap-sm su-flex-wrap">
                 {assignedRoles.map((r) => (
                   <label key={r} className="su-checkbox">
                     <input
                       type="checkbox"
                       value={r}
                       checked={defaultRoles.includes(r)}
                       onChange={() => toggleDefaultRole(r)}
                     />
                     <span>{r.charAt(0) + r.slice(1).toLowerCase()}</span>
                   </label>
                 ))}
               </div>
               <small className="su-text-muted">
                 Choose which of the assigned roles should use this view by default.
               </small>
             </div>

            <div className="su-mt-md su-text-xs su-text-muted">
              <div>
                Slug: <code>{activeViewSlug || "(auto)"}</code>
              </div>
            </div>

            <div className="su-mt-lg">
              <button
                type="button"
                className="su-btn su-btn-primary"
                onClick={handleSave}
                disabled={
                  loading || !selectedTypeId || !role || !columns.length
                }
              >
                {loading ? "Saving…" : "Save view"}
              </button>
              {dirty && (
                <span className="su-text-warning su-ml-sm">
                  Unsaved changes
                </span>
              )}
              {saveMessage && (
                <span className="su-text-success su-ml-sm">
                  {saveMessage}
                </span>
              )}
            </div>

            {error && (
              <div className="su-alert su-alert-danger su-mt-md">{error}</div>
            )}
          </div>
        </div>

        {/* Middle: available fields */}
        <div className="su-card">
          <div className="su-card-header">
            <h2 className="su-card-title">Available fields</h2>
            <p className="su-card-subtitle">
              Click to add a field as a column in this view.
            </p>
          </div>
          <div className="su-card-body su-list-scroll">
            {!contentTypeDetail ? (
              <p className="su-text-muted">
                Choose a content type to see its fields.
              </p>
            ) : availableNotSelected.length === 0 ? (
              <p className="su-text-muted">
                All fields are already in use for this view.
              </p>
            ) : (
              <ul className="su-list">
                {availableNotSelected.map((f) => (
                  <li key={f.key} className="su-list-item">
                    <button
                      type="button"
                      className="su-btn su-btn-ghost su-btn-sm su-w-full su-justify-between"
                      onClick={() => handleAddColumn(f.key)}
                    >
                      <span>{f.label}</span>
                      <code className="su-badge su-badge-soft">{f.key}</code>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: chosen columns */}
        <div className="su-card">
          <div className="su-card-header">
            <h2 className="su-card-title">Visible columns (order)</h2>
            <p className="su-card-subtitle">
              Drag &amp; drop would be nice later; for now use the arrows.
            </p>
          </div>
          <div className="su-card-body su-list-scroll">
            {(!columns || !columns.length) && (
              <p className="su-text-muted">
                No columns selected. Choose some from &ldquo;Available
                fields&rdquo;.
              </p>
            )}
            <ul className="su-list">
              {columns.map((c, idx) => (
                <li
                  key={c.key}
                  className="su-list-item su-flex su-items-center su-gap-sm"
                >
                  <div className="su-flex-1">
                    <div>{c.label}</div>
                    <div className="su-text-xs su-text-muted">
                      <code>{c.key}</code>
                    </div>
                  </div>
                  <div className="su-btn-group">
                    <button
                      type="button"
                      className="su-btn su-btn-icon su-btn-xs"
                      onClick={() => moveColumn(c.key, "up")}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="su-btn su-btn-icon su-btn-xs"
                      onClick={() => moveColumn(c.key, "down")}
                      disabled={idx === columns.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="su-btn su-btn-icon su-btn-xs su-btn-danger"
                      onClick={() => handleRemoveColumn(c.key)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Optional debug */}
      <div className="su-card su-mt-lg">
        <div className="su-card-header">
          <h2 className="su-card-title">Debug JSON</h2>
        </div>
        <div className="su-card-body">
          <pre className="su-code-block">
            {JSON.stringify(
              {
                contentTypeId: selectedTypeId,
                role,
                activeViewSlug,
                label: currentLabel,
                 isDefault,
                 defaultRoles,
                 columns,
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
