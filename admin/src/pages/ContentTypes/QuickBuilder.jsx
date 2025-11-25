// admin/src/pages/ContentTypes/QuickBuilder.jsx
import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "rich_text", label: "Rich text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Toggle" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & time" },
  { value: "media", label: "Media" },
  { value: "relationship", label: "Relationship" },
  { value: "tags", label: "Tags" },
];

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

        // Auto-select first type if any exist
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
          (data.fields || []).map((f) => ({
            id: f.id,
            field_key: f.field_key,
            label: f.label,
            type: f.type,
            required: !!f.required,
            help_text: f.help_text || "",
            order_index:
              typeof f.order_index === "number" ? f.order_index : 0,
            config: f.config || {},
          }))
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

  function startNewType() {
    setError("");
    setSaveMessage("");
    setIsNewType(true);
    setSelectedTypeId(null);
    setEditingType(EMPTY_TYPE);
    setFields([]);
  }

  function handleTypeChange(key, value) {
    setEditingType((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

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
  }

  function updateFieldRow(index, patch) {
    setFields((prev) =>
      prev.map((field, i) => (i === index ? { ...field, ...patch } : field))
    );
  }

  function removeFieldRow(index) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveType(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError("");
    setSaveMessage("");

    if (!editingType.slug || !editingType.label_singular || !editingType.label_plural) {
      setError("Slug, singular label, and plural label are required.");
      return;
    }

    try {
      setSavingType(true);

      let saved;
      if (isNewType || !editingType.id) {
        saved = await api.post("/api/content-types", {
          slug: editingType.slug,
          type: editingType.type || "content",
          label_singular: editingType.label_singular,
          label_plural: editingType.label_plural,
          description: editingType.description || "",
          icon: editingType.icon || "",
        });
      } else {
        saved = await api.put(`/api/content-types/${editingType.id}`, {
          slug: editingType.slug,
          type: editingType.type || "content",
          label_singular: editingType.label_singular,
          label_plural: editingType.label_plural,
          description: editingType.description || "",
          icon: editingType.icon || "",
        });
      }

      // Refresh list
      const all = await api.get("/api/content-types");
      setTypes(all || []);

      setEditingType((prev) => ({ ...prev, id: saved.id }));
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-1">QuickBuilder 2.0</h1>
        <p className="text-sm text-gray-600">
          Define your content types and their fields. These definitions power entry lists,
          editors, and relationships throughout ServiceUp.
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

      <div className="su-grid cols-3">
        {/* Left column: list of content types */}
        <div className="su-card" style={{ alignSelf: "flex-start" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium m-0">Content Types</h2>
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
            <ul className="space-y-1" style={{ listStyle: "none", padding: 0 }}>
              {types.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewType(false);
                      setSelectedTypeId(t.id);
                      setSaveMessage("");
                      setError("");
                    }}
                    className={
                      "w-full text-left px-2 py-1 rounded text-sm " +
                      (t.id === selectedTypeId && !isNewType
                        ? "bg-blue-50 text-blue-700"
                        : "hover:bg-gray-50")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{t.label_plural}</span>
                      <span
                        className="text-[11px] uppercase tracking-wide opacity-70"
                      >
                        {t.slug}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Middle + right columns: builder */}
        <div className="su-card col-span-2 space-y-6">
          {/* Type details */}
          <form onSubmit={saveType} className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-medium m-0">
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

            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-sm space-y-1">
                <span>Slug</span>
                <input
                  type="text"
                  className="su-input"
                  value={editingType.slug}
                  onChange={(e) =>
                    handleTypeChange("slug", e.target.value.toUpperCase())
                  }
                  placeholder="MOVIE, BLOG_POST, CATEGORY"
                />
                <div className="text-[11px] text-gray-500">
                  Internal ID, usually UPPER_SNAKE_CASE. Cannot be duplicated.
                </div>
              </label>

              <label className="text-sm space-y-1">
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

              <label className="text-sm space-y-1">
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

              <label className="text-sm space-y-1">
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

              <label className="text-sm space-y-1 md:col-span-2">
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

          {/* Fields editor */}
          <form onSubmit={saveFields} className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-medium m-0">Fields</h2>
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
                Create and save a content type first, then you can define its fields.
              </div>
            ) : loadingFields && !isNewType ? (
              <div className="text-sm text-gray-600">Loading fields...</div>
            ) : !fields.length ? (
              <div className="text-sm text-gray-600">
                No fields yet. Click <strong>Add field</strong> to define your first field.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200">
                      <th className="py-2 pr-2">Key</th>
                      <th className="py-2 pr-2">Label</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Required</th>
                      <th className="py-2 pr-2">Order</th>
                      <th className="py-2 pr-2">Help text</th>
                      <th className="py-2 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => (
                      <tr key={index} className="border-b border-gray-100 align-top">
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
                            className="su-input su-input-sm"
                            value={field.type}
                            onChange={(e) =>
                              updateFieldRow(index, { type: e.target.value })
                            }
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
