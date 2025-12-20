// admin/src/components/FieldInput.jsx 

import React, { useState, useMemo } from "react";
import RichTextEditor from "./RichTextEditor";
import { combineDateAndTimeToUTC } from "../utils/datetime";
import { contrastRatio, normalizeHex } from "../utils/color";
import {
  uploadToSupabase,
  getSignedUrl,
  resolveBucketName,
} from "../lib/storage";

/** ---------- Helpers ---------- */

// Normalize choices to array of { value, label }
function normalizeChoices(input) {
  if (!input) return [];
  if (Array.isArray(input) && input.every((x) => typeof x === "string")) {
    return input.map((s) => ({ value: String(s), label: String(s) }));
  }
  if (Array.isArray(input)) {
    return input
      .map((it) => {
        if (it == null) return null;
        if (
          typeof it === "string" ||
          typeof it === "number" ||
          typeof it === "boolean"
        ) {
          const s = String(it);
          return { value: s, label: s };
        }
        const value =
          it.value ??
          it.slug ??
          it.id ??
          it.key ??
          it.code ??
          it.name ??
          it.title ??
          it.label;
        const label =
          it.label ??
          it.title ??
          it.name ??
          it.value ??
          it.slug ??
          it.id ??
          it.code ??
          value;
        return value != null
          ? { value: String(value), label: String(label) }
          : null;
      })
      .filter(Boolean);
  }
  return [];
}

// Upload policy resolver (simple accept/max + optional rules[])
function resolveUploadPolicy(options) {
  const simpleAccept = options?.accept;
  const simpleMax = options?.maxSizeMB;
  const rules = Array.isArray(options?.rules) ? options.rules : null;
  if (!rules || rules.length === 0)
    return { accept: simpleAccept, maxSizeMB: simpleMax };
  const acceptAttr = rules.map((r) => r.accept).filter(Boolean).join(",");
  return { accept: acceptAttr || simpleAccept, maxSizeMB: simpleMax, rules };
}

/**
 * IMPORTANT:
 * Your platform now stores "field config" in field.config (DB-backed),
 * but some older UI code used field.options.
 * This normalizes so we can read both.
 */
function getFieldConfig(field) {
  const cfg =
    (field?.config && typeof field.config === "object" ? field.config : null) ||
    (field?.options && typeof field.options === "object" ? field.options : {}) ||
    {};
  return cfg;
}

/**
 * Normalize "choices" across possible shapes:
 * - config.choices (preferred, current)
 * - config.options (legacy)
 * - field.choices / field.options (super legacy)
 */
function getFieldChoices(field) {
  const cfg = getFieldConfig(field);
  return (
    cfg.choices ??
    cfg.options ??
    field?.choices ??
    field?.options ??
    []
  );
}

/** Subfield config helper */
function subCfg(field, key, fallbackLabel, defaultShow = true) {
  const cfg = getFieldConfig(field);
  const s =
    cfg.subfields && typeof cfg.subfields === "object" ? cfg.subfields[key] || {} : {};
  return {
    show: s.show !== undefined ? !!s.show : !!defaultShow,
    label:
      typeof s.label === "string" && s.label.length ? s.label : fallbackLabel,
  };
}

