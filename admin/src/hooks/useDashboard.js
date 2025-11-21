import { useState, useEffect } from "react";
import api from "../lib/api";

export function useDashboardWidgets() {
  const [widgets, setWidgets] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const layout = await api.get("/dashboard");
      setWidgets(layout || []);
    } catch (e) {
      console.error("Failed loading dashboard", e);
    } finally {
      setLoading(false);
    }
  }

  async function save(newLayout) {
    setWidgets(newLayout);
    try {
      await api.post("/dashboard", { layout: newLayout });
    } catch (e) {
      console.error("Failed saving dashboard", e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { widgets, save, loading };
}
