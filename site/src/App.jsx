import React, { useEffect, useState } from 'react';
import Page from './Page';

// Image assets for mascots. If you later store these in the CMS, you can
// reference them via config on the page or via environment variables. For now we
// fall back to the Supabase URLs provided by the user.
const LOGO_IMG =
  import.meta.env.VITE_LOGO_URL ||
  'https://amvelysrjxpigiokbkgr.supabase.co/storage/v1/object/public/uploads-public/155afc74-ecea-4448-8f78-21dc496ff3c2/image/unknown/new/1765260502179-54uoe9o75z.svg';
const GIZMO_IMG =
  import.meta.env.VITE_GIZMO_URL ||
  'https://amvelysrjxpigiokbkgr.supabase.co/storage/v1/object/public/uploads-public/155afc74-ecea-4448-8f78-21dc496ff3c2/image/unknown/new/1765260548281-c9h7kn2q4dk.svg';
const GADGET_IMG =
  import.meta.env.VITE_GADGET_URL ||
  'https://amvelysrjxpigiokbkgr.supabase.co/storage/v1/object/public/uploads-public/155afc74-ecea-4448-8f78-21dc496ff3c2/image/unknown/new/1765260895066-2bj6nsk0swh.svg';
const WIDGET_IMG =
  import.meta.env.VITE_WIDGET_URL ||
  'https://amvelysrjxpigiokbkgr.supabase.co/storage/v1/object/public/uploads-public/155afc74-ecea-4448-8f78-21dc496ff3c2/image/unknown/new/1765260865949-hlhuo56pzxv.svg';

// Public API base (same pattern as in Page.jsx)
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// These let you change which gadget/page this frontend is showing
const GADGET_SLUG =
  import.meta.env.VITE_GADGET_SLUG || 'serviceup-site';
const PAGE_SLUG =
  import.meta.env.VITE_PAGE_SLUG || 'home';

export default function App() {
  const [page, setPage] = useState(null);
  const [status, setStatus] = useState('loading');
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
          <div className="site-logo">ServiceUp</div>
          <nav className="site-nav">
            <a href="#about">About</a>
            <a href="#mascots">Mascots</a>
            <a href="#contact">Contact</a>
          </nav>
        </div>
      </header>
      <main className="site-main">
        {/* Page content loaded from CMS. The hero widget should be the first block in your page. */}
        {page && <Page page={page} gadgetSlug={GADGET_SLUG} />}
        {/* ABOUT SECTION */}
        <section id="about" className="section about-section">
          <h2>What is ServiceUp?</h2>
          <p>
            ServiceUp is your headless site builder engine. Define your content once and instantly spin up matching
            websites, admin dashboards, and powerful APIs for every client project. With ServiceUp you get the
            speed of a template builder with the flexibility of a custom CMS — build client sites and apps in
            hours, not weeks.
          </p>
        </section>
        {/* MASCOTS SECTION */}
        <section id="mascots" className="section mascots-section">
          <h2>Meet the Squad</h2>
          <div className="mascots-grid">
            <div className="mascot-card">
              <img src={GIZMO_IMG} alt="Gizmo" />
              <h3>Gizmo</h3>
              <p>
                Gizmo handles the nitty gritty tasks behind the scenes, keeping your content structured and tidy.
              </p>
            </div>
            <div className="mascot-card">
              <img src={GADGET_IMG} alt="Gadget" />
              <h3>Gadget</h3>
              <p>
                Gadget powers your client sites and apps, turning your content into beautiful, responsive frontends.
              </p>
            </div>
            <div className="mascot-card">
              <img src={WIDGET_IMG} alt="Widget" />
              <h3>Widget</h3>
              <p>
                Widget connects everything together — the final puzzle piece that takes your project from idea to
                reality.
              </p>
            </div>
          </div>
        </section>
        {/* CONTACT SECTION */}
        <section id="contact" className="section contact-section">
          <h2>Get in Touch</h2>
          <p>
            Ready to empower your clients? Fill out the form below and we’ll reach out to show you how ServiceUp can
            level up your workflow.
          </p>
          <form className="contact-form" action="mailto:michael@burkemedia.pro" method="POST" encType="text/plain">
            <input type="text" name="name" placeholder="Your Name" required />
            <input type="email" name="email" placeholder="Your Email" required />
            <textarea name="message" placeholder="How can we help you?" required />
            <button type="submit">Send Message</button>
          </form>
        </section>
      </main>
      {/* FOOTER */}
      <footer className="site-footer">
        <div className="site-footer-inner">
          <span>
            © {new Date().getFullYear()} ServiceUp. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