/** Simple NAME field with subfields */
function NameField({ field, value, onChange }) {
  const v = value && typeof value === "object" ? value : {};
  const set = (patch) => onChange({ ...v, ...patch });
  const titleCfg = subCfg(field, "title", "Title");
  const firstCfg = subCfg(field, "first", "First");
  const middleCfg = subCfg(field, "middle", "Middle");
  const lastCfg = subCfg(field, "last", "Last");
  const maidenCfg = subCfg(field, "maiden", "Maiden");
  const suffixCfg = subCfg(field, "suffix", "Suffix");
  const titles = ["", "Mr", "Ms", "Mrs", "Mx", "Dr", "Prof", "Rev"];

  return (
    <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
      {titleCfg.show && (
        <div>
          <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>
            {titleCfg.label}
          </label>
          <select
            value={v.title || ""}
            onChange={(e) => set({ title: e.target.value || undefined })}
          >
            {titles.map((t) => (
              <option key={t} value={t}>
                {t || "—"}
              </option>
            ))}
          </select>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {firstCfg.show && (
          <div>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>
              {firstCfg.label}
            </label>
            <input value={v.first || ""} onChange={(e) => set({ first: e.target.value })} />
          </div>
        )}
        {middleCfg.show && (
          <div>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>
              {middleCfg.label}
            </label>
            <input value={v.middle || ""} onChange={(e) => set({ middle: e.target.value })} />
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {lastCfg.show && (
          <div>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>
              {lastCfg.label}
            </label>
            <input value={v.last || ""} onChange={(e) => set({ last: e.target.value })} />
          </div>
        )}
        {maidenCfg.show && (
          <div>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>
              {maidenCfg.label}
            </label>
            <input value={v.maiden || ""} onChange={(e) => set({ maiden: e.target.value })} />
          </div>
        )}
      </div>
      {suffixCfg.show && (
        <div>
          <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>
            {suffixCfg.label}
          </label>
          <input value={v.suffix || ""} onChange={(e) => set({ suffix: e.target.value })} />
        </div>
      )}
    </div>
  );
}

/** ADDRESS field with subfields */
function AddressField({ field, value, onChange }) {
  const base = { line1: "", line2: "", city: "", state: "", postal: "", country: "" };
  const a = { ...base, ...(typeof value === "object" && value ? value : {}) };
  const set = (patch) => onChange({ ...a, ...patch });

  const cfg = {
    line1: subCfg(field, "line1", "Address line 1", true),
    line2: subCfg(field, "line2", "Address line 2", true),
    city: subCfg(field, "city", "City", true),
    state: subCfg(field, "state", "State/Province", true),
    postal: subCfg(field, "postal", "ZIP/Postal", true),
    country: subCfg(field, "country", "Country", true),
  };

  return (
    <div className="field-address" style={{ display: "grid", gap: 8, maxWidth: 520 }}>
      {cfg.line1.show && (
        <div>
          <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>{cfg.line1.label}</label>
          <input value={a.line1} onChange={(e) => set({ line1: e.target.value })} />
        </div>
      )}
      {cfg.line2.show && (
        <div>
          <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>{cfg.line2.label}</label>
          <input value={a.line2} onChange={(e) => set({ line2: e.target.value })} />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {cfg.city.show && (
          <div>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>{cfg.city.label}</label>
            <input value={a.city} onChange={(e) => set({ city: e.target.value })} />
          </div>
        )}
        {cfg.state.show && (
          <div>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>{cfg.state.label}</label>
            <input value={a.state} onChange={(e) => set({ state: e.target.value })} />
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {cfg.postal.show && (
          <div>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>{cfg.postal.label}</label>
            <input value={a.postal} onChange={(e) => set({ postal: e.target.value })} />
          </div>
        )}
        {cfg.country.show && (
          <div>
            <label style={{ fontSize: 12, opacity: 0.8, display: "block" }}>{cfg.country.label}</label>
            <input value={a.country} onChange={(e) => set({ country: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Helpers for media fields
 */
function fieldVisibility(field) {
  const cfg = getFieldConfig(field);
  return cfg?.visibility === "private" ? "private" : "public";
}
function fieldFolder(field) {
  const cfg = getFieldConfig(field);
  return cfg?.folder || field.key || "uploads";
}

/**
 * Image upload UI (Supabase Storage)
 */
function ImageField({ field, value, onChange, entryContext }) {
  const [busy, setBusy] = useState(false);
  const cfg = getFieldConfig(field);

  const visibility = fieldVisibility(field);
  const bucket = resolveBucketName(visibility === "private" ? "private" : "public");
  const pathPrefix = `${fieldFolder(field)}/${entryContext?.typeSlug || "unknown"}/${entryContext?.entryId || "new"}`;

  const altCfg = subCfg(field, "alt", "Alt text");
  const titleCfg = subCfg(field, "title", "Title");
  const captionCfg = subCfg(field, "caption", "Caption");
  const creditCfg = subCfg(field, "credit", "Credit");

  const imageUrl = useMemo(() => {
    if (visibility === "public") return value?.publicUrl || null;
    return null;
  }, [value, visibility]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const policy = resolveUploadPolicy(cfg || {});
    const accept = policy.accept || "image/*";
    const maxMB = Number(policy.maxSizeMB) || null;

    const typeOk =
      !accept ||
      accept.split(",").some((p) => {
        p = p.trim();
        if (!p) return true;
        if (p.endsWith("/*")) return file.type.startsWith(p.slice(0, -1));
        return file.type === p;
      });

    if (!typeOk) {
      alert(`Invalid file type: ${file.type}`);
      e.target.value = "";
      return;
    }
    if (maxMB && file.size > maxMB * 1024 * 1024) {
      alert(`File is too large. Max ${maxMB} MB.`);
      e.target.value = "";
      return;
    }

    setBusy(true);
    try {
      const meta = await uploadToSupabase(file, {
        bucket,
        pathPrefix,
        makePublic: visibility === "public",
      });
      onChange({
        ...(value || {}),
        ...meta,
        alt: value?.alt || "",
        title: value?.title || "",
        caption: value?.caption || "",
        credit: value?.credit || "",
        mime: file.type,
        size: file.size,
      });
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function copySignedLink() {
    if (!value?.bucket || !value?.path) return;
    try {
      const url = await getSignedUrl(value.bucket, value.path, 3600);
      await navigator.clipboard.writeText(url);
      alert("Signed URL copied (valid 1h).");
    } catch {
      alert("Could not create signed URL.");
    }
  }

  const acceptAttr = resolveUploadPolicy(cfg || {}).accept || "image/*";

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {imageUrl ? (
        <img src={imageUrl} alt={value?.alt || ""} style={{ maxWidth: 240 }} />
      ) : (
        <small>No image selected</small>
      )}
      <input placeholder="Image URL" value={imageUrl || ""} readOnly />
      {altCfg.show && (
        <input
          placeholder={altCfg.label}
          value={value?.alt || ""}
          onChange={(e) => onChange({ ...(value || {}), alt: e.target.value })}
        />
      )}
      {titleCfg.show && (
        <input
          placeholder={titleCfg.label}
          value={value?.title || ""}
          onChange={(e) => onChange({ ...(value || {}), title: e.target.value })}
        />
      )}
      {captionCfg.show && (
        <input
          placeholder={captionCfg.label}
          value={value?.caption || ""}
          onChange={(e) => onChange({ ...(value || {}), caption: e.target.value })}
        />
      )}
      {creditCfg.show && (
        <input
          placeholder={creditCfg.label}
          value={value?.credit || ""}
          onChange={(e) => onChange({ ...(value || {}), credit: e.target.value })}
        />
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="file" accept={acceptAttr} onChange={handleUpload} disabled={busy} />
        {visibility === "private" && value?.path && (
          <button type="button" onClick={copySignedLink} disabled={busy}>
            Copy signed URL
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Generic file upload UI
 */
function FileField({ field, value, onChange, entryContext, accept }) {
  const [busy, setBusy] = useState(false);
  const cfg = getFieldConfig(field);

  const visibility = fieldVisibility(field);
  const bucket = resolveBucketName(visibility === "private" ? "private" : "public");
  const pathPrefix = `${fieldFolder(field)}/${entryContext?.typeSlug || "unknown"}/${entryContext?.entryId || "new"}`;

  const titleCfg = subCfg(field, "title", "Title");
  const captionCfg = subCfg(field, "caption", "Caption");
  const creditCfg = subCfg(field, "credit", "Credit");

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const policy = resolveUploadPolicy(cfg || {});
    const acceptCombined = policy.accept || accept;
    const maxMB = Number(policy.maxSizeMB) || null;

    const typeOk =
      !acceptCombined ||
      acceptCombined.split(",").some((p) => {
        p = p.trim();
        if (!p) return true;
        if (p.endsWith("/*")) return file.type.startsWith(p.slice(0, -1));
        return file.type === p;
      });

    if (!typeOk) {
      alert(`Invalid file type: ${file.type}`);
      e.target.value = "";
      return;
    }
    if (maxMB && file.size > maxMB * 1024 * 1024) {
      alert(`File is too large. Max ${maxMB} MB.`);
      e.target.value = "";
      return;
    }

    setBusy(true);
    try {
      const meta = await uploadToSupabase(file, {
        bucket,
        pathPrefix,
        makePublic: visibility === "public",
      });
      onChange({
        ...meta,
        name: file.name,
        mime: file.type,
        size: file.size,
        title: value?.title || "",
        caption: value?.caption || "",
        credit: value?.credit || "",
      });
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function copySignedLink() {
    if (!value?.bucket || !value?.path) return;
    try {
      const url = await getSignedUrl(value.bucket, value.path, 3600);
      await navigator.clipboard.writeText(url);
      alert("Signed URL copied (1h).");
    } catch {
      alert("Could not create signed URL.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <input placeholder="File name" value={value?.name || ""} readOnly />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="file" accept={accept} onChange={handleUpload} disabled={busy} />
        {visibility === "private" && value?.path && (
          <button type="button" onClick={copySignedLink} disabled={busy}>
            Copy signed URL
          </button>
        )}
      </div>
      {titleCfg.show && (
        <input
          placeholder={titleCfg.label}
          value={value?.title || ""}
          onChange={(e) => onChange({ ...(value || {}), title: e.target.value })}
        />
      )}
      {captionCfg.show && (
        <input
          placeholder={captionCfg.label}
          value={value?.caption || ""}
          onChange={(e) => onChange({ ...(value || {}), caption: e.target.value })}
        />
      )}
      {creditCfg.show && (
        <input
          placeholder={creditCfg.label}
          value={value?.credit || ""}
          onChange={(e) => onChange({ ...(value || {}), credit: e.target.value })}
        />
      )}
      {visibility === "public" && value?.publicUrl && <small>Public URL: {value.publicUrl}</small>}
    </div>
  );
}

/**
 * FieldInput
 */
export default function FieldInput({
  field,
  value,
  onChange,
  relatedCache,
  choicesCache,
  entryContext,
}) {
  // ✅ CRITICAL: fix the crash (fieldType must exist)
  const fieldType = (field?.type || "text").toString().trim().toLowerCase();
  const cfg = getFieldConfig(field);

  // ---- Dynamic choice helpers ----
  const isChoice = ["radio", "dropdown", "checkbox", "select", "multiselect"].includes(fieldType);
  const isDynamic =
    isChoice && cfg && typeof cfg === "object" && (cfg.sourceType || cfg.optionsSource === "dynamic");

  let dynamicChoices = [];
  if (isDynamic) {
    const sourceType = cfg.sourceType;
    const sourceField = cfg.sourceField || "title";
    const list = choicesCache?.[sourceType] || [];
    dynamicChoices = list.map((ent) => {
      const v =
        (ent.data && (ent.data[sourceField] ?? ent.data.title)) ??
        ent.id;
      return { value: String(v), label: String(v) };
    });
  }

  // ---- Basic types ----
  if (fieldType === "text") {
    return <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }

  if (fieldType === "email") {
    return (
      <input
        type="email"
        value={value ?? ""}
        placeholder="email@example.com"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (fieldType === "phone") {
    return (
      <input
        type="tel"
        value={value ?? ""}
        placeholder="+1 760 660 1289"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (fieldType === "url") {
    return (
      <input
        type="url"
        value={value ?? ""}
        placeholder="https://example.com"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (fieldType === "textarea") {
    return <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }

  if (fieldType === "number") {
    return (
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ""}
        min={cfg.min ?? undefined}
        max={cfg.max ?? undefined}
        step={cfg.step ?? (cfg.decimals ? "0.01" : "1")}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return onChange(null);
          const n = Number(v);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    );
  }

  // ---- Radio / Dropdown / Multiselect / Checkbox ----
  if (fieldType === "radio") {
    const baseChoices = isDynamic ? dynamicChoices : getFieldChoices(field);
    const choices = normalizeChoices(baseChoices);
    const current = value ?? "";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {choices.map((opt) => (
          <label key={opt.value} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input
              type="radio"
              name={field.key}
              value={opt.value}
              checked={String(current) === String(opt.value)}
              onChange={(e) => onChange(e.target.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    );
  }

  if (fieldType === "dropdown" || fieldType === "select") {
    const baseChoices = isDynamic ? dynamicChoices : getFieldChoices(field);
    const choices = normalizeChoices(baseChoices);
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Select…
        </option>
        {choices.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (fieldType === "multiselect") {
    const baseChoices = isDynamic ? dynamicChoices : getFieldChoices(field);
    const choices = normalizeChoices(baseChoices);
    const selected = Array.isArray(value)
      ? value.map(String)
      : value
      ? String(value)
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];

    return (
      <select
        multiple
        value={selected}
        onChange={(e) => {
          const vals = Array.from(e.target.selectedOptions || []).map((o) => o.value);
          onChange(vals);
        }}
      >
        {choices.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (fieldType === "checkbox") {
    const baseChoices = isDynamic ? dynamicChoices : getFieldChoices(field);
    const choices = normalizeChoices(baseChoices);
    const current = Array.isArray(value) ? value.map(String) : [];
    return (
      <div>
        {choices.map((opt) => {
          const checked = current.includes(String(opt.value));
          return (
            <label key={opt.value} style={{ display: "block" }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = checked
                    ? current.filter((v) => v !== String(opt.value))
                    : [...current, String(opt.value)];
                  onChange(next);
                }}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    );
  }

  if (fieldType === "boolean") {
    return (
      <label>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(!!e.target.checked)} />{" "}
        {field.label}
      </label>
    );
  }

  // ---- Relation ----
  if (fieldType === "relation" || fieldType === "relationship") {
    // Supports both:
    // - cfg.relation = { kind:'one'|'many', contentType:'users' }
    // - legacy cfg.relatedType / cfg.multiple
    const rel = cfg?.relation?.contentType || cfg?.relatedType;
    const allowMultiple =
      cfg?.relation?.kind === "many" || !!cfg?.multiple;

    const list = (rel && relatedCache?.[rel]) || [];

    function labelFor(ent) {
      return ent?.data?.title || ent?.title || ent?.id;
    }

    if (!allowMultiple) {
      return (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            Select related…
          </option>
          {list.map((ent) => (
            <option key={ent.id} value={String(ent.id)}>
              {labelFor(ent)}
            </option>
          ))}
        </select>
      );
    }

    const current = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
    const size = Math.min(8, Math.max(3, list.length));
    return (
      <select
        multiple
        size={size}
        value={current}
        onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
          onChange(selected);
        }}
        style={{ minWidth: 260 }}
      >
        {list.map((ent) => (
          <option key={ent.id} value={String(ent.id)}>
            {labelFor(ent)}
          </option>
        ))}
      </select>
    );
  }

  // ---- Advanced ----
  if (fieldType === "rich_text") {
    return <RichTextEditor value={value} onChange={onChange} options={{ headings: [1, 2, 3, 4] }} />;
  }

  if (fieldType === "time") {
    const t =
      value && typeof value === "object"
        ? value.time || ""
        : typeof value === "string"
        ? value
        : "";
    const tz =
      value && typeof value === "object" && value.tz
        ? value.tz
        : Intl.DateTimeFormat().resolvedOptions().timeZone;

    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="time" value={t} onChange={(e) => onChange({ time: e.target.value, tz })} step="60" />
        <span style={{ fontSize: 12, opacity: 0.7 }}>{tz}</span>
      </div>
    );
  }

  if (fieldType === "datetime") {
    const tz = cfg?.defaultTZ || "America/Los_Angeles";
    const v = value || { utc: "", sourceTZ: tz };
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");

    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} step="60" />
        <button
          type="button"
          onClick={() => {
            if (!date || !time) return;
            onChange({ utc: combineDateAndTimeToUTC(date, time, tz), sourceTZ: tz });
          }}
        >
          Set
        </button>
        {v.utc ? <small style={{ marginLeft: 8 }}>Saved UTC: {v.utc}</small> : null}
      </div>
    );
  }

  if (fieldType === "daterange") {
    const tz = cfg?.defaultTZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const v = value || { start: "", end: "", allDay: true, tz };
    const allDay = v.allDay !== false;

    return (
      <div style={{ display: "grid", gap: 6 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => onChange({ ...v, allDay: !!e.target.checked })}
          />{" "}
          All day
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="date" value={v.start || ""} onChange={(e) => onChange({ ...v, start: e.target.value })} />
          {!allDay && (
            <input
              type="time"
              value={v.startTime || ""}
              onChange={(e) => onChange({ ...v, startTime: e.target.value })}
              step="60"
            />
          )}
          <span>–</span>
          <input type="date" value={v.end || ""} onChange={(e) => onChange({ ...v, end: e.target.value })} />
          {!allDay && (
            <input
              type="time"
              value={v.endTime || ""}
              onChange={(e) => onChange({ ...v, endTime: e.target.value })}
              step="60"
            />
          )}
        </div>
        <small>Timezone: {tz}</small>
      </div>
    );
  }

  if (fieldType === "color") {
    const v = value || { hex: "#000000" };
    const against = cfg?.requireContrastAgainst || "#ffffff";
    let ratio = null;
    try {
      ratio = contrastRatio(v.hex || "#000000", against);
    } catch {
      ratio = null;
    }

    return (
      <div style={{ display: "grid", gap: 8 }}>
        <input type="color" value={v.hex || "#000000"} onChange={(e) => onChange({ ...v, hex: e.target.value })} />
        <input
          placeholder="#rrggbb"
          value={v.hex || ""}
          onChange={(e) => {
            try {
              onChange({ ...v, hex: normalizeHex(e.target.value) });
            } catch {
              onChange({ ...v, hex: e.target.value });
            }
          }}
        />
        {ratio ? <small>Contrast vs {against}: {ratio}:1</small> : null}
      </div>
    );
  }

  // ---- Media ----
  if (fieldType === "image") {
    return <ImageField field={field} value={value} onChange={onChange} entryContext={entryContext} />;
  }
  if (fieldType === "file" || fieldType === "document") {
    const accept = cfg?.accept;
    return <FileField field={field} value={value} onChange={onChange} entryContext={entryContext} accept={accept} />;
  }
  if (fieldType === "video") {
    const accept = cfg?.accept || "video/*";
    return <FileField field={field} value={value} onChange={onChange} entryContext={entryContext} accept={accept} />;
  }

  // ---- Structured ----
  if (fieldType === "json") {
    const [text, setText] = useState(() => {
      try {
        return value ? JSON.stringify(value, null, 2) : "";
      } catch {
        return "";
      }
    });
    const [valid, setValid] = useState(true);

    function handleChange(t) {
      setText(t);
      if (t.trim() === "") {
        onChange(null);
        setValid(true);
        return;
      }
      try {
        onChange(JSON.parse(t));
        setValid(true);
      } catch {
        setValid(false);
      }
    }

    return (
      <div style={{ display: "grid", gap: 6 }}>
        <textarea rows={8} value={text} onChange={(e) => handleChange(e.target.value)} placeholder='{"key":"value"}' />
        <small style={{ color: valid ? "#0a0" : "#a00" }}>{valid ? "Valid JSON" : "Invalid JSON"}</small>
      </div>
    );
  }

  if (fieldType === "tags") {
    // you can keep your current tags UI as-is (omitted here for brevity)
    // fallback to simple comma-separated string entry:
    const chips = Array.isArray(value)
      ? value
      : typeof value === "string"
      ? value.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    return (
      <input
        placeholder="tag1, tag2, tag three"
        value={chips.join(", ")}
        onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
      />
    );
  }

  if (fieldType === "name") return <NameField field={field} value={value} onChange={onChange} />;
  if (fieldType === "address") return <AddressField field={field} value={value} onChange={onChange} />;

  // Fallback text
  return <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}
