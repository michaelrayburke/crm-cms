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
        // remove as default from other views for this role
        setViews((oldViews) => {
          return oldViews.map((v) => {
            if (v.slug === activeViewSlug) return v;
            const cfg = v.config || {};
            const dRoles = Array.isArray(cfg.default_roles)
              ? cfg.default_roles.map((r) => r.toUpperCase())
              : [];
            if (dRoles.includes(upper)) {
              const newDRoles = dRoles.filter((r) => r !== upper);
              return {
                ...v,
                is_default: false,
                config: { ...cfg, default_roles: newDRoles },
              };
            }
            return v;
          });
        });
      }
      // Only allow defaults for assigned roles or ADMIN
      next = next.filter((r) => assignedRoles.includes(r) || r === "ADMIN");
      setIsDefault(next.includes(role.toUpperCase()));
      setViews((prevViews) => {
        return prevViews.map((v) => {
          if (v.slug === activeViewSlug) {
            const cfg = v.config || {};
            return {
              ...v,
              is_default: next.includes(role.toUpperCase()),
              config: { ...cfg, default_roles: next },
            };
          }
          return v;
        });
      });
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedTypeId || !role) return;
    setError("");
    setSaveMessage("");
    const label = (currentLabel || "").trim();
    const slug = activeViewSlug && activeViewSlug !== "default" ? activeViewSlug : slugify(label || "view");
    if (!label) {
      setError("Label is required");
      return;
    }
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
        label,
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
          setIsDefault(cfgDefault.includes(role.toUpperCase()) || !!next.is_default);
          const sect = Array.isArray(next?.config?.sections) && next.config.sections.length
            ? next.config.sections[0]
            : null;
          const keys = sect && Array.isArray(sect.fields)
            ? sect.fields.map((k) => (typeof k === "string" ? k : k.key))
            : [];
          const flds = availableFields.filter((f) => keys.includes(f.key));
          setFields(flds);
        } else {
          setActiveViewSlug("default");
          setCurrentLabel("Default editor");
          setIsDefault(true);
          setAssignedRoles([role.toUpperCase()]);
          setDefaultRoles([]);
          setFields(availableFields.slice(0, 3));
        }
      } catch (reloadErr) {
        console.error("[EntryViews] reload after save error", reloadErr);
        // optimistic update
        setViews((prev) => {
          let nextList = [...prev];
          nextList = nextList.filter((v) => v.slug !== slug);
          nextList.push({
            slug,
            label,
            role: rolesArray[0],
            is_default: effectiveDefaults.length > 0,
            config: {
              roles: rolesArray,
              default_roles: effectiveDefaults,
              sections: [section],
            },
          });
          return nextList;
        });
        setActiveViewSlug(slug);
        setCurrentLabel(label);
        setAssignedRoles(rolesArray);
        setDefaultRoles(effectiveDefaults);
        setIsDefault(effectiveDefaults.includes(role.toUpperCase()));
        setFields(fields);
      }
      setSaveMessage("Editor view saved. Entry editor will use this layout now.");
      setDirty(false);
      // bump version if there's a context mechanism; omitted here.
      navigate(`/admin/settings/entry-views/${selectedTypeId}`);
    } catch (err) {
      console.error("[EntryViews] save error", err);
      setError("Failed to save editor view");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCurrentView = async () => {
    if (!selectedTypeId || !activeViewSlug || activeViewSlug === "default") {
      return;
    }
    if (!window.confirm("Are you sure you want to delete this view? This cannot be undone.")) {
      return;
    }
    try {
      setLoading(true);
      setError("");
      setSaveMessage("");
      const encodedSlug = encodeURIComponent(activeViewSlug);
      await api.del(`/api/content-types/${selectedTypeId}/editor-view/${encodedSlug}`);
      let newViews = [];
      setViews((prevViews) => {
        const filtered = prevViews.filter((v) => v.slug !== activeViewSlug);
        newViews = filtered;
        return filtered;
      });
      if (newViews.length === 0) {
        setActiveViewSlug("default");
        setCurrentLabel("Default editor");
        setIsDefault(true);
        setAssignedRoles([role.toUpperCase()]);
        setDefaultRoles([]);
        setFields(availableFields.slice(0, 3));
        setDirty(false);
        navigate(`/admin/settings/entry-views/${selectedTypeId}`);
      } else {
        const first = newViews[0];
        setActiveViewSlug(first.slug);
        setCurrentLabel(first.label);
        const cfgRoles = Array.isArray(first?.config?.roles)
          ? first.config.roles.map((r) => String(r || "").toUpperCase())
          : first.role
          ? [String(first.role || "").toUpperCase()]
          : [];
        setAssignedRoles(cfgRoles);
        const dRoles = Array.isArray(first?.config?.default_roles)
          ? first.config.default_roles.map((r) => String(r || "").toUpperCase())
          : [];
        setDefaultRoles(dRoles);
        setIsDefault(dRoles.includes(role.toUpperCase()) || !!first.is_default);
        const sect = Array.isArray(first?.config?.sections) && first.config.sections.length
          ? first.config.sections[0]
          : null;
        const keys = sect && Array.isArray(sect.fields)
          ? sect.fields.map((k) => (typeof k === "string" ? k : k.key))
          : [];
        const flds = availableFields.filter((f) => keys.includes(f.key));
        setFields(flds);
        navigate(`/admin/settings/entry-views/${selectedTypeId}/${first.slug}`);
      }
    } catch (err) {
      console.error("[EntryViews] delete error", err);
      setError("Failed to delete editor view");
    } finally {
      setLoading(false);
    }
  };

  const availableNotSelected = useMemo(() => {
    if (!availableFields || !availableFields.length) return [];
    const selectedKeys = new Set((fields || []).map((c) => c.key));
    return (availableFields || []).filter((f) => !selectedKeys.has(f.key));
  }, [availableFields, fields]);

  // Render ---------------------------------------------------------
  return (
    <div className="su-page su-page-settings">
      <div className="su-page-header">
        <h1 className="su-page-title">Editor Views</h1>
        <p className="su-page-subtitle">
          Control which fields show in the entry editor, per content type, role and view.
        </p>
      </div>
      {loadingTypes ? (
        <p>Loading…</p>
      ) : null}
      {error && (
        <div className="su-alert su-alert-error su-mb-md">{error}</div>
      )}
      {saveMessage && (
        <div className="su-alert su-alert-success su-mb-md">{saveMessage}</div>
      )}
      {/* Stage: list of content types */}
      {stage === "types" && (
        <div className="su-card su-mb-lg">
          <div className="su-card-header">
            <h2 className="su-card-title">Content types</h2>
            <p className="su-card-subtitle">Choose a content type to manage its editor views.</p>
          </div>
          <div className="su-card-body">
            {contentTypes.length === 0 && (
              <p className="su-text-muted">No content types yet.</p>
            )}
            <div className="su-chip-row su-mb-md">
              {contentTypes.map((ct) => (
                <button
                  key={ct.id || ct.slug}
                  type="button"
                  onClick={() => handleSelectType(ct.slug || ct.id)}
                  className="su-chip"
                >
                  {ct.name || ct.label_plural || ct.label_singular || ct.slug}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Stage: list of views for a selected type */}
      {stage === "views" && (
        <div>
          <div className="su-card su-mb-lg">
            <div className="su-card-header su-flex su-items-center su-gap-sm">
              <button
                type="button"
                className="su-btn su-btn-ghost su-btn-sm"
                onClick={() => {
                  navigate("/admin/settings/entry-views");
                }}
              >
                ← Back to types
              </button>
              <h2 className="su-card-title su-ml-sm">
                Views for {
                  contentTypes.find((ct) => ct.slug === selectedTypeId || ct.id === selectedTypeId)?.name ||
                  contentTypes.find((ct) => ct.slug === selectedTypeId || ct.id === selectedTypeId)?.label_singular ||
                  selectedTypeId || ""
                }
              </h2>
            </div>
            <div className="su-card-body">
              {views.length === 0 && (
                <p className="su-text-muted">No saved views yet for this type.</p>
              )}
              <div className="su-chip-row su-mb-md">
                {views.map((v) => {
                  const viewDefaultRoles = Array.isArray(v?.config?.default_roles)
                    ? v.config.default_roles.map((r) => String(r || "").toUpperCase())
                    : [];
                  const viewRoles = Array.isArray(v?.config?.roles)
                    ? v.config.roles.map((r) => String(r || "").toUpperCase())
                    : v.role
                    ? [String(v.role || "").toUpperCase()]
                    : [];
                  const isDefaultForCurrentRole = viewDefaultRoles.length > 0
                    ? viewDefaultRoles.includes(role.toUpperCase())
                    : v.is_default && viewRoles.includes(role.toUpperCase());
                  return (
                    <button
                      key={v.slug}
                      type="button"
                      onClick={() => handleSelectView(v.slug)}
                      className="su-chip"
                    >
                      {v.label}
                      {isDefaultForCurrentRole && <span className="su-chip-badge">default</span>}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="su-chip su-chip--ghost"
                  onClick={handleNewView}
                >
                  + New editor view
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Stage: edit a specific view */}
      {stage === "edit" && (
        <div className="su-layout-grid su-grid-cols-3 su-gap-lg su-mb-xl">
          {/* Left column: edit view details */}
          <div className="su-card">
            <div className="su-card-header su-flex su-items-center su-gap-sm">
              <button
                type="button"
                className="su-btn su-btn-ghost su-btn-sm"
                onClick={() => {
                  navigate(`/admin/settings/entry-views/${selectedTypeId}`);
                }}
              >
                ← Back to views
              </button>
              <h2 className="su-card-title su-ml-sm">Edit editor view</h2>
            </div>
            <div className="su-card-body">
              <div className="su-field">
                <label className="su-label">View label</label>
                <input
                  className="su-input"
                  value={currentLabel}
                  onChange={handleLabelChange}
                  placeholder="e.g. SEO editor"
                />
              </div>
              <div className="su-field su-mt-sm">
                <label className="su-label">Assigned roles</label>
                <div className="su-flex su-gap-sm su-flex-wrap">
                  <label className="su-checkbox">
                    <input
                      type="checkbox"
                      value="ADMIN_ONLY"
                      checked={isAdminOnly}
                      onChange={toggleAdminOnly}
                    />
                    <span>Admin only</span>
                  </label>
                  {allRoles.filter((r) => r !== "ADMIN").map((r) => (
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
                  Choose one or more roles to use this view. Selecting no roles will make the view Admin‑only. You can mark individual roles as default below.
                </small>
              </div>
              <div className="su-field su-mt-sm">
                <label className="su-label">Default roles</label>
                <div className="su-flex su-gap-sm su-flex-wrap">
                  {Array.from(new Set(["ADMIN", ...assignedRoles])).map((r) => (
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
                  Choose which of the assigned roles (including Admin) should use this view by default.
                </small>
              </div>
              <div className="su-mt-sm su-text-xs su-text-muted">
                <div>Slug: <code>{activeViewSlug || '(auto)'}</code></div>
              </div>
              <div className="su-mt-md">
                <button
                  type="button"
                  className="su-btn su-btn-primary"
                  onClick={handleSave}
                  disabled={loading || !selectedTypeId || !role || !fields.length}
                >
                  {loading ? 'Saving…' : 'Save view'}
                </button>
                <button
                  type="button"
                  className="su-btn su-btn-danger su-ml-sm"
                  onClick={handleDeleteCurrentView}
                  disabled={
                    loading || !selectedTypeId || !role || !activeViewSlug || activeViewSlug === 'default'
                  }
                >
                  Delete view
                </button>
                {dirty && <span className="su-text-warning su-ml-sm">Unsaved changes</span>}
                {saveMessage && <span className="su-text-success su-ml-sm">{saveMessage}</span>}
              </div>
              {error && <div className="su-alert su-alert-danger su-mt-md">{error}</div>}
            </div>
          </div>
          {/* Middle column: available fields */}
          <div className="su-card">
            <div className="su-card-header">
              <h2 className="su-card-title">Available fields</h2>
              <p className="su-card-subtitle">Click to add a field to this editor view.</p>
            </div>
            <div className="su-card-body su-list-scroll">
              {!contentTypeDetail ? (
                <p className="su-text-muted">Choose a content type to see its fields.</p>
              ) : availableNotSelected.length === 0 ? (
                <p className="su-text-muted">All fields are already in use for this view.</p>
              ) : (
                <ul className="su-list">
                  {availableNotSelected.map((f) => (
                    <li key={f.key} className="su-list-item">
                      <button
                        type="button"
                        className="su-btn su-btn-ghost su-btn-sm su-w-full su-justify-between"
                        onClick={() => handleAddField(f.key)}
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
          {/* Right column: chosen fields */}
          <div className="su-card">
            <div className="su-card-header">
              <h2 className="su-card-title">Visible fields (order)</h2>
              <p className="su-card-subtitle">Use the arrows to reorder fields.</p>
            </div>
            <div className="su-card-body su-list-scroll">
              {(!fields || !fields.length) && (
                <p className="su-text-muted">
                  No fields selected. Choose some from “Available fields”.
                </p>
              )}
              <ul className="su-list">
                {fields.map((c, idx) => (
                  <li key={c.key} className="su-list-item su-flex su-items-center su-gap-sm">
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
                        onClick={() => moveField(c.key, 'up')}
                        disabled={idx === 0}
                      >
                        ↑
                      </button>
                        <button
                          type="button"
                          className="su-btn su-btn-icon su-btn-xs"
                          onClick={() => moveField(c.key, 'down')}
                          disabled={idx === fields.length - 1}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="su-btn su-btn-icon su-btn-xs su-btn-danger"
                          onClick={() => handleRemoveField(c.key)}
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
      )}
      {/* Debug JSON (optional) */}
      <div className="su-card su-mt-lg">
        <div className="su-card-header">
          <h2 className="su-card-title">Debug JSON</h2>
        </div>
        <div className="su-card-body">
          <pre className="su-code-block">
            {JSON.stringify(
              {
                stage,
                contentTypeId: selectedTypeId,
                role,
                activeViewSlug,
                label: currentLabel,
                isDefault,
                defaultRoles,
                fields,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
