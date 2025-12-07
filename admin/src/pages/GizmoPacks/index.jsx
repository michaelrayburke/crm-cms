// admin/src/pages/GizmoPacks/index.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

// Simple slugify helper for gadget slug
function slugify(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function GizmoPacksPage() {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedPackSlug, setSelectedPackSlug] = useState('');
  const [gadgetName, setGadgetName] = useState('');
  const [gadgetSlug, setGadgetSlug] = useState('');

  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [applyError, setApplyError] = useState('');

  // Load available packs from backend
  useEffect(() => {
    let cancelled = false;

    async function fetchPacks() {
      setLoading(true);
      setLoadError('');
      try {
        const res = await api.get('/gizmo-packs');
        // Defensive: support either { packs: [...] } or bare array
        const list = Array.isArray(res) ? res : Array.isArray(res?.packs) ? res.packs : [];
        if (!cancelled) {
          setPacks(list);
          // Auto-select first pack if any
          if (list.length > 0 && !selectedPackSlug) {
            setSelectedPackSlug(list[0].pack_slug || list[0].slug || '');
            const baseName = list[0].name || 'New Gadget';
            setGadgetName(baseName);
            setGadgetSlug(slugify(baseName));
          }
        }
      } catch (err) {
        console.error('[GizmoPacks] Failed to load packs', err);
        if (!cancelled) {
          setLoadError(err?.message || 'Failed to load packs.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPacks();
    return () => {
      cancelled = true;
    };
  }, []); // load once

  // Keep slug in sync (lightly) when user edits name and slug is empty
  function handleGadgetNameChange(e) {
    const value = e.target.value;
    setGadgetName(value);
    // If slug was empty or matches old slugified name, update it
    if (!gadgetSlug || gadgetSlug === slugify(gadgetName)) {
      setGadgetSlug(slugify(value));
    }
  }

  async function handleApply(e) {
    e.preventDefault();
    setApplyMessage('');
    setApplyError('');

    if (!selectedPackSlug) {
      setApplyError('Please select a Gizmo Pack.');
      return;
    }
    if (!gadgetName.trim()) {
      setApplyError('Please provide a gadget name.');
      return;
    }
    if (!gadgetSlug.trim()) {
      setApplyError('Please provide a gadget slug.');
      return;
    }

    setApplying(true);
    try {
      const body = {
        packSlug: selectedPackSlug,
        gadgetName: gadgetName.trim(),
        gadgetSlug: gadgetSlug.trim(),
      };

      const res = await api.post('/gizmo-packs/apply', body);

      setApplyMessage(
        `Gizmo Pack applied! Gadget “${res?.gadget_name || gadgetName}” was created with slug “${res?.gadget_slug || gadgetSlug}”.`
      );
      setApplyError('');
      // TODO later: maybe redirect to /admin/gadgets/<slug> once that route exists
    } catch (err) {
      console.error('[GizmoPacks] Failed to apply pack', err);
      setApplyError(err?.message || 'Failed to apply Gizmo Pack.');
      setApplyMessage('');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Gizmo Packs</h1>
          <p className="text-sm text-gray-500 max-w-2xl">
            Quickly spin up new gadgets (and their gizmos, content types, and entries)
            from reusable pack templates. Choose a pack, name your gadget, and apply.
          </p>
        </div>
      </div>

      {/* Load states */}
      {loading && <div>Loading Gizmo Packs…</div>}
      {loadError && (
        <div className="text-sm text-red-600">
          {loadError}
        </div>
      )}

      {!loading && !loadError && packs.length === 0 && (
        <div className="text-sm text-gray-500">
          No Gizmo Packs are currently available. Once packs are registered on the server,
          they’ll appear here.
        </div>
      )}

      {!loading && !loadError && packs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),minmax(0,1.2fr)] gap-6 items-start">
          {/* Packs list */}
          <section className="su-card">
            <h2 className="su-card-title">Available Packs</h2>
            <div className="space-y-3">
              {packs.map((pack) => {
                const slug = pack.pack_slug || pack.slug;
                return (
                  <label
                    key={slug}
                    className={`border rounded-lg p-3 flex gap-3 cursor-pointer ${
                      selectedPackSlug === slug ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="gizmo-pack"
                      className="mt-1"
                      checked={selectedPackSlug === slug}
                      onChange={() => {
                        setSelectedPackSlug(slug);
                        const baseName = pack.name || 'New Gadget';
                        setGadgetName(baseName);
                        setGadgetSlug(slugify(baseName));
                      }}
                    />
                    <div className="space-y-1">
                      <div className="font-medium">
                        {pack.name || slug || 'Untitled pack'}
                      </div>
                      {pack.description && (
                        <div className="text-sm text-gray-600">{pack.description}</div>
                      )}
                      {pack.filename && (
                        <div className="text-xs text-gray-400">
                          File: {pack.filename}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

            {/* Apply form */}
          <section className="su-card">
            <h2 className="su-card-title">Create Gadget from Pack</h2>
            <form onSubmit={handleApply} className="space-y-3">
              <div>
                <label className="su-label">Selected Pack</label>
                <select
                  className="su-select"
                  value={selectedPackSlug}
                  onChange={(e) => {
                    const slug = e.target.value;
                    setSelectedPackSlug(slug);
                    const selected = packs.find(
                      (p) => p.pack_slug === slug || p.slug === slug
                    );
                    if (selected) {
                      const baseName = selected.name || 'New Gadget';
                      setGadgetName(baseName);
                      setGadgetSlug(slugify(baseName));
                    }
                  }}
                >
                  <option value="">Choose a pack…</option>
                  {packs.map((pack) => {
                    const slug = pack.pack_slug || pack.slug;
                    return (
                      <option key={slug} value={slug}>
                        {pack.name || slug}
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  This is the blueprint that will be used to create your gadget.
                </p>
              </div>

              <div>
                <label className="su-label">Gadget name</label>
                <input
                  className="su-input"
                  placeholder="e.g. Demo Site, NBS CRM, etc."
                  value={gadgetName}
                  onChange={handleGadgetNameChange}
                />
              </div>

              <div>
                <label className="su-label">Gadget slug</label>
                <input
                  className="su-input"
                  placeholder="e.g. demo-site"
                  value={gadgetSlug}
                  onChange={(e) => setGadgetSlug(slugify(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Used as an internal identifier and prefix for generated gizmos.
                </p>
              </div>

              <button
                type="submit"
                className="su-btn primary"
                disabled={applying || !selectedPackSlug}
              >
                {applying ? 'Applying…' : 'Apply Gizmo Pack'}
              </button>

              {applyMessage && (
                <div className="text-sm text-green-600 mt-2">{applyMessage}</div>
              )}
              {applyError && (
                <div className="text-sm text-red-600 mt-2">{applyError}</div>
              )}
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
