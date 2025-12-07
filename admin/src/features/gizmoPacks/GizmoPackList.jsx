import React, { useEffect, useState } from "react";
import { getGizmoPacks, applyGizmoPackApi } from "../../lib/api";
/**
 * GizmoPackList is the admin UI component that lets administrators view all
 * available Gizmo Packs and install them. Installing a pack will generate
 * a new gadget along with its gizmos, content types and seed entries.
 */
export default function GizmoPackList() {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [selectedPack, setSelectedPack] = useState("");
  const [gadgetName, setGadgetName] = useState("");
  const [gadgetSlug, setGadgetSlug] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Load available Gizmo Packs when the component mounts. If packs are
  // returned, default select the first one.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await getGizmoPacks();
        if (!isMounted) return;
        setPacks(data);
        if (data.length > 0 && !selectedPack) {
          setSelectedPack(data[0].pack_slug);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setError("Failed to load Gizmo Packs.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [selectedPack]);

  // Handle installation of a selected pack. Validates that the user has
  // selected a pack and provided the required gadget name and slug. On
  // success, displays a confirmation message. On error, displays the
  // returned error message.
  async function handleInstall(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!selectedPack || !gadgetName || !gadgetSlug) {
      setError("Please choose a pack and provide gadget name and slug.");
      return;
    }
    setInstalling(true);
    try {
      const result = await applyGizmoPackApi({
        packSlug: selectedPack,
        gadgetSlug,
        gadgetName
      });
      setMessage(
        `Gizmo Pack installed! Gadget "${result.gadget_name}" (slug: ${result.gadget_slug}).`
      );
      setGadgetName("");
      setGadgetSlug("");
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message || err?.message || "Failed to install Gizmo Pack."
      );
    } finally {
      setInstalling(false);
    }
  }

  if (loading) {
    return <div>Loading Gizmo Packs…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Gizmo Packs</h1>
        <p className="text-sm text-gray-500">
          Install a Gizmo Pack to instantly generate a new website or app: gadgets,
          gizmos, content types, and starter entries.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[2fr,3fr]">
        {/* Left: Pack list */}
        <div className="border rounded-lg p-4 bg-white">
          <h2 className="font-medium mb-3 text-sm text-gray-700">Available Packs</h2>
          <ul className="space-y-3">
            {packs.map((p) => (
              <li
                key={p.pack_slug}
                className={`rounded-md border px-3 py-2 cursor-pointer ${
                  selectedPack === p.pack_slug
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedPack(p.pack_slug)}
              >
                <div className="text-sm font-medium">{p.name}</div>
                {p.description && (
                  <div className="text-xs text-gray-500 mt-1">{p.description}</div>
                )}
                <div className="text-[11px] text-gray-400 mt-1">slug: {p.pack_slug}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: Install form */}
        <form
          onSubmit={handleInstall}
          className="border rounded-lg p-4 bg-white space-y-4"
        >
          <h2 className="font-medium mb-2 text-sm text-gray-700">Install Gizmo Pack</h2>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Gizmo Pack</label>
            <select
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={selectedPack}
              onChange={(e) => setSelectedPack(e.target.value)}
            >
              {packs.map((p) => (
                <option key={p.pack_slug} value={p.pack_slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Gadget Name</label>
            <input
              type="text"
              className="w-full border rounded-md px-2 py-1 text-sm"
              placeholder="Demo Website"
              value={gadgetName}
              onChange={(e) => setGadgetName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Gadget Slug</label>
            <input
              type="text"
              className="w-full border rounded-md px-2 py-1 text-sm"
              placeholder="demo-website"
              value={gadgetSlug}
              onChange={(e) => setGadgetSlug(e.target.value)}
            />
            <p className="text-[11px] text-gray-400">
              This must be unique. Gizmo slugs will be prefixed with this (e.g. <code>{gadgetSlug || "demo-website"}-header</code>).
            </p>
          </div>
          <button
            type="submit"
            disabled={installing}
            className="inline-flex items-center rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
          >
            {installing ? "Installing…" : "Install Gizmo Pack"}
          </button>
        </form>
      </div>
    </div>
  );
}
