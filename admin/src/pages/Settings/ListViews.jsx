import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  // Read route params and navigation helper.  The list‑views page supports
  // optional `:typeSlug` and `:viewSlug` segments which drive the
  // current stage.  When neither param is present we show the list of
  // content types (types stage).  When only `typeSlug` is present we
  // show the list of views for that type (views stage).  When both
  // params are present we edit that specific view (edit stage).
  const params = useParams();
  const navigate = useNavigate();
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
          // Append role as a query param instead of passing a params object.  The
          // api helper only accepts a URL string, so we encode the role
          // directly in the URL.  Without this change the role filter was
          // silently ignored.
          api.get(`/api/content-types/${selectedTypeId}/list-views?role=${encodeURIComponent(role)}`),
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
    // When selecting a type from the list page we navigate to the
    // appropriate URL.  The route path is `/admin/settings/list-views/:typeSlug`.
    const val = e?.target?.value || e;
    if (!val) return;
    // Navigate to the type views page.  The useEffect above will update
    // selectedTypeId and stage accordingly.
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

    // Move into edit stage so the user sees the editing UI
    // Navigate to the edit page for this view.  The URL shape is
    // `/admin/settings/list-views/:typeSlug/:viewSlug`.  The above
    // useEffect will update stage and activeViewSlug.  Passing the
    // current selectedTypeId (which may be a slug or id) keeps the
    // existing selection.
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

    // Navigate to the edit page for the newly created view.  This
    // ensures the URL reflects the view slug and will trigger the
    // useEffect above to set stage/edit state.  Use selectedTypeId
    // from state (slug or id).
    navigate(`/admin/settings/list-views/${selectedTypeId}/${slug}`);
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
        // When adding a role as default for this view, remove the same role
        // from the defaultRoles of all other views in memory.  This
        // ensures there is at most one default per role across all views
        // even before saving.  The backend will enforce this on save, but
        // updating local state prevents multiple default chips from
        // appearing simultaneously.
        setViews((oldViews) => {
          return oldViews.map((v) => {
            if (v.slug === activeViewSlug) return v;
            // Normalize default_roles array on the view
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
      // Keep default roles only among assigned roles
      next = next.filter((r) => assignedRoles.includes(r));
      // Update isDefault based on whether current role is default
      setIsDefault(next.includes(role.toUpperCase()));

      // Also update the views array so the UI reflects new default roles
      setViews((prevViews) => {
        return prevViews.map((v) => {
          // If this is the view being edited, update its config.default_roles
          if (v.slug === activeViewSlug) {
            const cfg = v.config || {};
            return {
              ...v,
              // For legacy support, also update is_default on the row based on current role
              is_default: next.includes(role.toUpperCase()),
              config: { ...cfg, default_roles: next },
            };
          }
          // Other views were updated above when adding a new default role
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
    // When editing an existing view we keep the slug stable. Only
    // generate a new slug when creating a brand‑new view (i.e. when no
    // view is selected or the active view slug is "default").  This
    // prevents accidentally creating a second view with a new slug
    // when the label changes on an existing view.  Without this, a
    // label change would produce a new slug and thus insert a new row
    // instead of updating the existing view.
    const slug =
      activeViewSlug && activeViewSlug !== "default"
        ? activeViewSlug
        : slugify(label || "view");

    if (!label) {
      setError("Label is required");
      return;
    }
    if (!columns || !columns.length) {
      setError("Please choose at least one column");
      return;
    }

    // Ensure slug is unique among existing views (case-insensitive).  If a
    // different view already uses this slug, abort save with an error.
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
        // After saving we navigate back to the list of views for this type.
        // This updates the URL and resets the stage via useEffect.
        navigate(`/admin/settings/list-views/${selectedTypeId}`);
        return;
      }

      // Optimistically update the views list locally so the UI reflects
      // changes immediately, even before reload.  Merge the updated label,
      // roles, default roles and columns into the existing view record.
      setViews((prev) => {
        const idx = prev.findIndex((v) => v.slug === savedRow.slug);
        const updated = {
          ...savedRow,
          label,
          config: {
            ...(savedRow.config || {}),
            roles: assignedRoles,
            default_roles: defaultRoles,
            columns,
          },
        };
        if (idx === -1) {
          return [...prev, updated];
        }
        const nextList = [...prev];
        nextList[idx] = updated;
        return nextList;
      });

      // Instead of only updating the saved row in state, reload the list
      // views from the API to ensure default flags and other views are
      // correctly refreshed.  This guarantees that only one view is
      // default per role and prevents stale duplicates from lingering
      // in the UI.  We use the currently selected role when reloading.
      try {
        const lvRes = await api.get(
          `/api/content-types/${selectedTypeId}/list-views?role=${encodeURIComponent(role)}`
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
        // Find the newly saved view by slug; fall back to the first view
        const next = newViews.find((v) => v.slug === slug) || newViews[0] || null;
        if (next) {
          setActiveViewSlug(next.slug);
          setCurrentLabel(next.label);
          // Load assigned roles and default roles from the view config
          const cfgRoles = Array.isArray(next?.config?.roles)
            ? next.config.roles
            : next.role
            ? [next.role.toUpperCase()]
            : [];
          setAssignedRoles(cfgRoles);
          const cfgDefault = Array.isArray(next?.config?.default_roles)
            ? next.config.default_roles.map((r) => r.toUpperCase())
            : [];
          setDefaultRoles(cfgDefault);
          setIsDefault(
            cfgDefault.includes(role.toUpperCase()) || !!next.is_default
          );
          const cfgCols = Array.isArray(next?.config?.columns)
            ? next.config.columns
            : [
                { key: "title", label: "Title" },
                { key: "status", label: "Status" },
                { key: "updated_at", label: "Updated" },
              ];
          setColumns(cfgCols);
        } else {
          // No views returned: fallback to synthesized default layout
          setActiveViewSlug("default");
          setCurrentLabel("Default list");
          setIsDefault(true);
          setAssignedRoles([role]);
          setDefaultRoles([]);
          setColumns([
            { key: "title", label: "Title" },
            { key: "status", label: "Status" },
            { key: "updated_at", label: "Updated" },
          ]);
        }
        setSaveMessage("List view saved");
        setDirty(false);
        // Navigate back to the views list page
        navigate(`/admin/settings/list-views/${selectedTypeId}`);
      } catch (err) {
        console.error("[ListViews] reload after save error", err);
        // If reload fails, fall back to previous behaviour of updating saved row locally
        setViews((prev) => {
          const idx = prev.findIndex((v) => v.slug === savedRow.slug);
          if (idx === -1) {
            return [...prev, savedRow];
          }
          const nextList = [...prev];
          nextList[idx] = savedRow;
          return nextList;
        });
        setActiveViewSlug(savedRow.slug);
        setIsDefault(!!savedRow.is_default);
        setSaveMessage("List view saved");
        setDirty(false);
      }
    } catch (err) {
      console.error("[ListViews] save error", err);
      setError("Failed to save list view");
    } finally {
      setLoading(false);
    }
  };

  // Delete the currently selected view.  This will remove all roles for this
  // slug by default.  After deletion, reload the list of views and select
  // the first available view.  If no views remain, revert to the
  // synthesized default layout.
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
      // delete the view for the current role.  Passing the role
      // identifies the row uniquely when multiple roles share the same slug.
      // Use api.del instead of api.delete (api.js defines del for DELETE)
      // and include the role as a query parameter.  Without this the
      // request would silently fail and the view would not be removed.
      await api.del(
        `/api/content-types/${selectedTypeId}/list-view/${activeViewSlug}?role=${encodeURIComponent(role)}`
      );
      // Reload list views
      const lvRes = await api.get(
        `/api/content-types/${selectedTypeId}/list-views?role=${encodeURIComponent(role)}`
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
      if (newViews.length === 0) {
        // no saved views remain: reset to default layout and navigate back to
        // the views list for this type.  The default layout is still shown
        // in the edit UI but we treat it as unsaved.
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
        // Navigate back to the list of views (no viewSlug in path)
        navigate(`/admin/settings/list-views/${selectedTypeId}`);
      } else {
        // Select the first view from the reloaded list and navigate to it
        const first = newViews[0];
        setActiveViewSlug(first.slug);
        setCurrentLabel(first.label);
        // load assigned and default roles
        const cfgRoles = Array.isArray(first?.config?.roles)
          ? first.config.roles
          : first.role
          ? [first.role.toUpperCase()]
          : [];
        setAssignedRoles(cfgRoles);
        const dRoles = Array.isArray(first?.config?.default_roles)
          ? first.config.default_roles.map((r) => r.toUpperCase())
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
        // Navigate to the new active view slug
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
                  // Navigate back to the list of content types
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
                  // Determine if this view is default for the currently selected role.
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
                  // Navigate back to the list of views for the current type
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
                  Select one or more roles that can use this view. You can mark
                  individual roles as default below.
                </small>
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
