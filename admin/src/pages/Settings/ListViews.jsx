import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useSettings } from "../../context/SettingsContext";

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
  // Read route params and navigation helper.  The list-views page supports
  // optional `:typeSlug` and `:viewSlug` segments which drive the
  // current stage.  When neither param is present we show the list of
  // content types (types stage).  When only `typeSlug` is present we
  // show the list of views for that type (views stage).  When both
  // params are present we edit that specific view (edit stage).
  const params = useParams();
  const navigate = useNavigate();
  const { bumpListViewsVersion } = useSettings(); // ✅ NEW

  const [contentTypes, setContentTypes] = useState([]);
  // When this page first loads we show a list of content types.  When the
  // user clicks on a type we switch to the list-view stage for that type.
  // Editing a view further switches to the edit stage.  This prevents
  // everything being crammed on one screen and makes the flow more obvious.
  const [stage, setStage] = useState("types"); // 'types' | 'views' | 'edit'
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
  // Sync stage and selection from the URL params
  // ---------------------------------------------
  useEffect(() => {
    // We support either :typeSlug or :typeId for backwards compatibility.
    // Grab whichever is defined.  React Router merges params from nested
    // routes, so both could exist but at least one will be blank.
    const typeSlug = params.typeSlug || params.typeId;
    const viewSlug = params.viewSlug || "";
    if (!typeSlug) {
      // No type selected → show list of content types
      setStage("types");
      setSelectedTypeId("");
      setActiveViewSlug("");
      return;
    }
    // Set the selected type (slug or id) and choose stage based on
    // whether a view slug is present.  When editing a view we also
    // preset the activeViewSlug so the form fields populate correctly.
    setSelectedTypeId(typeSlug);
    if (viewSlug) {
      setStage("edit");
      setActiveViewSlug(viewSlug);
    } else {
      setStage("views");
      setActiveViewSlug("");
    }
  }, [params.typeId, params.typeSlug, params.viewSlug]);

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
        // If no type is specified in the URL and no type has been selected yet, default to the first type.
        // Otherwise, respect the slug from the route. This prevents refreshing from switching to the first type.
        const hasParam = params?.typeSlug || params?.typeId;
        if (list.length && !hasParam && !selectedTypeId) {
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
          // Fetch all views for this type for editing. Use all=true and a cache-busting param.
          api.get(
            `/api/content-types/${selectedTypeId}/list-views?all=true&_=${Date.now()}`,
          ),
        ]);

        if (cancelled) return;

        // handle both axios response { data: ... } and raw object
        const ct = ctRes?.data || ctRes || null;
        setContentTypeDetail(ct);

        const av = computeAvailableFields(ct);
        setAvailableFields(av);

        // ---- handle both array & { views: [] } shapes + expose debug ----
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
          // fall back to the legacy is_default boolean.
          const cfgRoles = Array.isArray(def?.config?.roles)
            ? def.config.roles
            : [];
          const cfgDefaultRoles = Array.isArray(def?.config?.default_roles)
            ? def.config.default_roles
            : [];
          const legacyRole = def.role ? [def.role.toUpperCase()] : [];
          setAssignedRoles(cfgRoles.length ? cfgRoles : legacyRole);

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
    const val = e?.target?.value || e;
    if (!val) return;
    navigate(`/admin/settings/list-views/${val}`);
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
      ? v.config.roles
      : v.role
      ? [v.role.toUpperCase()]
      : [];
    setAssignedRoles(vRoles);

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

    navigate(`/admin/settings/list-views/${selectedTypeId}/${slug}`);
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

    navigate(`/admin/settings/list-views/${selectedTypeId}/${slug}`);
  };

  const handleLabelChange = (e) => {
    const val = e.target.value;
    setCurrentLabel(val);

    if (!activeView || activeView.slug === "default") {
      setActiveViewSlug(slugify(val || "view"));
    }

    setDirty(true);
  };

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

  const toggleAssignedRole = (roleValue) => {
    const upper = roleValue.toUpperCase();
    // If a non-admin role is being toggled while in admin-only mode, exit admin-only mode
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

  // Track whether the view is currently Admin-only. When true, only Admin can access the view.
  const [adminOnly, setAdminOnly] = useState(false);
  // Derived flag used in the UI; mirrors the adminOnly state. We keep this separate to avoid undefined references.
  const isAdminOnly = adminOnly;

  // Toggle the Admin-only state.  When toggled on, clear all assigned roles and retain only Admin in default roles.
  const toggleAdminOnly = () => {
    if (!adminOnly) {
      // Turning on Admin-only: clear assigned roles and keep only Admin in default roles
      setAdminOnly(true);
      setAssignedRoles([]);
      setDefaultRoles((prev) => prev.filter((r) => r.toUpperCase() === 'ADMIN'));
    } else {
      // Turning off Admin-only: allow roles to be selected manually
      setAdminOnly(false);
      // Do not modify assignedRoles here; the user can choose roles after turning off Admin-only
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
        setViews((oldViews) => {
          return oldViews.map((v) => {
            if (v.slug === activeViewSlug) return v;
            const cfg = v.config || {};
            const droles = Array.isArray(cfg.default_roles)
              ? cfg.default_roles.map((r) => r.toUpperCase())
              : [];
            if (droles.includes(upper)) {
              const newDRoles = droles.filter((r) => r !== upper);
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
      // Allow default roles only for assigned roles or ADMIN (which is always implicitly assigned)
      next = next.filter((r) => assignedRoles.includes(r) || r === 'ADMIN');
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
    setError('');
    setSaveMessage('');

    const label = (currentLabel || '').trim();
    const slug =
      activeViewSlug && activeViewSlug !== 'default'
        ? activeViewSlug
        : slugify(label || 'view');

    // Validate label and columns
    if (!label) {
      setError('Label is required');
      return;
    }
    if (!columns || !columns.length) {
      setError('Please choose at least one column');
      return;
    }
    // Prevent duplicate slug for another view
    const dup = (views || []).find(
      (v) => v.slug && v.slug.toLowerCase() === slug.toLowerCase() && v.slug !== activeViewSlug
    );
    if (dup) {
      setError(
        `A view with the slug "${slug}" already exists. Please choose a different label or slug.`
      );
      return;
    }

    try {
      setLoading(true);
      // Always include ADMIN so admins can edit views. Build roles set with ADMIN + assignedRoles
      const rolesSet = new Set(assignedRoles.map((r) => r.toUpperCase()));
      rolesSet.add('ADMIN');
      const rolesArray = Array.from(rolesSet);
      // Use defaultRoles as uppercase without filtering out ADMIN; admin can be default
      const effectiveDefaultRoles = defaultRoles.map((r) => r.toUpperCase());
      // Build payload for single-row save
      const payload = {
        slug,
        label,
        roles: rolesArray,
        default_roles: effectiveDefaultRoles,
        config: { columns },
      };
      // Send a single PUT request with all roles and default roles
      await api.put(
        `/api/content-types/${selectedTypeId}/list-view`,
        payload,
      );
      // Reload list views with all=true so admin sees all rows
      try {
        const lvRes = await api.get(
          `/api/content-types/${selectedTypeId}/list-views?all=true&_=${Date.now()}`,
        );
        const lvRaw = lvRes?.data || lvRes || [];
        let newViews;
        if (Array.isArray(lvRaw)) {
          newViews = lvRaw;
        } else if (lvRaw && Array.isArray(lvRaw.views)) {
          newViews = lvRaw.views;
        } else {
          newViews = [];
        }
        setViews(newViews);
        // Find the newly saved view by slug; fall back to first
        const next = newViews.find((v) => v.slug === slug) || newViews[0] || null;
        if (next) {
          setActiveViewSlug(next.slug);
          setCurrentLabel(next.label);
          const cfgRoles = Array.isArray(next?.config?.roles)
            ? next.config.roles.map((r) => String(r || '').toUpperCase())
            : next.role
            ? [String(next.role || '').toUpperCase()]
            : [];
          setAssignedRoles(cfgRoles);
          const cfgDefault = Array.isArray(next?.config?.default_roles)
            ? next.config.default_roles.map((r) => String(r || '').toUpperCase())
            : [];
          setDefaultRoles(cfgDefault);
          // Determine if current role is default
          setIsDefault(cfgDefault.includes(role.toUpperCase()) || !!next.is_default);
          const cfgCols = Array.isArray(next?.config?.columns)
            ? next.config.columns
            : [
                { key: 'title', label: 'Title' },
                { key: 'status', label: 'Status' },
                { key: 'updated_at', label: 'Updated' },
              ];
          setColumns(cfgCols);
        } else {
          // fallback to default layout
          setActiveViewSlug('default');
          setCurrentLabel('Default list');
          setIsDefault(true);
          setAssignedRoles([role]);
          setDefaultRoles([]);
          setColumns([
            { key: 'title', label: 'Title' },
            { key: 'status', label: 'Status' },
            { key: 'updated_at', label: 'Updated' },
          ]);
        }
      } catch (reloadErr) {
        console.error('[ListViews] reload after save error', reloadErr);
        // Optimistically update local state with single row
        setViews((prev) => {
          let nextList = [...prev];
          // remove existing rows for slug
          nextList = nextList.filter((v) => v.slug !== slug);
          // create new row with rolesArray
          nextList.push({
            slug,
            label,
            role: rolesArray[0],
            is_default: effectiveDefaultRoles.length > 0,
            config: {
              roles: rolesArray,
              default_roles: effectiveDefaultRoles,
              columns,
            },
          });
          return nextList;
        });
        setActiveViewSlug(slug);
        setCurrentLabel(label);
        setAssignedRoles(rolesArray);
        setDefaultRoles(effectiveDefaultRoles);
        setIsDefault(effectiveDefaultRoles.includes(role.toUpperCase()));
        setColumns(columns);
      }
      setSaveMessage('List view saved. Entry lists will use this layout now.');
      setDirty(false);
      bumpListViewsVersion();
      navigate(`/admin/settings/list-views/${selectedTypeId}`);
    } catch (err) {
      console.error('[ListViews] save error', err);
      setError('Failed to save list view');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCurrentView = async () => {
    if (!selectedTypeId || !activeViewSlug || activeViewSlug === 'default') {
      return;
    }
    if (!window.confirm('Are you sure you want to delete this view? This cannot be undone.')) {
      return;
    }
    try {
      setLoading(true);
      setError('');
      setSaveMessage('');
      // Encode the slug to safely call the API when it contains special characters.
      const encodedSlug = encodeURIComponent(activeViewSlug);
      // Call delete without specifying role; with single-row design this removes the entire view
      await api.del(
        `/api/content-types/${selectedTypeId}/list-view/${encodedSlug}`,
      );
      // Remove the deleted view from local state and capture the updated list.
      let newViews = [];
      setViews((prevViews) => {
        const filtered = prevViews.filter((v) => v.slug !== activeViewSlug);
        newViews = filtered;
        return filtered;
      });
      // Determine the next UI state based on the updated list.
      if (newViews.length === 0) {
        // No saved views remain: revert to default layout
        setActiveViewSlug('default');
        setCurrentLabel('Default list');
        setIsDefault(true);
        setAssignedRoles([role]);
        setDefaultRoles([]);
        setColumns([
          { key: 'title', label: 'Title' },
          { key: 'status', label: 'Status' },
          { key: 'updated_at', label: 'Updated' },
        ]);
        setDirty(false);
        bumpListViewsVersion(); // ✅ notify others
        navigate(`/admin/settings/list-views/${selectedTypeId}`);
      } else {
        const first = newViews[0];
        setActiveViewSlug(first.slug);
        setCurrentLabel(first.label);
        const cfgRoles = Array.isArray(first?.config?.roles)
          ? first.config.roles
          : first.role
          ? [first.role.toUpperCase()]
          : [];
        setAssignedRoles(cfgRoles);
        const dRoles = Array.isArray(first?.config?.default_roles)
          ? first.config.default_roles.map((r) => String(r || '').toUpperCase())
          : [];
        setDefaultRoles(dRoles);
        setIsDefault(dRoles.includes(role.toUpperCase()) || !!first.is_default);
        const cfgCols = Array.isArray(first?.config?.columns)
          ? first.config.columns
          : [
              { key: 'title', label: 'Title' },
              { key: 'status', label: 'Status' },
              { key: 'updated_at', label: 'Updated' },
            ];
        setColumns(cfgCols);
        bumpListViewsVersion(); // ✅ notify others
        navigate(`/admin/settings/list-views/${selectedTypeId}/${first.slug}`);
      }
    } catch (err) {
      console.error('[ListViews] delete error', err);
      setError('Failed to delete list view');
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

      {/* Stage: list of content types */}
      {stage === 'types' && (
        <div className="su-card su-mb-lg">
          <div className="su-card-header">
            <h2 className="su-card-title">Content types</h2>
            <p className="su-card-subtitle">
              Choose a content type to manage its list views.
            </p>
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
      {stage === 'views' && (
        <div>
          <div className="su-card su-mb-lg">
            <div className="su-card-header su-flex su-items-center su-gap-sm">
              <button
                type="button"
                className="su-btn su-btn-ghost su-btn-sm"
                onClick={() => {
                  navigate('/admin/settings/list-views');
                }}
              >
                ← Back to types
              </button>
              <h2 className="su-card-title su-ml-sm">
                Views for {
                  (contentTypes.find((ct) => ct.slug === selectedTypeId || ct.id === selectedTypeId)?.name ||
                    contentTypes.find((ct) => ct.slug === selectedTypeId || ct.id === selectedTypeId)?.label_singular ||
                    selectedTypeId || '')
                }
              </h2>
            </div>
            <div className="su-card-body">
              {views.length === 0 && (
                <p className="su-text-muted">No saved views yet for this role.</p>
              )}
              <div className="su-chip-row su-mb-md">
                {views.map((v) => {
                  const viewDefaultRoles = Array.isArray(v?.config?.default_roles)
                    ? v.config.default_roles.map((r) => String(r || '').toUpperCase())
                    : [];
                  const viewRoles = Array.isArray(v?.config?.roles)
                    ? v.config.roles.map((r) => String(r || '').toUpperCase())
                    : v.role
                    ? [String(v.role || '').toUpperCase()]
                    : [];
                  const isDefaultForCurrentRole =
                    (viewDefaultRoles.length > 0
                      ? viewDefaultRoles.includes(role.toUpperCase())
                      : v.is_default && viewRoles.includes(role.toUpperCase()));
                  return (
                    <button
                      key={v.slug}
                      type="button"
                      onClick={() => handleSelectView(v.slug)}
                      className="su-chip"
                    >
                      {v.label}
                      {isDefaultForCurrentRole && (
                        <span className="su-chip-badge">default</span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="su-chip su-chip--ghost"
                  onClick={handleNewView}
                >
                  + New view
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage: edit a specific view */}
      {stage === 'edit' && (
        <div className="su-layout-grid su-grid-cols-3 su-gap-lg su-mb-xl">
          {/* Left column: edit view details */}
          <div className="su-card">
            <div className="su-card-header su-flex su-items-center su-gap-sm">
              <button
                type="button"
                className="su-btn su-btn-ghost su-btn-sm"
                onClick={() => {
                  navigate(`/admin/settings/list-views/${selectedTypeId}`);
                }}
              >
                ← Back to views
              </button>
              <h2 className="su-card-title su-ml-sm">Edit view</h2>
            </div>
            <div className="su-card-body">
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
                <label className="su-label">Assigned roles</label>
                <div className="su-flex su-gap-sm su-flex-wrap">
                  {/* Admin-only toggle. When checked, the view is restricted to Admin only; other roles are cleared. */}
                  <label className="su-checkbox">
                    <input
                      type="checkbox"
                      value="ADMIN_ONLY"
                      checked={isAdminOnly}
                      onChange={toggleAdminOnly}
                    />
                    <span>Admin only</span>
                  </label>
                  {/* Render checkboxes for other roles. Disable them when Admin-only is selected. */}
                  {allRoles.filter((r) => r !== 'ADMIN').map((r) => (
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
                  Choose one or more roles to use this view. Selecting no roles will make the view Admin-only. You can mark individual roles as default below.
                </small>
              </div>
              <div className="su-field su-mt-sm">
                <label className="su-label">Default roles</label>
                <div className="su-flex su-gap-sm su-flex-wrap">
                  {/* Include Admin and all assigned roles in the default roles selection. */}
                  {Array.from(new Set(['ADMIN', ...assignedRoles])).map((r) => (
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
                <div>
                  Slug: <code>{activeViewSlug || '(auto)'}</code>
                </div>
              </div>
              <div className="su-mt-md">
                <button
                  type="button"
                  className="su-btn su-btn-primary"
                  onClick={handleSave}
                  disabled={loading || !selectedTypeId || !role || !columns.length}
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
                {dirty && (
                  <span className="su-text-warning su-ml-sm">Unsaved changes</span>
                )}
                {saveMessage && (
                  <span className="su-text-success su-ml-sm">{saveMessage}</span>
                )}
              </div>
              {error && <div className="su-alert su-alert-danger su-mt-md">{error}</div>}
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
                  No columns selected. Choose some from &ldquo;Available fields&rdquo;.
                </p>
              )}
              <ul className="su-list">
                {columns.map((c, idx) => (
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
                        onClick={() => moveColumn(c.key, 'up')}
                        disabled={idx === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="su-btn su-btn-icon su-btn-xs"
                        onClick={() => moveColumn(c.key, 'down')}
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
      )}

      {/* Optional debug */}
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
