// site/src/Page.js
import React, { useEffect, useState } from 'react';
import { fetchPagePayload } from './api';
import { renderWidget } from './widgets/registry';

const GADGET_SLUG = import.meta.env.VITE_SITE_GADGET_SLUG || 'serviceup-site';

export default function Page({ slug }) {
  const [state, setState] = useState({
    loading: true,
    error: '',
    payload: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setState({ loading: true, error: '', payload: null });
        const pageSlug = slug || 'home';
        const data = await fetchPagePayload({
          gadgetSlug: GADGET_SLUG,
          pageSlug,
        });
        if (!cancelled) {
          setState({ loading: false, error: '', payload: data });
        }
      } catch (err) {
        console.error('[Page] load error', err);
        if (!cancelled) {
          setState({
            loading: false,
            error: err?.message || 'Failed to load page',
            payload: null,
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.loading) {
    return <div className="page-loading">Loading…</div>;
  }
  if (state.error) {
    return <div className="page-error">{state.error}</div>;
  }
  if (!state.payload) {
    return <div className="page-error">No data returned.</div>;
  }

  const { gadget, page } = state.payload;

  // Pull blocks from page.data.blocks if present
  let blocks = [];
  try {
    const d = page?.data || {};
    // Your website pack stored: data.blocks = {...} – adjust as needed
    if (d.blocks && Array.isArray(d.blocks.blocks)) {
      blocks = d.blocks.blocks;
    }
  } catch (e) {
    console.warn('Failed to parse blocks', e);
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="site-logo">
            {gadget?.logo_url ? (
              <img src={gadget.logo_url} alt={gadget.name || 'Site'} />
            ) : (
              <span>{gadget?.name || 'ServiceUp Site'}</span>
            )}
          </div>
          {/* For now, no menu; we can wire main-menu gizmo later */}
        </div>
      </header>

      <main className="site-main">
        {blocks.length > 0 ? (
          blocks.map((block, idx) => (
            <div key={idx} className="site-block">
              {renderWidget(block)}
            </div>
          ))
        ) : (
          <div className="site-default-body">
            {/* fallback if no blocks */}
            {/* eslint-disable-next-line react/no-danger */}
            <div
              dangerouslySetInnerHTML={{
                __html: page?.data?.body_html || '',
              }}
            />
          </div>
        )}
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>© {new Date().getFullYear()} {gadget?.name || 'ServiceUp'}</p>
        </div>
      </footer>
    </div>
  );
}
