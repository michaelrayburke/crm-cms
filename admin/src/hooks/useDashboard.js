// admin/src/hooks/useDashboard.js
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

// A simple set of starter widgets
export const DEFAULT_WIDGETS = [
  {
    id: "welcome",
    type: "welcome",
    title: "Welcome to ServiceUp",
    subtitle: "Start building content types, entries, and layouts.",
  },
  {
    id: "quick-links",
    type: "quick-links",
    title: "Quick Actions",
    links: [
      { label: "Create Content Type", href: "/content?mode=types" },
      { label: "New Entry", href: "/content" },
      { label: "Manage Users", href: "/users" },
      { label: "Settings", href: "/settings" },
    ],
  },
  {
    id: "activity",
    type: "activity",
    title: "Recent Activity",
  },
];

// LocalStorage key helper (per role)
function getStorageKey(role) {
  return `serviceup.dashboard.${role || "default"}`;
}

/**
 * useDashboard
 * - role: (optional) string; for now we default to "ADMIN" on the page side.
 */
export function useDashboard(role = "ADMIN") {
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load layout
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // 1) Try Supabase first
      try {
        const { data, error: sbError } = await supabase
          .from("dashboard_layouts")
          .select("layout")
          .eq("role", role)
          .maybeSingle();

        if (sbError) throw sbError;

        if (!cancelled) {
          if (data && data.layout && Array.isArray(data.layout.widgets)) {
            setWidgets(data.layout.widgets);
          } else {
            // 2) Fallback to localStorage
            const raw = window.localStorage.getItem(getStorageKey(role));
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  setWidgets(parsed);
                } else {
                  setWidgets(DEFAULT_WIDGETS);
                }
              } catch {
                setWidgets(DEFAULT_WIDGETS);
              }
            } else {
              setWidgets(DEFAULT_WIDGETS);
            }
          }
        }
      } catch (err) {
        console.error("[useDashboard] load error", err);
        if (!cancelled) {
          setError(err.message || "Failed to load dashboard");
          // Fallback to localStorage or default
          const raw = window.localStorage.getItem(getStorageKey(role));
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                setWidgets(parsed);
              } else {
                setWidgets(DEFAULT_WIDGETS);
              }
            } catch {
              setWidgets(DEFAULT_WIDGETS);
            }
          } else {
            setWidgets(DEFAULT_WIDGETS);
          }
        }
      } finally {
        !cancelled && setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [role]);

  // Save layout
  const saveLayout = useCallback(
    async (nextWidgets) => {
      setSaving(true);
      setError(null);

      // Always update local state & localStorage immediately for snappy UX
      setWidgets(nextWidgets);
      try {
        window.localStorage.setItem(
          getStorageKey(role),
          JSON.stringify(nextWidgets)
        );
      } catch (e) {
        console.warn("[useDashboard] localStorage error", e);
      }

      try {
        const { error: sbError } = await supabase
          .from("dashboard_layouts")
          .upsert(
            {
              role,
              layout: { widgets: nextWidgets },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "role" }
          );

        if (sbError) throw sbError;
      } catch (err) {
        console.error("[useDashboard] save error", err);
        setError(err.message || "Failed to save dashboard layout");
      } finally {
        setSaving(false);
      }
    },
    [role]
  );

  return {
    widgets,
    setWidgets, // in case you want to adjust before saving
    saveLayout,
    loading,
    saving,
    error,
  };
}
