// site/src/Page.jsx 
import React, { useEffect, useMemo, useState } from 'react';
import widgetRegistry from './widgetRegistry';

// Raw base from env
const RAW_API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Normalize to always point at the /api root, without double `/api`
function getApiRoot() {
  const base = (RAW_API_BASE || '').replace(/\/+$/, '');
  // If it already ends with /api (e.g. "/api" or "https://api.serviceup.tech/api"),
  // just use it. Otherwise, append /api.
  if (base.toLowerCase().endsWith('/api')) {
    return base;
  }
  return `${base}/api`;
}

const API_ROOT = getApiRoot();

/**
 * Page component that:
 *  - Receives a `page` object (from your existing API)
 *  - Receives a `gadgetSlug` (string identifying the current gadget/site)
 *  - Fetches widgets for that gadget from /api/public/widgets
 *  - Renders blocks using the widget registry
 *
 * Props:
 *  - page: {
 *      title: string,
 *      slug: string,
 *      data?: {
 *        blocks?: {
 *          blocks?: Array<{ type: string, widget_slug?: string, props?: object }>
 *        }
 *      }
 *    }
 *  - gadgetSlug: string (e.g. "serviceup-site")
 */
export default function Page({ page, gadgetSlug }) {
  const [widgets, setWidgets] = useState([]);
  const [widgetsLoading, setWidgetsLoading] = useState(true);
  const [widgetsError, setWidgetsError] = useState('');

  const blocks = useMemo(
    () => page?.data?.blocks?.blocks || [],
    [page],
  );

  // Fetch widgets for the current gadget
  useEffect(() => {
    let cancelled = false;

    async function loadWidgets() {
      if (!gadgetSlug) {
        setWidgets([]);
        setWidgetsLoading(false);
        return;
      }

      try {
        setWidgetsLoading(true);
        setWidgetsError('');

        // Public widgets endpoint:
        // - local dev (VITE_API_BASE=/api)   -> /api/public/widgets?gadget_slug=...
        // - prod (VITE_API_BASE=https://api.serviceup.tech) ->
        //     https://api.serviceup.tech/api/public/widgets?gadget_slug=...
        const url = `${API_ROOT}/public/widgets?gadget_slug=${encodeURIComponent(
          gadgetSlug,
        )}`;

        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          throw new Error(msg || `HTTP ${res.status}`);
        }

        const json = await res.json();
        const list = Array.isArray(json.widgets) ? json.widgets : [];

        if (!cancelled) {
          setWidgets(list);
        }
      } catch (err) {
        console.error('[Page] Failed to load widgets', err);
        if (!cancelled) {
          setWidgetsError(
            err?.message || 'Failed to load widgets for this gadget.',
          );
          setWidgets([]);
        }
      } finally {
        if (!cancelled) {
          setWidgetsLoading(false);
        }
      }
    }

    loadWidgets();

    return () => {
      cancelled = true;
    };
  }, [gadgetSlug]);

  // Index widgets by slug and type for easy lookup
  const widgetsBySlug = useMemo(() => {
    const map = {};
    for (const w of widgets) {
      if (w.slug) map[w.slug] = w;
    }
    return map;
  }, [widgets]);

  const widgetsByType = useMemo(() => {
    const map = {};
    for (const w of widgets) {
      if (!w.widget_type) continue;
      if (!map[w.widget_type]) map[w.widget_type] = [];
      map[w.widget_type].push(w);
    }
    return map;
  }, [widgets]);

  function renderBlock(block, index) {
    if (!block) return null;

    const blockType = block.type;
    const BlockWidgetComponent = widgetRegistry[blockType];

    // 1) Find widget by slug if provided (most precise)
    let widgetRow = null;
    if (block.widget_slug && widgetsBySlug[block.widget_slug]) {
      widgetRow = widgetsBySlug[block.widget_slug];
    } else if (widgetsByType[blockType]?.length) {
      // 2) Otherwise, fall back to first widget of that type
      widgetRow = widgetsByType[blockType][0];
    }

    if (!BlockWidgetComponent) {
      // No registered React component – safe fallback
      return (
        <section
          key={index}
          className="max-w-5xl mx-auto py-8 px-4 border-l-4 border-orange-400 bg-orange-50/60 rounded-md my-6"
        >
          <p className="text-sm text-gray-700 font-mono">
            Unknown widget type: <strong>{blockType}</strong>
          </p>
        </section>
      );
    }

    // Merge widget config with per-block props (block props win)
    const baseConfig = (widgetRow && widgetRow.config) || {};
    const overrideProps = block.props || {};
    const mergedProps = {
      ...baseConfig,
      ...overrideProps,
    };

    return <BlockWidgetComponent key={index} {...mergedProps} />;
  }

  return (
    <div className="page-wrapper">
      {/* Render each block using its corresponding widget component */}
      <div className="space-y-8 pb-16">
        {widgetsLoading && (
          <p className="max-w-5xl mx-auto px-4 text-sm text-gray-500">
            Loading widgets…
          </p>
        )}
        {widgetsError && (
          <p className="max-w-5xl mx-auto px-4 text-sm text-red-600">
            {widgetsError}
          </p>
        )}
        {blocks.length === 0 && !widgetsLoading && (
          <section className="max-w-5xl mx-auto px-4 py-10 text-gray-500">
            This page doesn’t have any blocks yet.
          </section>
        )}
        {blocks.map((block, index) => renderBlock(block, index))}
      </div>
    </div>
  );
}