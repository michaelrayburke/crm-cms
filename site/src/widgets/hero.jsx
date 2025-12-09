import React from 'react';

/**
 * HeroWidget
 *
 * A full‑screen hero component used on the ServiceUp landing page.  This
 * widget displays a headline, subheading, body text and call‑to‑action
 * buttons alongside a row of mascot images.  When placed as the first
 * block on a page it creates the opening hero section.  All props are
 * optional; sensible defaults are provided to ensure the hero renders
 * nicely even if the CMS doesn’t supply values.
 *
 * Props (all optional):
 *  - eyebrow: string – small label above the headline
 *  - title: string – main heading for the hero
 *  - subtitle: string – secondary heading
 *  - body: string – descriptive paragraph beneath the headline
 *  - primaryLabel: string – text for the primary call‑to‑action button
 *  - primaryHref: string – URL for the primary button
 *  - secondaryLabel: string – text for the secondary button
 *  - secondaryHref: string – URL for the secondary button
 *  - logo: string – URL to the logo mascot image
 *  - gizmo: string – URL to the Gizmo mascot image
 *  - gadget: string – URL to the Gadget mascot image
 *  - widget: string – URL to the Widget mascot image
 */
export default function HeroWidget(props) {
  const defaultImages = {
    logo:
      'https://amvelysrjxpigiokbkgr.supabase.co/storage/v1/object/public/uploads-public/155afc74-ecea-4448-8f78-21dc496ff3c2/image/unknown/new/1765260502179-54uoe9o75z.svg',
    gizmo:
      'https://amvelysrjxpigiokbkgr.supabase.co/storage/v1/object/public/uploads-public/155afc74-ecea-4448-8f78-21dc496ff3c2/image/unknown/new/1765260548281-c9h7kn2q4dk.svg',
    gadget:
      'https://amvelysrjxpigiokbkgr.supabase.co/storage/v1/object/public/uploads-public/155afc74-ecea-4448-8f78-21dc496ff3c2/image/unknown/new/1765260895066-2bj6nsk0swh.svg',
    widget:
      'https://amvelysrjxpigiokbkgr.supabase.co/storage/v1/object/public/uploads-public/155afc74-ecea-4448-8f78-21dc496ff3c2/image/unknown/new/1765260865949-hlhuo56pzxv.svg',
  };

  const {
    eyebrow = 'Build client sites and apps in hours — not weeks.',
    title = 'Spin up complete websites & apps with Gizmos & Gadgets',
    subtitle = '',
    body =
      'ServiceUp is your headless site builder engine: define your content once and instantly spin up matching websites, admin dashboards and powerful APIs for every project.',
    primaryLabel = 'Get started',
    primaryHref = '#contact',
    secondaryLabel = 'Live demo',
    secondaryHref = '#about',
    logo = defaultImages.logo,
    gizmo = defaultImages.gizmo,
    gadget = defaultImages.gadget,
    widget = defaultImages.widget,
  } = props || {};

  return (
    <section className="hero">
      <div className="hero-text">
        {eyebrow && (
          <p className="hero-eyebrow">
            {eyebrow}
          </p>
        )}
        <h1 className="hero-title">{title}</h1>
        {subtitle && <p className="hero-subtitle">{subtitle}</p>}
        {body && <p className="hero-body">{body}</p>}
        <div className="hero-cta">
          {primaryLabel && (
            <a href={primaryHref} className="cta-button primary">
              {primaryLabel}
            </a>
          )}
          {secondaryLabel && (
            <a href={secondaryHref} className="cta-button secondary">
              {secondaryLabel}
            </a>
          )}
        </div>
      </div>
      <div className="hero-images">
        <img src={logo} alt="ServiceUp logo mascot" />
        <img src={gizmo} alt="Gizmo mascot" />
        <img src={gadget} alt="Gadget mascot" />
        <img src={widget} alt="Widget mascot" />
      </div>
    </section>
  );
}