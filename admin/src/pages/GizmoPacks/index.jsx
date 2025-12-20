// admin/src/pages/GizmoPacks/index.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export default function GizmoPacksPage() {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedPackSlug, setSelectedPackSlug] = useState('');
  const [gadgetName, setGadgetName] = useState('');
  const [gadgetSlug, setGadgetSlug] = useState('');
  const [applyMessage, setApplyMessage] = useState('');
  const [applyError, setApplyError] = useState('');
  const [applying, setApplying] = useState(false);

  // Simple slug helper for UI
  function slugify(str) {
    return (str || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPacks() {
      try {
        setLoading(true);
        setLoadError('');
        setApplyMessage('');
        setApplyError('');

        const res = await api.get('/api/gizmo-packs');

        // Support either { packs: [...] } or bare array
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.packs)
            ? res.packs
            : [];

        if (!cancelled) {
          setPacks(list);
          // Auto-select first pack if present
          if (list.length && !selectedPackSlug) {
            setSelectedPackSlug(list[0].pack_slug || list[0].filename || '');
          }
        }
      } catch (err) {
        console.error('[GizmoPacks] Failed to load packs', err);
        if (!cancelled) {
          setLoadError(
            err?.message || 'Failed to load Gizmo Packs from the server.',
          );
          setPacks([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPacks();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectPack = (slug) => {
    setSelectedPackSlug(slug);
    setApplyMessage('');
    setApplyError('');
  };

  const handleGadgetNameChange = (e) => {
    const name = e.target.value;
    setGadgetName(name);
    if (!gadgetSlug || gadgetSlug === slugify(gadgetName)) {
      setGadgetSlug(slugify(name));
    }
  };

  const handleGadgetSlugChange = (e) => {
    setGadgetSlug(e.target.value);
  };

  const handleApplyPack = async () => {
    setApplyMessage('');
    setApplyError('');

    if (!selectedPackSlug) {
      setApplyError('Please select a Gizmo Pack.');
      return;
    }
    if (!gadgetName.trim()) {
      setApplyError('Please enter a gadget name.');
      return;
    }
    if (!gadgetSlug.trim()) {
      setApplyError('Please enter a gadget slug.');
      return;
    }

    setApplying(true);
    try {
      const body = {
        packSlug: selectedPackSlug,
        gadgetName: gadgetName.trim(),
        gadgetSlug: gadgetSlug.trim(),
      };

      // IMPORTANT: hit /api/gizmo-packs/apply (mounted in api/index.js)
      const res = await api.post('/api/gizmo-packs/apply', body);

      setApplyMessage(
        `Gizmo Pack applied! Gadget “${res?.gadget_name || gadgetName}” was created.`,
      );
    } catch (err) {
      console.error('[GizmoPacks] Failed to apply pack', err);
      setApplyError(
        err?.message || 'Failed to apply Gizmo Pack. Check the console logs.',
      );
    } finally {
      setApplying(false);
    }
  };

  const selectedPack =
    packs.find((p) => p.pack_slug === selectedPackSlug) || null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Gizmo Packs</h1>
          <p className="text-sm text-gray-500">
            Quickly spin up new gadgets (and their gizmos, content types, and
            entries) from reusable pack templates. Choose a pack, name your
            gadget, and apply.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr),minmax(0,1.2fr)] gap-6 items-start">
        {/* Left column: list of packs */}
        <section className="su-card">
          <h2 className="su-card-title">Available Gizmo Packs</h2>

          {loading && (
            <p className="text-sm text-gray-500">Loading Gizmo Packs…</p>
          )}

          {!loading && loadError && (
            <p className="text-sm text-red-600">{loadError}</p>
          )}

          {!loading && !loadError && packs.length === 0 && (
            <p className="text-sm text-gray-500">
              No Gizmo Packs are currently available. Once packs are registered
              on the server, they’ll appear here.
            </p>
          )}

          {!loading && !loadError && packs.length > 0 && (
            <div className="space-y-3 mt-3">
              {packs.map((pack) => {
                const isActive =
                  selectedPackSlug ===
                  (pack.pack_slug || pack.filename || '');
                return (
                  <button
                    key={pack.pack_slug || pack.filename}
                    type="button"
                    onClick={() =>
                      handleSelectPack(pack.pack_slug || pack.filename || '')
                    }
                    className={[
                      'w-full text-left border rounded-lg p-3 transition',
                      isActive
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/40',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">
                        {pack.name || pack.pack_slug || pack.filename}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {pack.pack_slug || pack.filename}
                      </span>
                    </div>
                    {pack.description && (
                      <p className="text-xs text-gray-600">
                        {pack.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Right column: details + apply form */}
        <section className="su-card space-y-4">
          <h2 className="su-card-title">Apply Gizmo Pack</h2>

          <div className="space-y-3">
            <div>
              <label className="su-label">Selected pack</label>
              <div className="text-sm">
                {selectedPack ? (
                  <>
                    <div className="font-semibold">
                      {selectedPack.name ||
                        selectedPack.pack_slug ||
                        selectedPack.filename}
                    </div>
                    {selectedPack.description && (
                      <div className="text-xs text-gray-600">
                        {selectedPack.description}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500 text-sm">
                    No pack selected yet.
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="su-label">Gadget name</label>
              <input
                className="su-input"
                placeholder="My Demo Website"
                value={gadgetName}
                onChange={handleGadgetNameChange}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Human-friendly label for the gadget (e.g. a specific client
                website).
              </p>
            </div>

            <div>
              <label className="su-label">Gadget slug</label>
              <input
                className="su-input"
                placeholder="my-demo-website"
                value={gadgetSlug}
                onChange={handleGadgetSlugChange}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Used to generate internal slugs for gizmos, content types, and
                routes. Lowercase and hyphenated works best.
              </p>
            </div>
          </div>

          {applyError && (
            <p className="text-sm text-red-600">{applyError}</p>
          )}
          {applyMessage && (
            <p className="text-sm text-green-700">{applyMessage}</p>
          )}

          <div className="pt-2">
            <button
              type="button"
              className="su-btn primary"
              onClick={handleApplyPack}
              disabled={applying || !selectedPackSlug}
            >
              {applying ? 'Applying Gizmo Pack…' : 'Apply Gizmo Pack'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
