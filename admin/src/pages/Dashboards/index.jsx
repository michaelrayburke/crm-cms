import { useState } from "react";
import { useDashboardWidgets } from "../../hooks/useDashboard";

export default function Dashboard() {
  const { widgets, save, loading } = useDashboardWidgets();

  function onDragEnd(result) {
    if (!result.destination) return;

    const newOrder = Array.from(widgets);
    const [moved] = newOrder.splice(result.source.index, 1);
    newOrder.splice(result.destination.index, 0, moved);

    save(newOrder);
  }

  if (loading) return <div>Loading dashboard…</div>;

  return (
    <div className="dashboard-wrapper">
      <h1 className="su-h1 mb-4">Dashboard</h1>

      <div className="dashboard-grid">
        {widgets.map((w, idx) => (
          <div key={idx} className="dashboard-widget-card">
            {w.title ? <h3>{w.title}</h3> : null}
            {w.component === "stats" && <div>Stats widget here</div>}
            {w.component === "recent" && <div>Recent items widget</div>}
            {w.component === "tasks" && <div>Tasks widget</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
