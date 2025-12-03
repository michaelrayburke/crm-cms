import { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "../../lib/api";
import FieldInput from "../../components/FieldInput";
// import { useAuth } from '../../context/AuthContext';

// Simple slug helper
function slugify(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build a layout from the editor view config + content type fields.
 * If no config exists, falls back to a single section with all fields.
 */
function buildLayoutFromView(contentType, viewConfig) {
  if (!contentType) return [];

  // Build a lookup of custom fields by key. Do NOT include built-in fields
  const rawFields = Array.isArray(contentType.fields) ? contentType.fields : [];
  const fields = rawFields
    .map((f) => {
      if (!f) return null;
      const key = f.key || f.field_key;
      return key ? { ...f, key } : null;
    })
    .filter(Boolean);

  const fieldsByKey = {};
  fields.forEach((f) => {
    if (f && f.key) fieldsByKey[f.key] = f;
  });

  const sections = [];
  const cfgSections =
    viewConfig && Array.isArray(viewConfig.sections)
      ? viewConfig.sections
      : null;

  if (cfgSections && cfgSections.length) {
    for (const sec of cfgSections) {
      const rows = [];
      let columns = 1;
      if (typeof sec.layout === "string") {
        if (sec.layout.includes("two")) columns = 2;
        if (sec.layout.includes("three")) columns = 3;
      }
      if (sec.columns && Number.isInteger(sec.columns)) {
        columns = sec.columns;
      }
      for (const fCfgRaw of sec.fields || []) {
        let key;
        let width = 1;
        let visible = true;
        if (typeof fCfgRaw === "string") {
          key = fCfgRaw;
        } else if (fCfgRaw && typeof fCfgRaw === "object") {
          key = fCfgRaw.key;
          width = fCfgRaw.width || 1;
          if (fCfgRaw.visible === false) visible = false;
        }
        if (!key) continue;
        const def = fieldsByKey[key];
        if (!def) continue;
        if (visible === false) continue;
        rows.push({ def, width });
      }
      if (rows.length) {
        sections.push({
          id: sec.id || sec.title || `section-${sections.length}`,
          title: sec.title || "",
          columns,
          rows,
        });
      }
    }
  }

  if (!sections.length && fields.length) {
    sections.push({
      id: "main",
      title: "Fields",
      columns: 1,
      rows: fields.map((def) => ({
        def,
        width: 1,
      })),
    });
  }

  return sections;
}

export default function Editor() {
  const { typeSlug, entryId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // const { user } = useAuth();
  const roleUpper = (/* user?.role || */ "ADMIN").toUpperCase();
  const isNew = !entryId || entryId === "new";

  const [loadingEntry, setLoadingEntry] = useState(!isNew);
  const [loadingType, setLoadingType] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  // Core entry fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("draft");

  // Structured custom data from entries.data
  const [data, setData] = useState({});

  // Content type + editor view
  const [contentType, setContentType] = useState(null);
  const [editorViewConfig, setEditorViewConfig] = useState(null);
  const [editorViews, setEditorViews] = useState([]);
  const [activeViewSlug, setActiveViewSlug] = useState("");
  const [activeViewLabel, setActiveViewLabel] = useState("");

  const overallLoading = loadingEntry || loadingType;

  // Title label (future-proof: you can later store a custom label on the content type)
  const titleLabel = useMemo(() => {
    if (!contentType) return "Title";
    return (
      contentType.title_label ||
      contentType.titleLabel ||
      contentType.display_title_label ||
      "Title"
    );
  }, [contentType]);

  // ---------------------------------------------------------------------------
  // Load content type + editor views
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadTypeAndView() {
      setLoadingType(true);
      setError("");

      try {
        const res = await api.get("/api/content-types");
        const list = Array.isArray(res) ? res : res?.data || [];

        const basicCt =
          list.find(
            (t) =>
              t.slug === typeSlug ||
              t.slug?.toLowerCase() === typeSlug?.toLowerCase()
          ) || null;

        if (!basicCt) {
          if (!cancelled) {
            setError(`Content type "${typeSlug}" not found.`);
          }
          return;
        }

        if (cancelled) return;

        // Full CT with fields
        let fullCt;
        try {
          const fullRes = await api.get(`/api/content-types/${basicCt.id}`);
          fullCt = fullRes?.data || fullRes || basicCt;
        } catch (e) {
          console.warn("Failed to load full content type, falling back", e);
          fullCt = basicCt;
        }

        if (cancelled) return;
        setContentType(fullCt);

        // Load editor views by role
        let views = [];
        if (fullCt && fullCt.id) {
          try {
            const vRes = await api.get(
              `/api/content-types/${fullCt.id}/editor-views?role=${encodeURIComponent(
                roleUpper
              )}`
            );
            const rawViews = vRes?.data ?? vRes;
            if (Array.isArray(rawViews)) views = rawViews;
            else if (rawViews && Array.isArray(rawViews.views))
              views = rawViews.views;
          } catch (err) {
            console.warn(
              "[Editor] Failed to load editor views; using auto layout",
              err?.response?.data || err
            );
          }
        }
        if (!cancelled) setEditorViews(views || []);

        // Choose view: ?view or default
        let chosenView = null;
        if (views && views.length) {
          const viewFromUrl = searchParams.get("view") || "";
          const defaultView =
            views.find((v) => {
              const cfg = v.config || {};
              const dRoles = Array.isArray(cfg.default_roles)
                ? cfg.default_roles.map((r) =>
                    String(r || "").toUpperCase()
                  )
                : [];
              if (dRoles.length) return dRoles.includes(roleUpper);
              return !!v.is_default;
            }) || views[0];

          if (viewFromUrl) {
            const fromUrl = views.find((v) => v.slug === viewFromUrl);
            chosenView = fromUrl || defaultView;
          } else {
            chosenView = defaultView;
          }
        }

        if (chosenView) {
          if (!cancelled) {
            setActiveViewSlug(chosenView.slug);
            setActiveViewLabel(chosenView.label || chosenView.slug);
            setEditorViewConfig(chosenView.config || {});
          }
          const currentViewParam = searchParams.get("view");
          if (currentViewParam !== chosenView.slug) {
            const next = new URLSearchParams(searchParams);
            next.set("view", chosenView.slug);
            setSearchParams(next);
          }
        } else {
          if (!cancelled) {
            setActiveViewSlug("");
            setActiveViewLabel("");
            setEditorViewConfig({});
          }
          if (searchParams.get("view")) {
            const next = new URLSearchParams(searchParams);
            next.delete("view");
            setSearchParams(next);
          }
        }
      } catch (err) {
        console.error("Failed to load content types", err);
        if (!cancelled) {
          setError(err.message || "Failed to load content type");
        }
      } finally {
        if (!cancelled) setLoadingType(false);
      }
    }

    loadTypeAndView();

    return () => {
      cancelled = true;
    };
  }, [typeSlug]);

  const sections = useMemo(
    () => buildLayoutFromView(contentType, editorViewConfig),
    [contentType, editorViewConfig]
  );

  // ---------------------------------------------------------------------------
  // Load existing entry
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isNew) {
      setTitle("");
      setSlug("");
      setStatus("draft");
      setData({});
      setLoadingEntry(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadingEntry(true);
      setError("");
      setSaveMessage("");
      try {
        const res = await api.get(`/api/content/${typeSlug}/${entryId}`);
        if (res && res.ok === false) {
          throw new Error(res.error || res.detail || "Failed to load entry");
        }

        const entry = res.entry || res.data || res;
        if (cancelled) return;

        // --- SAFE NORMALIZATION OF entry.data ---
        // Support shapes:
        //   data: {...fields...}
        //   data: { data: {...fields...} }
        //   data: { undefined: {...fields...} }  (legacy bug)
        let entryDataRaw =
          (entry && entry.data && typeof entry.data === "object"
            ? entry.data
            : {}) || {};

        if (
          entryDataRaw &&
          typeof entryDataRaw === "object" &&
          entryDataRaw.data &&
          typeof entryDataRaw.data === "object"
        ) {
          entryDataRaw = entryDataRaw.data;
        }

        let entryData = { ...entryDataRaw };

        if (entryData && typeof entryData === "object") {
          const keys = Object.keys(entryData);
          if (
            keys.length === 1 &&
            keys[0] === "undefined" &&
            entryData.undefined &&
            typeof entryData.undefined === "object"
          ) {
            entryData = { ...entryData.undefined };
          } else if (
            entryData.undefined &&
            typeof entryData.undefined === "object"
          ) {
            const inner = entryData.undefined;
            delete entryData.undefined;
            entryData = {
              ...inner,
              ...entryData,
            };
          }
        }

        const loadedTitle =
          entry.title ?? entryData.title ?? entryData._title ?? "";
        const loadedSlug =
          entry.slug ?? entryData.slug ?? entryData._slug ?? "";
        const loadedStatus =
          entry.status ?? entryData.status ?? entryData._status ?? "draft";

        setTitle(loadedTitle);
        setSlug(loadedSlug);
        setStatus(loadedStatus);
        setData(entryData || {});
      } catch (err) {
        console.error("Failed to load entry", err);
        if (!cancelled) {
          setError(err.message || "Failed to load entry");
        }
      } finally {
        if (!cancelled) setLoadingEntry(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isNew, typeSlug, entryId]);

  // ---------------------------------------------------------------------------
  // Save / Delete
  // ---------------------------------------------------------------------------
  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setSaveMessage("");

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    const finalSlug = slug.trim() || slugify(title);

    try {
      setSaving(true);

      const sanitized = {};
      if (data && typeof data === "object") {
        Object.entries(data).forEach(([k, v]) => {
          if (!k || k === "undefined") return;
          sanitized[k] = v;
        });
      }
      const mergedData = {
        ...sanitized,
        title: title.trim(),
        slug: finalSlug,
        status,
        _title: title.trim(),
        _slug: finalSlug,
        _status: status,
      };

      const payload = {
        title: title.trim(),
        slug: finalSlug,
        status,
        data: mergedData,
      };

      if (isNew) {
        const res = await api.post(`/api/content/${typeSlug}`, payload);
        if (res && res.ok === false) {
          throw new Error(res.error || res.detail || "Failed to create entry");
        }

        const created = res.entry || res.data || res;
        const newId =
          created?.id ?? created?.entry?.id ?? created?.data?.id ?? null;
        const newSlug =
          created?.slug ??
          created?.entry?.slug ??
          created?.data?.slug ??
          finalSlug;

        if (newId) {
          const slugOrId = newSlug || newId;
          navigate(`/admin/content/${typeSlug}/${slugOrId}`, {
            replace: true,
          });
          setSaveMessage("Entry created.");
        } else {
          setSaveMessage("Entry created (reload list to see it).");
        }
      } else {
        const res = await api.put(
          `/api/content/${typeSlug}/${entryId}`,
          payload
        );
        if (res && res.ok === false) {
          throw new Error(res.error || res.detail || "Failed to save entry");
        }

        const updated = res.entry || res.data || res;
        if (updated) {
          const entryData = updated.data || mergedData;
          const loadedTitle =
            updated.title ?? entryData.title ?? entryData._title ?? title;
          const loadedSlug =
            updated.slug ?? entryData.slug ?? entryData._slug ?? finalSlug;
          const loadedStatus =
            updated.status ??
            entryData.status ??
            entryData._status ??
            status;

          setTitle(loadedTitle);
          setSlug(loadedSlug);
          setStatus(loadedStatus);
          setData(entryData);

          if (loadedSlug && loadedSlug !== entryId) {
            navigate(`/admin/content/${typeSlug}/${loadedSlug}`, {
              replace: true,
            });
          }
        }

        setSaveMessage("Entry saved.");
      }
    } catch (err) {
      console.error("Failed to save entry", err);
      setError(err.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (isNew) {
      navigate(`/admin/content/${typeSlug}`);
      return;
    }

    if (!window.confirm("Delete this entry? This cannot be undone.")) {
      return;
    }

    try {
      setSaving(true);
      setSaveMessage("");
      const res = await api.del(`/api/content/${typeSlug}/${entryId}`);
      if (res && res.ok === false) {
        throw new Error(res.error || res.detail || "Failed to delete entry");
      }
      navigate(`/admin/content/${typeSlug}`);
    } catch (err) {
      console.error("Failed to delete entry", err);
      setError(err.message || "Failed to delete entry");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Preview helpers
  // ---------------------------------------------------------------------------
  const previewData = useMemo(
    () => ({
      ...data,
      title,
      slug,
      status,
    }),
    [data, title, slug, status]
  );

  const customFieldEntries = useMemo(
    () => Object.entries(data || {}),
    [data]
  );

  function prettyValue(v) {
    if (v === null || v === undefined) return "";
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      return String(v);
    }
    if (Array.isArray(v)) {
      if (!v.length) return "";
      if (v.every((x) => typeof x === "string" || typeof x === "number")) {
        return v.join(", ");
      }
      return JSON.stringify(v);
    }
    if (typeof v === "object") {
      if (
        v.label &&
        (typeof v.value === "string" || typeof v.value === "number")
      ) {
        return `${v.label} (${v.value})`;
      }
      if (v.label && !v.value) return String(v.label);
      return JSON.stringify(v);
    }
    return String(v);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="su-grid cols-2">
      {/* LEFT: Editor card */}
      <div className="su-card">
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>
          {overallLoading
            ? "Edit entry"
            : isNew
            ? `New ${typeSlug} entry`
            : `Edit ${typeSlug}`}
        </h2>

        {/* Editor view selector */}
        {editorViews.length > 0 && (
          <div className="su-card su-mb-md">
            <div className="su-card-body su-flex su-flex-wrap su-gap-sm su-items-center">
              <span className="su-text-sm su-text-muted">Views:</span>
              {editorViews.map((v) => {
                const cfg = v.config || {};
                const dRoles = Array.isArray(cfg.default_roles)
                  ? cfg.default_roles.map((r) =>
                      String(r || "").toUpperCase()
                    )
                  : [];
                const isDefaultForRole = dRoles.length
                  ? dRoles.includes(roleUpper)
                  : !!v.is_default;
                return (
                  <button
                    key={v.slug}
                    type="button"
                    className={
                      "su-chip" +
                      (v.slug === activeViewSlug ? " su-chip--active" : "")
                    }
                    onClick={() => {
                      if (v.slug === activeViewSlug) return;
                      setActiveViewSlug(v.slug);
                      setActiveViewLabel(v.label || v.slug);
                      setEditorViewConfig(v.config || {});
                      const next = new URLSearchParams(searchParams);
                      next.set("view", v.slug);
                      setSearchParams(next);
                    }}
                  >
                    {v.label || v.slug}
                    {isDefaultForRole && (
                      <span className="su-chip-badge">default</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {saveMessage && !error && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #bbf7d0",
              background: "#ecfdf3",
              color: "#166534",
              fontSize: 13,
            }}
          >
            {saveMessage}
          </div>
        )}

        {overallLoading && !isNew && (
          <p style={{ fontSize: 13, opacity: 0.7 }}>Loading entry…</p>
        )}

        <form onSubmit={handleSave}>
          {/* Core fields */}
          <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
            <label style={{ fontSize: 13 }}>
              {titleLabel}
              <input
                className="su-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  titleLabel === "Title"
                    ? "My great entry"
                    : titleLabel || "My great entry"
                }
              />
            </label>

            <label style={{ fontSize: 13 }}>
              Slug
              <input
                className="su-input"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={slugify(title || "my-entry")}
              />
            </label>

            <label style={{ fontSize: 13 }}>
              Status
              <select
                className="su-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>

          {/* Structured fields powered by QuickBuilder + Editor Views */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14 }}>Fields</h3>
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                Powered by QuickBuilder &amp; editor views.
              </span>
            </div>

            {!sections.length && (
              <p style={{ fontSize: 12, opacity: 0.7 }}>
                No fields defined for this content type yet. Create fields in
                QuickBuilder.
              </p>
            )}

            {sections.map((section) => (
              <div
                key={section.id}
                style={{
                  border: "1px solid var(--su-border)",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  background: "var(--su-surface)",
                }}
              >
                {section.title && (
                  <div
                    style={{
                      marginBottom: 8,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {section.title}
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: `repeat(${
                      section.columns || 1
                    }, minmax(0, 1fr))`,
                  }}
                >
                  {section.rows.map(({ def, width }) => {
                    const key = def && def.key;
                    if (!key) return null;

                    // 🔑 Robust lookup: support several legacy shapes
                    let value;
                    if (data && typeof data === "object") {
                      if (key in data) {
                        value = data[key];
                      } else if (`_${key}` in data) {
                        value = data[`_${key}`];
                      } else if (
                        data.undefined &&
                        typeof data.undefined === "object"
                      ) {
                        if (key in data.undefined) {
                          value = data.undefined[key];
                        } else if (`_${key}` in data.undefined) {
                          value = data.undefined[`_${key}`];
                        }
                      }
                    }

                    return (
                      <div
                        key={key}
                        style={{ gridColumn: `span ${width || 1}` }}
                      >
                        <FieldInput
                          field={def}
                          value={value}
                          onChange={(val) => {
                            if (!key) return;
                            setData((prev) => ({
                              ...(prev || {}),
                              [key]: val,
                            }));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="su-btn primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : isNew ? "Create entry" : "Save entry"}
            </button>
            <button
              className="su-btn"
              type="button"
              onClick={() => navigate(-1)}
              disabled={saving}
            >
              Back
            </button>
            <button
              className="su-btn"
              type="button"
              onClick={handleDelete}
              disabled={saving}
              style={{
                borderColor: "#fecaca",
                background: "#fef2f2",
                color: "#b91c1c",
              }}
            >
              {isNew ? "Cancel" : "Delete"}
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT: Preview card */}
      <div className="su-card">
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Preview</h2>

        <div
          style={{
            borderRadius: 10,
            border: "1px solid var(--su-border)",
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {title || "(untitled entry)"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              /{slug || slugify(title || "my-entry")} ·{" "}
              <span style={{ textTransform: "uppercase" }}>{status}</span>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--su-border)",
              paddingTop: 8,
            }}
          >
            {customFieldEntries.length === 0 && (
              <p style={{ fontSize: 12, opacity: 0.7 }}>No fields yet.</p>
            )}
            {customFieldEntries.map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px minmax(0,1fr)",
                  gap: 8,
                  padding: "4px 0",
                  fontSize: 13,
                }}
              >
                <div style={{ opacity: 0.7 }}>{key}</div>
                <div>{prettyValue(value)}</div>
              </div>
            ))}
          </div>
        </div>

        <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 14 }}>
          Raw JSON (<code>entries.data</code>)
        </h3>
        <pre
          style={{
            fontSize: 11,
            background: "#0b1120",
            color: "#d1fae5",
            borderRadius: 10,
            padding: 10,
            maxHeight: 480,
            overflow: "auto",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {JSON.stringify(previewData, null, 2)}
        </pre>
      </div>
    </div>
  );
}
