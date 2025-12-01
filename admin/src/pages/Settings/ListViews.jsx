import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useSettings } from "../../context/SettingsContext"; // ✅ NEW

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
  const params = useParams();
  const navigate = useNavigate();
  const { bumpListViewsVersion } = useSettings(); // ✅ notify others

  const [contentTypes, setContentTypes] = useState([]);
  const [stage, setStage] = useState("types"); // 'types' | 'views' | 'edit'
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [role, setRole] = useState("ADMIN");

  const [assignedRoles, setAssignedRoles] = useState(["ADMIN"]);
  const [contentTypeDetail, setContentTypeDetail] = useState(null);

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

  const [allRoles, setAllRoles] = useState([
    "ADMIN",
    "EDITOR",
    "AUTHOR",
    "VIEWER",
  ]);
  const [defaultRoles, setDefaultRoles] = useState([]);

  // ---------------------------------------------
  // Sync stage and selection from the URL params
  // ---------------------------------------------
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

  // ---------------------------------------------
  // Load content types on mount
  // ---------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingTypes(true);

        // roles
        try {
          const rolesRes = await api.get("/api/roles");
          const rawRoles = rolesRes?.data || rolesRes || [];
          if (Array.isArray(rawRoles) && rawRoles.length) {
            const extracted = rawRoles
              .map((r) =>
                (r.slug || r.name || r.role || "").toUpperCase()
              )
              .filter(Boolean);
            if (extracted.length) {
              setAllRoles(extracted);
            }
          }
        } catch {
          // ignore; keep defaults
        }

        const res = await api.get("/api/content-types");
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res?.data || [];

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
  }, []); // mount only

  // ---------------------------------------------
  // Build available fields = builtins + CT fields
  // ---------------------------------------------
  const computeAvailableFields = (ct) => {
    if (!ct) return BUILTIN_COLUMNS;
    const ctFields = Array.isArray(ct.fields)
      ? ct.fields.map((f) => {
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
          api.get(
            `/api/content-types/${selectedTypeId}/list-views?role=${encodeURIComponent(
              role,
            )}`,
          ),
        ]);

        if (cancelled) return;

        const ct = ctRes?.data || ctRes || null;
        setContentTypeDetail(ct);
        const av = computeAvailableFields(ct);
        setAvailableFields(av);

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

        if (loadedViews.length === 0) {
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
          const def =
            loadedViews.find((v) => v.is_default) || loadedViews[0];
          setActiveViewSlug(def.slug);
          setCurrentLabel(def.label);

          const cfgRoles = Array.isArray(def?.config?.roles)
            ? def.config.roles
            : [];
          const cfgDefaultRoles = Array.isArray(
            def?.config?.default_roles,
          )
            ? def.config.default_roles
            : [];
          const legacyRole = def.role ? [def.role.toUpperCase()] : [];
          setAssignedRoles(
            cfgRoles.length ? cfgRoles : legacyRole,
          );

          const normalizedDefaultRoles = cfgDefaultRoles.map((r) =>
            r.toUpperCase(),
          );
          setDefaultRoles(normalizedDefaultRoles);
          if (normalizedDefaultRoles.length) {
            setIsDefault(
              normalizedDefaultRoles.includes(role.toUpperCase()),
            );
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
    const existingLabels = (views || []).map((v) =>
      v.label.toLowerCase(),
    );
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
    setColumns((prev) => [
      ...prev,
      { key: field.key, label: field.label },
    ]);
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
      next = next.filter((r) => assignedRoles.includes(r));
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

    const dup = (views || []).find(
      (v) =>
        v.slug &&
        v.slug.toLowerCase() === slug.toLowerCase() &&
        v.slug !== activeViewSlug,
    );
    if (dup) {
      setError(
        `A view with the slug "${slug}" already exists. Please choose a different label or slug.`,
      );
      return;
    }

    try {
      setLoading(true);

      const payload = {
        slug,
        label,
        role,
        is_default: defaultRoles.includes(role.toUpperCase()),
        roles: assignedRoles,
        default_roles: defaultRoles,
        config: { columns },
      };

      const res = await api.put(
        `/api/content-types/${selectedTypeId}/list-view`,
        payload,
      );

      let savedRow;
      if (res?.data?.views && Array.isArray(res.data.views)) {
        const arr = res.data.views;
        savedRow =
          arr.find(
            (v) =>
              (v.role || "").toUpperCase() === role.toUpperCase() &&
              v.slug === slug,
          ) || arr.find((v) => v.slug === slug) || arr[0];
      } else if (Array.isArray(res)) {
        const arr = res;
        savedRow =
          arr.find(
            (v) =>
              (v.role || "").toUpperCase() === role.toUpperCase() &&
              v.slug === slug,
          ) || arr.find((v) => v.slug === slug) || arr[0];
      } else {
        savedRow = res?.data?.view || res?.data || null;
      }

      if (!savedRow) {
        setSaveMessage(
          "List view saved. Entry lists will use this layout now.",
        );
        setDirty(false);
        bumpListViewsVersion(); // ✅ notify others
        navigate(`/admin/settings/list-views/${selectedTypeId}`);
        return;
      }

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

      try {
        const lvRes = await api.get(
          `/api/content-types/${selectedTypeId}/list-views?role=${encodeURIComponent(
            role,
          )}`,
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
        const next =
          newViews.find((v) => v.slug === slug) || newViews[0] || null;
        if (next) {
          setActiveViewSlug(next.slug);
          setCurrentLabel(next.label);
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
            cfgDefault.includes(role.toUpperCase()) ||
              !!next.is_default,
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
        setSaveMessage(
          "List view saved. Entry lists will use this layout now.",
        );
        setDirty(false);
        bumpListViewsVersion(); // ✅ notify others
        navigate(`/admin/settings/list-views/${selectedTypeId}`);
      } catch (err) {
        console.error("[ListViews] reload after save error", err);
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
        setSaveMessage(
          "List view saved. Entry lists will use this layout now.",
        );
        setDirty(false);
        bumpListViewsVersion(); // ✅ notify others even on fallback
      }
    } catch (err) {
      console.error("[ListViews] save error", err);
      setError("Failed to save list view");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCurrentView = async () => {
    if (
      !selectedTypeId ||
      !activeViewSlug ||
      activeViewSlug === "default"
    ) {
      return;
    }
    if (
      !window.confirm(
        "Are you sure you want to delete this view? This cannot be undone.",
      )
    ) {
      return;
    }
    try {
      setLoading(true);
      setError("");
      setSaveMessage("");
      await api.del(
        `/api/content-types/${selectedTypeId}/list-view/${activeViewSlug}?role=${encodeURIComponent(
          role,
        )}`,
      );
      const lvRes = await api.get(
        `/api/content-types/${selectedTypeId}/list-views?role=${encodeURIComponent(
          role,
        )}`,
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
          ? first.config.default_roles.map((r) => r.toUpperCase())
          : [];
        setDefaultRoles(dRoles);
        setIsDefault(
          dRoles.includes(role.toUpperCase()) || !!first.is_default,
        );
        const cfgCols = Array.isArray(first?.config?.columns)
          ? first.config.columns
          : [
              { key: "title", label: "Title" },
              { key: "status", label: "Status" },
              { key: "updated_at", label: "Updated" },
            ];
        setColumns(cfgCols);
        bumpListViewsVersion(); // ✅ notify others
        navigate(
          `/admin/settings/list-views/${selectedTypeId}/${first.slug}`,
        );
      }
    } catch (err) {
      console.error("[ListViews] delete error", err);
      setError("Failed to delete list view");
    } finally {
      setLoading(false);
    }
  };

  const availableNotSelected = useMemo(() => {
    if (!availableFields || !availableFields.length) return [];
    const selectedKeys = new Set((columns || []).map((c) => c.key));
    return (availableFields || []).filter(
      (f) => !selectedKeys.has(f.key),
    );
  }, [availableFields, columns]);

  // ---------------------------------------------
  // Render
  // ---------------------------------------------
  return (
    <div className="su-page su-page-settings">
      <div className="su-page-header">
        <h1 className="su-page-title">List Views</h1>
        <p className="su-page-subtitle">
          Control which columns show in entry lists, per content type,
          role, and view.
        </p>
      </div>

      {stage === "types" && (
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
                  onClick={() =>
                    handleSelectType(ct.slug || ct.id)
                  }
                  className="su-chip"
                >
                  {ct.name ||
                    ct.label_plural ||
                    ct.label_singular ||
                    ct.slug}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage === "views" && (
        <div>
          <div className="su-card su-mb-lg">
            <div className="su-card-header su-flex su-items-center su-gap-sm">
              <button
                type="button"
                className="su-btn su-btn-ghost su-btn-sm"
                onClick={() => {
                  navigate("/admin/settings/list-views");
                }}
              >
                ← Back to types
              </button>
              <h2 className="su-card-title su-ml-sm">
                Views for{" "}
                {(
                  contentTypes.find(
                    (ct) =>
                      ct.slug === selectedTypeId ||
                      ct.id === selectedTypeId,
                  )?.name ||
                  contentTypes.find(
                    (ct) =>
                      ct.slug === selectedTypeId ||
                      ct.id === selectedTypeId,
                  )?.label_singular ||
                  selectedTypeId ||
                  ""
                )}
              </h2>
            </div>
            <div className="su-card-body">
              {views.length === 0 && (
                <p className="su-text-muted">
                  No saved views yet for this role.
                </p>
              )}
              <div className="su-chip-row su-mb-md">
                {views.map((v) => {
                  const viewDefaultRoles = Array.isArray(
                    v?.config?.default_roles,
                  )
                    ? v.config.default_roles.map((r) =>
                        String(r || "").toUpperCase(),
                      )
                    : [];
                  const viewRoles = Array.isArray(v?.config?.roles)
                    ? v.config.roles.map((r) =>
                        String(r || "").toUpperCase(),
                      )
                    : v.role
                    ? [String(v.role || "").toUpperCase()]
                    : [];
                  const isDefaultForCurrentRole =
                    viewDefaultRoles.length > 0
                      ? viewDefaultRoles.includes(
                          role.toUpperCase(),
                        )
                      : v.is_default &&
                        viewRoles.includes(role.toUpperCase());
                  return (
                    <button
                      key={v.slug}
                      type="button"
                      onClick={() => handleSelectView(v.slug)}
                      className="su-chip"
                    >
                      {v.label}
                      {isDefaultForCurrentRole && (
                        <span className="su-chip-badge">
                          default
                        </span>
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

      {stage === "edit" && (
        <div className="su-layout-grid su-grid-cols-3 su-gap-lg su-mb-xl">
          {/* Left column: edit view details */}
          <div className="su-card">
            <div className="su-card-header su-flex su-items-center su-gap-sm">
              <button
                type="button"
                className="su-btn su-btn-ghost su-btn-sm"
                onClick={() => {
                  navigate(
                    `/admin/settings/list-views/${selectedTypeId}`,
                  );
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
                      <span>
                        {r.charAt(0) +
                          r.slice(1).toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
                <small className="su-text-muted">
                  Select one or more roles that can use this view. You
                  can mark individual roles as default below.
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
                      <span>
                        {r.charAt(0) +
                          r.slice(1).toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
                <small className="su-text-muted">
                  Choose which of the assigned roles should use this
                  view by default.
                </small>
              </div>
              <div className="su-mt-sm su-text-xs su-text-muted">
                <div>
                  Slug:{" "}
                  <code>{activeViewSlug || "(auto)"}</code>
                </div>
              </div>
              <div className="su-mt-md">
                <button
                  type="button"
                  className="su-btn su-btn-primary"
                  onClick={handleSave}
                  disabled={
                    loading ||
                    !selectedTypeId ||
                    !role ||
                    !columns.length
                  }
                >
                  {loading ? "Saving…" : "Save view"}
                </button>
                <button
                  type="button"
                  className="su-btn su-btn-danger su-ml-sm"
                  onClick={handleDeleteCurrentView}
                  disabled={
                    loading ||
                    !selectedTypeId ||
                    !role ||
                    !activeViewSlug ||
                    activeViewSlug === "default"
                  }
                >
                  Delete view
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
                <div className="su-alert su-alert-danger su-mt-md">
                  {error}
                </div>
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
                        <code className="su-badge su-badge-soft">
                          {f.key}
                        </code>
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
              <h2 className="su-card-title">
                Visible columns (order)
              </h2>
              <p className="su-card-subtitle">
                Drag &amp; drop would be nice later; for now use the
                arrows.
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
                        onClick={() =>
                          moveColumn(c.key, "up")
                        }
                        disabled={idx === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="su-btn su-btn-icon su-btn-xs"
                        onClick={() =>
                          moveColumn(c.key, "down")
                        }
                        disabled={idx === columns.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="su-btn su-btn-icon su-btn-xs su-btn-danger"
                        onClick={() =>
                          handleRemoveColumn(c.key)
                        }
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
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
