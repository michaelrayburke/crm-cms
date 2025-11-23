// admin/src/hooks/useDashboard.js
import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../lib/api";

// Default widgets for a given role (you can tweak this anytime)
function getDefaultWidgetsForRole(roleSlug) {
  const upper = (roleSlug || "ADMIN").toUpperCase();

  // You can make this differ per role later if you want.
  if (upper === "ADMIN") {
    return [
      {
        id: "welcome",
        type: "html-block",
        title: "Welcome to ServiceUp",
        config: {
          html:
            "<p>Quick overview of what’s going on. Customize this block in the widget editor.</p>",
        },
        sort_order: 0,
      },
      {
        id: "quick-links",
        type: "quick-links",
        title: "Quick Actions",
        config: {
          links: [
            { label: "Content", url: "/admin/content" },
            { label: "Users", url: "/admin/users" },
            { label: "Settings", url: "/admin/settings" },
          ],
        },
        sort_order: 1,
      },
      {
        id: "activity",
        type: "activity",
        title: "Recent Activity",
        config: {},
        sort_order: 2,
      },
    ];
  }

  // Default for other roles (EDITOR, VIEWER, etc.)
  return [
    {
      id: "welcome",
      type: "html-block",
      title: "Welcome",
      config: {
        html: "<p>Welcome! Ask your admin if you need custom widgets here.</p>",
      },
      sort_order: 0,
    },
  ];
}

// Tiny helper so we always have a role
function getCurrentRoleSlug() {
  try {
    const raw = localStorage.getItem("serviceup.user");
    if (!raw) return "ADMIN";
    const parsed = JSON.parse(raw);
    return (parsed?.role || "ADMIN").toUpperCase();
  } catch {
    return "ADMIN";
  }
}

/**
 * useDashboardWidgets
 *
 * Stores dashboard layout in /api/settings under:
 *   { dashboards: { [ROLE]: [ widgets... ] } }
 *
 * This gives you:
 *  - Role-based dashboards (ADMIN vs EDITOR vs VIEWER, etc.)
 *  - Persistent widgets backed by the existing settings system
 */
export function useDashboardWidgets() {
  const roleSlug = useMemo(() => getCurrentRoleSlug(), []);
  const [widgets, setWidgets] = useState([]);
  const [dashboardsByRole, setDashboardsByRole] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load dashboards from /api/settings
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const settings = await api.get("/api/settings");
        const dashboards = (settings && settings.dashboards) || {};
        if (!cancelled) {
          setDashboardsByRole(dashboards);

          const roleLayout = dashboards[roleSlug];
          if (Array.isArray(roleLayout) && roleLayout.length) {
            setWidgets(roleLayout);
          } else {
            // Seed defaults for this role
            const defaults = getDefaultWidgetsForRole(roleSlug);
            setWidgets(defaults);
            // Persist defaults in the background
            persistLayout(dashboards, defaults);
          }
        }
      } catch (e) {
        console.error("[useDashboardWidgets] Failed to load settings", e);
        if (!cancelled) {
          setError(e.message || "Failed to load dashboard settings");
          // Still show defaults so the page isn’t blank
          const defaults = getDefaultWidgetsForRole(roleSlug);
          setWidgets(defaults);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function persistLayout(existingDashboards, roleWidgets) {
      try {
        const nextDashboards = {
          ...(existingDashboards || {}),
          [roleSlug]: roleWidgets,
        };
        const saved = await api.post("/api/settings", {
          dashboards: nextDashboards,
        });
        setDashboardsByRole(saved.dashboards || nextDashboards);
      } catch (e) {
        console.error("[useDashboardWidgets] Failed to seed defaults", e);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [roleSlug]);

  // Internal helper: persist a new layout for this role
  const persist = useCallback(
    async (nextWidgets) => {
      setSaving(true);
      setError("");
      setWidgets(nextWidgets);

      try {
        const nextDashboards = {
          ...(dashboardsByRole || {}),
          [roleSlug]: nextWidgets,
        };

        const saved = await api.post("/api/settings", {
          dashboards: nextDashboards,
        });

        setDashboardsByRole(saved.dashboards || nextDashboards);
      } catch (e) {
        console.error("[useDashboardWidgets] Failed to save layout", e);
        setError(e.message || "Failed to save dashboard layout");
      } finally {
        setSaving(false);
      }
    },
    [dashboardsByRole, roleSlug]
  );

  // === Widget operations ===========================================

  function withNewId(widget) {
    if (widget.id) return widget;
    // Simple client-side ID, fine because settings are our source of truth
    return { ...widget, id: crypto.randomUUID() };
  }

  const addWidget = useCallback(
    async (type, overrides = {}) => {
      const baseDefaults = getDefaultWidgetsForRole(roleSlug)[0] || {
        id: "new-widget",
        type,
        title: "New widget",
        config: {},
        sort_order: widgets.length,
      };

      const newWidget = withNewId({
        ...baseDefaults,
        type,
        ...overrides,
        sort_order: widgets.length,
      });

      const next = [...widgets, newWidget];
      await persist(next);
      return newWidget;
    },
    [persist, roleSlug, widgets]
  );

  const updateWidget = useCallback(
    async (id, patch) => {
      const next = widgets.map((w) =>
        w.id === id ? { ...w, ...patch } : w
      );
      await persist(next);
    },
    [persist, widgets]
  );

  const removeWidget = useCallback(
    async (id) => {
      const next = widgets
        .filter((w) => w.id !== id)
        .map((w, idx) => ({ ...w, sort_order: idx }));
      await persist(next);
    },
    [persist, widgets]
  );

  const moveWidget = useCallback(
    async (id, direction) => {
      const index = widgets.findIndex((w) => w.id === id);
      if (index === -1) return;

      const newIndex =
        direction === "up"
          ? Math.max(0, index - 1)
          : Math.min(widgets.length - 1, index + 1);

      if (newIndex === index) return;

      const next = [...widgets];
      const [moved] = next.splice(index, 1);
      next.splice(newIndex, 0, moved);

      const reindexed = next.map((w, idx) => ({
        ...w,
        sort_order: idx,
      }));
      await persist(reindexed);
    },
    [persist, widgets]
  );

  const resetToDefaults = useCallback(async () => {
    const defaults = getDefaultWidgetsForRole(roleSlug);
    await persist(defaults);
  }, [persist, roleSlug]);

  // For backwards compatibility with older code that just did save(next)
  const save = useCallback(
    async (nextWidgets) => {
      await persist(nextWidgets);
    },
    [persist]
  );

  return {
    roleSlug,
    widgets,
    loading,
    saving,
    error,
    addWidget,
    updateWidget,
    removeWidget,
    moveWidget,
    resetToDefaults,
    save, // legacy helper
  };
}
