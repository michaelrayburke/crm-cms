// admin/src/pages/ContentTypes/QuickBuilder.jsx
import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";

// === FIELD TYPES (from old QuickBuilder shim) ===
const RAW_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "boolean",
  "date",
  "json",
  "radio",
  "dropdown",
  "select",
  "multiselect",
  "relation",
  "checkbox",
  "relationship",
  "email",
  "phone",
  "url",
  "address",
  "rich_text",
  "name",
  "datetime",
  "daterange",
  "time",
  "price",
  "image",
  "file",
  "video",
  "color",
  "video_embed",
  "iframe_embed",
  "tags",
  "relation_user",
  "taxonomy",
];

function labelFromFieldType(type) {
  switch (type) {
    case "rich_text":
      return "Rich text";
    case "boolean":
      return "Toggle";
    case "datetime":
      return "Date & time";
    case "daterange":
      return "Date range";
    case "video_embed":
      return "Video embed";
    case "iframe_embed":
      return "Iframe embed";
    case "relation_user":
      return "User relation";
    default:
      return type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
  }
}

const FIELD_TYPES = RAW_FIELD_TYPES.map((t) => ({
  value: t,
  label: labelFromFieldType(t),
}));

// === SUBFIELDS SUPPORT (name/address/media) ===
const SUBFIELD_MAP = {
  name: {
    title: "Title",
    first: "First",
    middle: "Middle",
    last: "Last",
    suffix: "Suffix",
  },
  address: {
    line1: "Address line 1",
    line2: "Address line 2",
    city: "City",
    state: "State / Province",
    postal: "ZIP / Postal",
    country: "Country",
  },
  image: {
    alt: "Alt text",
    title: "Title",
    caption: "Caption",
    credit: "Credit",
  },
  file: {
    title: "Title",
    caption: "Caption",
    credit: "Credit",
  },
  video: {
    title: "Title",
    caption: "Caption",
    credit: "Credit",
  },
};

function supportsSubfields(type) {
  return !!SUBFIELD_MAP[String(type || "").toLowerCase()];
}

function normalizeSubfieldsConfig(config, type) {
  const t = String(type || "").toLowerCase();
  const schema = SUBFIELD_MAP[t] || null;
  const base = config && typeof config === "object" ? { ...config } : {};
  if (!schema) return base;

  const out = { ...base };
  if (!out.subfields || typeof out.subfields !== "object") out.subfields = {};

  // ensure each known subfield exists
  for (const [key, defaultLabel] of Object.entries(schema)) {
    const row = out.subfields[key] || {};
    const show = row.show === undefined ? true : !!row.show;
    const label =
      typeof row.label === "string" && row.label.length
        ? row.label
        : defaultLabel;
    out.subfields[key] = { show, label };
  }

  // prune unknown keys
  for (const key of Object.keys(out.subfields)) {
    if (!schema[key]) delete out.subfields[key];
  }

  return out;
}

