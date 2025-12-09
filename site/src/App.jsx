// src/App.jsx
import React, { useEffect, useState } from 'react';
import Page from './Page';

// Public API base (same pattern as in Page.jsx)
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// These let you change which gadget/page this frontend is showing
const GADGET_SLUG =
  import.meta.env.VITE_GADGET_SLUG || 'serviceup-site';
const PAGE_SLUG =
  import.meta.env.VITE_PAGE_SLUG || 'home';

export default function App() {
  const [page, setPage] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPage() {
      setStatus('loading');
      setError(null);

      try {
        // Example endpoint: /api/public/pages/home?gadget=serviceup-site
        const url = `${API_BASE}/api/public/pages/${encodeURIComponent(
          PAGE_SLUG,
        )}?gadget=${encodeURIComponent(GADGET_SLUG)}`;

        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Failed to load page (${res.status})`);
        }

        const json = await res.json();
        // Flexible: support either { page: {...} } or a bare page object
        const pagePayload = json.page || json;

        setPage(
          pagePayload || {
            title: 'ServiceUp Landing',
            slug: PAGE_SLUG,
            data: { blocks: { blocks: [] } },
          },
        );
        setStatus('ready');
      } catch (err) {
        console.error('Error loading page', err);
        setError(err.message || 'Error loading page');

        // Fallback so the UI still renders something,
        // even if the API isn’t wired up yet.
        setPage({
          title: 'ServiceUp Landing',
          slug: PAGE_SLUG,
          data: { blocks: { blocks: [] } },
        });
        setStatus('error');
      }
    }

    loadPage();
  }, []);

  return (
    <div className="site-shell">
      {/* HEADER */}
      <header className="site-header">
        <div className="site-header-inner">
          <div className="site-logo">
            {/* You can swap this for an SVG/logo image later */}
            ServiceUp
          </div>

          {/* Simple placeholder nav – customize as needed */}
          <nav className="site-nav">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </header>

      {/* MAIN */}
      <main className="site-main">
        {/* HERO */}
        <section className="hero">
          <div className="hero-inner">
            <p className="hero-subheading">
              Build client sites and apps in hours — not weeks.
            </p>
            <h1>
              Spin up complete websites & apps with{' '}
              <span>Gizmos & Gadgets</span>
            </h1>
            <p>
              ServiceUp is your headless “site builder engine”: define
              content once, and generate matching frontends, admin
              dashboards, and APIs for every project.
            </p>

            <div className="hero-cta">
              <a href="#get-started" className="btn-primary">
                Get started with ServiceUp
              </a>
              <a href="#demo" className="btn-secondary">
                View live demo
              </a>
            </div>

            {status === 'loading' && (
              <p className="hero-status">Loading page content…</p>
            )}
            {status === 'error' && (
              <p className="hero-status hero-status-error">
                We couldn’t load dynamic content yet ({error}).<br />
                The static landing still works, and widgets/page data
                will appear once your API is wired up.
              </p>
            )}
          </div>
        </section>

        {/* PAGE CONTENT RENDERED BY GIZMOS/GADGETS */}
        <section id="features" className="page-section">
          {page && (
            <Page page={page} gadgetSlug={GADGET_SLUG} />
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <span>
            © {new Date().getFullYear()} ServiceUp. All rights
            reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