function SubfieldControls({ type, config, onChange }) {
  const t = String(type || "").toLowerCase();
  const schema = SUBFIELD_MAP[t] || null;
  if (!schema) return null;

  const normalized = normalizeSubfieldsConfig(config, t);

  function updateRow(key, patch) {
    const next = normalizeSubfieldsConfig(normalized, t);
    next.subfields[key] = { ...next.subfields[key], ...patch };
    onChange(next);
  }

  return (
    <div className="mt-3 rounded-lg border border-dashed border-gray-300 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
        Subfields
      </div>

      <div className="grid grid-cols-[120px,60px,1fr] gap-2 text-xs items-center">
        <div className="font-medium text-gray-500">Key</div>
        <div className="font-medium text-gray-500">Show</div>
        <div className="font-medium text-gray-500">Label</div>

        {Object.entries(schema).map(([key, defaultLabel]) => {
          const row = normalized.subfields[key] || {
            show: true,
            label: defaultLabel,
          };
          return (
            <React.Fragment key={key}>
              <div>
                <code>{key}</code>
              </div>
              <div>
                <input
                  type="checkbox"
                  checked={!!row.show}
                  onChange={(e) =>
                    updateRow(key, { show: !!e.target.checked })
                  }
                />
              </div>
              <div>
                <input
                  className="su-input su-input-xs"
                  value={row.label}
                  onChange={(e) => updateRow(key, { label: e.target.value })}
                />
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// === DEFAULT TYPE MODEL ===
const EMPTY_TYPE = {
  id: null,
  slug: "",
  type: "content",
  label_singular: "",
  label_plural: "",
  description: "",
  icon: "",
};

export default function QuickBuilderPage() {
  const [types, setTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [editingType, setEditingType] = useState(EMPTY_TYPE);
  const [isNewType, setIsNewType] = useState(false);

  const [fields, setFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [activeFieldIndex, setActiveFieldIndex] = useState(null);

  const [savingType, setSavingType] = useState(false);
  const [savingFields, setSavingFields] = useState(false);

  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  // Load all content types on mount
  useEffect(() => {
    let cancelled = false;

    async function loadTypes() {
      try {
        setLoadingTypes(true);
        setError("");
        const data = await api.get("/api/content-types");
        if (cancelled) return;
        setTypes(data || []);

        if ((data || []).length && !selectedTypeId) {
          setSelectedTypeId(data[0].id);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load content types");
        }
      } finally {
        if (!cancelled) setLoadingTypes(false);
      }
    }

    loadTypes();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load fields when selectedTypeId changes
  useEffect(() => {
    if (!selectedTypeId) {
      setFields([]);
      if (!isNewType) {
        setEditingType(EMPTY_TYPE);
      }
      setActiveFieldIndex(null);
      return;
    }

    let cancelled = false;

    async function loadTypeAndFields() {
      try {
        setLoadingFields(true);
        setError("");
        const data = await api.get(`/api/content-types/${selectedTypeId}`);
        if (cancelled) return;

        setEditingType({
          id: data.id,
          slug: data.slug || "",
          type: data.type || "content",
          label_singular: data.label_singular || "",
          label_plural: data.label_plural || "",
          description: data.description || "",
          icon: data.icon || "",
        });

        setFields(
          (data.fields || []).map((f) => {
            const rawType = String(f.type || "text").toLowerCase();

            // Backward/forward compatibility:
            // - older imports used "select" for dropdowns
            // - keep "dropdown" as canonical in the admin
            const normalizedType =
              rawType === "select"
                ? "dropdown"
                : rawType === "relationship"
                ? "relation"
                : rawType;

            const cfg = f.config || {};
            const normalizedConfig = {
              ...cfg,
              // Support both shapes:
              // - config.choices (canonical in ServiceUp admin UI)
              // - config.options (older/SQL/import shape)
              choices: cfg.choices ?? cfg.options ?? null,
              options: cfg.options ?? cfg.choices ?? null,
            };

            return {
              id: f.id,
              field_key: f.field_key,
              label: f.label,
              type: normalizedType,
              required: !!f.required,
              help_text: f.help_text || "",
              order_index:
                typeof f.order_index === "number" ? f.order_index : 0,
              config: normalizedConfig,
            };
          })
        );
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err.message || "Failed to load content type");
        }
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    }

    if (!isNewType) {
      loadTypeAndFields();
    }

    return () => {
      cancelled = true;
    };
  }, [selectedTypeId, isNewType]);

  // ==== TYPE HANDLERS ====
  function startNewType() {
    setError("");
    setSaveMessage("");
    setIsNewType(true);
    setSelectedTypeId(null);
    setEditingType(EMPTY_TYPE);
    setFields([]);
    setActiveFieldIndex(null);
  }

  function handleTypeChange(key, value) {
    setEditingType((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function saveType(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError("");
    setSaveMessage("");

    let {
      slug,
      label_singular,
      label_plural,
      type,
      description,
      icon,
      id,
    } = editingType;

    const trimmedSingular = (label_singular || "").trim();
    let trimmedPlural = (label_plural || "").trim();

    if (!trimmedPlural && trimmedSingular) {
      trimmedPlural = trimmedSingular.endsWith("s")
        ? trimmedSingular
        : `${trimmedSingular}s`;
    }

    let finalSlug = (slug || "").trim();
    if (!finalSlug && trimmedPlural) {
      finalSlug = trimmedPlural
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    }

    if (!finalSlug || !trimmedSingular || !trimmedPlural) {
      setError("Slug, singular label, and plural label are required.");
      return;
    }

    try {
      setSavingType(true);

      let saved;
      if (isNewType || !id) {
        saved = await api.post("/api/content-types", {
          slug: finalSlug,
          type: type || "content",
          label_singular: trimmedSingular,
          label_plural: trimmedPlural,
          description: description || "",
          icon: icon || "",
        });
      } else {
        saved = await api.put(`/api/content-types/${id}`, {
          slug: finalSlug,
          type: type || "content",
          label_singular: trimmedSingular,
          label_plural: trimmedPlural,
          description: description || "",
          icon: icon || "",
        });
      }

      const all = await api.get("/api/content-types");
      setTypes(all || []);

      setEditingType((prev) => ({
        ...prev,
        id: saved.id,
        slug: saved.slug,
        label_singular: saved.label_singular,
        label_plural: saved.label_plural,
        description: saved.description || "",
        icon: saved.icon || "",
        type: saved.type || "content",
      }));
      setSelectedTypeId(saved.id);
      setIsNewType(false);
      setSaveMessage("Content type saved.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save content type");
    } finally {
      setSavingType(false);
    }
  }

  // ==== FIELD HANDLERS ====
  function addFieldRow() {
    setFields((prev) => [
      ...prev,
      {
        id: null,
        field_key: "",
        label: "",
        type: "text",
        required: false,
        help_text: "",
        order_index: prev.length,
        config: {},
      },
    ]);
    setActiveFieldIndex(fields.length);
  }

  function updateFieldRow(index, patch) {
    setFields((prev) =>
      prev.map((field, i) => (i === index ? { ...field, ...patch } : field))
    );
  }

  function removeFieldRow(index) {
    setFields((prev) => prev.filter((_, i) => i !== index));
    if (activeFieldIndex === index) setActiveFieldIndex(null);
  }

  async function saveFields(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError("");
    setSaveMessage("");

    if (!editingType.id) {
      setError("Save the content type first before saving fields.");
      return;
    }

    try {
      setSavingFields(true);

      const payloadFields = fields.map((f, index) => ({
        field_key: f.field_key,
        label: f.label,
        type: f.type || "text",
        required: !!f.required,
        help_text: f.help_text || "",
        order_index:
          typeof f.order_index === "number" ? f.order_index : index,
        config: f.config || {},
      }));

      await api.put(`/api/content-types/${editingType.id}/fields`, {
        fields: payloadFields,
      });

      setSaveMessage("Fields saved.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save fields");
    } finally {
      setSavingFields(false);
    }
  }

  const combinedSaving = savingType || savingFields;
  const hasSelectedType = isNewType || !!editingType.id;

  const contentTypes = types.filter((t) => !t.type || t.type === "content");
  const taxonomyTypes = types.filter((t) => t.type === "taxonomy");

  const renderTypeButton = (t) => {
    const isActive = !isNewType && t.id === selectedTypeId;
    const mainLabel = t.label_plural || t.label_singular || t.slug;
    const isTaxonomy = t.type === "taxonomy";

    return (
      <li key={t.id}>
        <button
          type="button"
          onClick={() => {
            setIsNewType(false);
            setSelectedTypeId(t.id);
            setSaveMessage("");
            setError("");
            setActiveFieldIndex(null);
          }}
          className={
            "w-full rounded px-2 py-1 text-left text-sm " +
            (isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50")
          }
        >
          <div className="flex flex-col gap-[2px]">
            <span>
              {mainLabel}
              {isTaxonomy ? " · Taxonomy" : ""}
            </span>
            {t.slug && (
              <span className="text-[11px] text-gray-500">{t.slug}</span>
            )}
          </div>
        </button>
      </li>
    );
  };

  // === FIELD CONFIG EDITOR (per selected row) ===
  function FieldConfigEditor({ field, onChange }) {
    if (!field) return null;
    const cfg = field.config && typeof field.config === "object"
      ? { ...field.config }
      : {};

    const type = field.type || "text";

    function updateCfg(patch) {
      onChange({ ...cfg, ...patch });
    }

    // Choice helpers
    function choicesToText(c) {
      if (!Array.isArray(c)) return "";
      return c
        .map((item) => {
          if (typeof item === "string") return item;
          if (!item || !item.value) return "";
          if (!item.label || item.label === item.value) return item.value;
          return `${item.value}|${item.label}`;
        })
        .filter(Boolean)
        .join("\n");
    }

    function textToChoices(text) {
      const lines = String(text || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return lines.map((line) => {
        const [value, label] = line.split("|");
        const v = (value || "").trim();
        const l = (label || value || "").trim();
        if (!v) return null;
        return { value: v, label: l || v };
      }).filter(Boolean);
    }

    return (
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
          Field config — {field.label || field.field_key || "(untitled)"}
        </div>

        {/* Choice-based fields */}
        {["radio", "dropdown", "checkbox", "select", "multiselect"].includes(type) && (
          <div className="mb-4 space-y-1">
            <div className="font-medium">Choices</div>
            <p className="text-xs text-gray-500">
              One per line. Use <code>value|Label</code> if you want a separate
              label; otherwise label defaults to the value.
            </p>
            <textarea
              className="su-input"
              rows={4}
              value={choicesToText(cfg.choices)}
              onChange={(e) => updateCfg({ choices: textToChoices(e.target.value) })}
            />
          </div>
        )}

        {/* Tags suggestions */}
        {type === "tags" && (
          <div className="mb-4 space-y-1">
            <div className="font-medium">Tag suggestions</div>
            <p className="text-xs text-gray-500">
              Comma-separated suggestions shown as you type.
            </p>
            <input
              className="su-input"
              value={(cfg.suggestions || []).join(", ")}
              onChange={(e) =>
                updateCfg({
                  suggestions: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="kpop, ballad, rock"
            />
          </div>
        )}

        {/* Relationship config */}
        {["relationship", "relation"].includes(type) && (
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="font-medium">Related content type slug</span>
              <input
                className="su-input"
                value={cfg.relatedType || ""}
                onChange={(e) => updateCfg({ relatedType: e.target.value })}
                placeholder="movie, song, etc."
              />
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={!!cfg.multiple}
                  onChange={(e) => updateCfg({ multiple: e.target.checked })}
                />
                <span>Allow multiple related items</span>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={!!cfg.twoWay}
                  onChange={(e) => updateCfg({ twoWay: e.target.checked })}
                />
                <span>Two-way relation (sync inverse)</span>
              </label>
            </div>
            <label className="md:col-span-2 space-y-1">
              <span className="font-medium text-xs">
                Inverse field key on related type
              </span>
              <input
                className="su-input"
                value={cfg.inverseKey || ""}
                onChange={(e) => updateCfg({ inverseKey: e.target.value })}
                placeholder="e.g. movies_for_artist"
              />
            </label>
          </div>
        )}

        {/* Media upload config */}
        {["image", "file", "video"].includes(type) && (
          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
            <label className="space-y-1">
              <span className="font-medium">Accept MIME types</span>
              <input
                className="su-input"
                value={cfg.accept || ""}
                onChange={(e) => updateCfg({ accept: e.target.value })}
                placeholder="image/*,application/pdf"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium">Max file size (MB)</span>
              <input
                type="number"
                className="su-input"
                value={cfg.maxSizeMB ?? ""}
                onChange={(e) =>
                  updateCfg({
                    maxSizeMB: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </label>
          </div>
        )}

        {/* Subfields (name/address/media meta) */}
        {supportsSubfields(type) && (
          <SubfieldControls
            type={type}
            config={cfg}
            onChange={(subCfg) => onChange(subCfg)}
          />
        )}

        {![
          "radio",
          "dropdown",
          "checkbox",
          "tags",
          "relationship",
          "image",
          "file",
          "video",
          "name",
          "address",
        ].includes(type) &&
          !supportsSubfields(type) && (
            <div className="text-xs text-gray-500">
              This field type has no extra config yet. (We can always add more
              later.)
            </div>
          )}
      </div>
    );
  }

  // === RENDER ===
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">QuickBuilder 2.0</h1>
        <p className="text-sm text-gray-600">
          Define your content types and their fields. These definitions power
          entry lists, editors, and relationships throughout ServiceUp.
        </p>
      </div>

      {error && (
        <div
          className="su-card"
          style={{ borderColor: "#fecaca", background: "#fef2f2" }}
        >
          <div style={{ color: "#991b1b", fontSize: 13 }}>{error}</div>
        </div>
      )}

      {saveMessage && (
        <div
          className="su-card"
          style={{ borderColor: "#bbf7d0", background: "#f0fdf4" }}
        >
          <div style={{ color: "#166534", fontSize: 13 }}>{saveMessage}</div>
        </div>
      )}

      <div className="su-grid cols-3 gap-6">
        {/* LEFT: type list */}
        <div className="su-card self-start">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-base font-medium">Content Types</h2>
            <button
              type="button"
              className="su-btn su-btn-sm"
              onClick={startNewType}
            >
              + New type
            </button>
          </div>

          {loadingTypes ? (
            <div style={{ fontSize: 13 }}>Loading types...</div>
          ) : !types.length ? (
            <div style={{ fontSize: 13 }}>
              No content types yet. Create your first one with{" "}
              <strong>New type</strong>.
            </div>
          ) : (
            <>
              {contentTypes.length > 0 && (
                <ul
                  className="space-y-1"
                  style={{ listStyle: "none", padding: 0 }}
                >
                  {contentTypes.map(renderTypeButton)}
                </ul>
              )}

              {taxonomyTypes.length > 0 && (
                <>
                  <div className="mt-4 mb-1 text-[11px] uppercase tracking-wide text-gray-500">
                    Taxonomies
                  </div>
                  <ul
                    className="space-y-1"
                    style={{ listStyle: "none", padding: 0 }}
                  >
                    {taxonomyTypes.map(renderTypeButton)}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        {/* RIGHT: details + fields */}
        <div className="su-card col-span-2 space-y-6">
          {/* TYPE DETAILS */}
          <form onSubmit={saveType} className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="m-0 text-base font-medium">
                {isNewType ? "New Content Type" : "Content Type Details"}
              </h2>
              <button
                type="submit"
                className="su-btn su-btn-sm"
                disabled={savingType}
              >
                {savingType ? "Saving..." : "Save type"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Slug</span>
                <input
                  type="text"
                  className="su-input"
                  value={editingType.slug}
                  onChange={(e) =>
                    handleTypeChange("slug", e.target.value.toLowerCase())
                  }
                  placeholder="content-type"
                />
                <div className="text-[11px] text-gray-500">
                  Internal ID, usually lower_snake_case. Cannot be duplicated.
                </div>
              </label>

              <label className="space-y-1 text-sm">
                <span>Type</span>
                <select
                  className="su-input"
                  value={editingType.type}
                  onChange={(e) => handleTypeChange("type", e.target.value)}
                >
                  <option value="content">Content</option>
                  <option value="taxonomy">Taxonomy</option>
                </select>
                <div className="text-[11px] text-gray-500">
                  Use <strong>Taxonomy</strong> for categories, tags, etc.
                </div>
              </label>

              <label className="space-y-1 text-sm">
                <span>Singular label</span>
                <input
                  type="text"
                  className="su-input"
                  value={editingType.label_singular}
                  onChange={(e) =>
                    handleTypeChange("label_singular", e.target.value)
                  }
                  placeholder="Movie"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span>Plural label</span>
                <input
                  type="text"
                  className="su-input"
                  value={editingType.label_plural}
                  onChange={(e) =>
                    handleTypeChange("label_plural", e.target.value)
                  }
                  placeholder="Movies"
                />
              </label>

              <label className="text-sm md:col-span-2 space-y-1">
                <span>Description</span>
                <textarea
                  className="su-input"
                  rows={2}
                  value={editingType.description}
                  onChange={(e) =>
                    handleTypeChange("description", e.target.value)
                  }
                  placeholder="Short description of this content type."
                />
              </label>
            </div>
          </form>

          {/* FIELDS */}
          <form onSubmit={saveFields} className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="m-0 text-base font-medium">Fields</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="su-btn su-btn-sm su-btn-ghost"
                  onClick={addFieldRow}
                  disabled={!hasSelectedType}
                >
                  + Add field
                </button>
                <button
                  type="submit"
                  className="su-btn su-btn-sm"
                  disabled={!hasSelectedType || savingFields}
                >
                  {savingFields ? "Saving..." : "Save fields"}
                </button>
              </div>
            </div>

            {!hasSelectedType ? (
              <div className="text-sm text-gray-600">
                Create and save a content type first, then you can define its
                fields.
              </div>
            ) : loadingFields && !isNewType ? (
              <div className="text-sm text-gray-600">Loading fields...</div>
            ) : !fields.length ? (
              <div className="text-sm text-gray-600">
                No fields yet. Click <strong>Add field</strong> to define your
                first field.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="py-2 pr-2">Key</th>
                        <th className="py-2 pr-2">Label</th>
                        <th className="py-2 pr-2">Type</th>
                        <th className="py-2 pr-2">Required</th>
                        <th className="py-2 pr-2">Order</th>
                        <th className="py-2 pr-2">Help text</th>
                        <th className="py-2 pr-2 text-right">Config</th>
                        <th className="py-2 pr-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => (
                        <tr
                          key={index}
                          className="border-b border-gray-100 align-top"
                        >
                          <td className="py-1 pr-2">
                            <input
                              type="text"
                              className="su-input su-input-sm"
                              value={field.field_key}
                              onChange={(e) =>
                                updateFieldRow(index, {
                                  field_key: e.target.value,
                                })
                              }
                              placeholder="field_key"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="text"
                              className="su-input su-input-sm"
                              value={field.label}
                              onChange={(e) =>
                                updateFieldRow(index, { label: e.target.value })
                              }
                              placeholder="Field label"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <select
                              className="su-input su-input-sm min-w-[180px]"
                              value={field.type}
                              onChange={(e) => {
                                updateFieldRow(index, {
                                  type: e.target.value,
                                });
                              }}
                            >
                              {FIELD_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="checkbox"
                              checked={!!field.required}
                              onChange={(e) =>
                                updateFieldRow(index, {
                                  required: e.target.checked,
                                })
                              }
                            />
                          </td>
                          <td className="py-1 pr-2" style={{ width: 70 }}>
                            <input
                              type="number"
                              className="su-input su-input-sm"
                              value={
                                typeof field.order_index === "number"
                                  ? field.order_index
                                  : index
                              }
                              onChange={(e) =>
                                updateFieldRow(index, {
                                  order_index: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="text"
                              className="su-input su-input-sm"
                              value={field.help_text}
                              onChange={(e) =>
                                updateFieldRow(index, {
                                  help_text: e.target.value,
                                })
                              }
                              placeholder="Shown under the field in editors"
                            />
                          </td>
                          <td className="py-1 pr-2 text-right">
                            <button
                              type="button"
                              className={
                                "su-btn su-btn-xs " +
                                (activeFieldIndex === index
                                  ? "su-btn-primary"
                                  : "su-btn-ghost")
                              }
                              onClick={() =>
                                setActiveFieldIndex((prev) =>
                                  prev === index ? null : index
                                )
                              }
                            >
                              {activeFieldIndex === index
                                ? "Hide config"
                                : "Edit config"}
                            </button>
                          </td>
                          <td className="py-1 pr-0 text-right">
                            <button
                              type="button"
                              className="su-btn su-btn-xs su-btn-danger"
                              onClick={() => removeFieldRow(index)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {activeFieldIndex !== null &&
                  fields[activeFieldIndex] && (
                    <FieldConfigEditor
                      field={fields[activeFieldIndex]}
                      onChange={(cfg) =>
                        updateFieldRow(activeFieldIndex, { config: cfg })
                      }
                    />
                  )}
              </>
            )}
          </form>

          {combinedSaving && (
            <div className="text-[11px] text-gray-500">
              Saving… please don&apos;t close this tab.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
