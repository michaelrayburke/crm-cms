// site/src/widgets/hero.jsx
import React from 'react';

/**
 * Hero widget
 *
 * Props come from:
 *  - widget.config in the database
 *  - overridden by block.props in the page's blocks
 *
 * Suggested config shape:
 * {
 *   eyebrow?: string
 *   title?: string
 *   subtitle?: string
 *   body?: string
 *   primaryLabel?: string
 *   primaryHref?: string
 *   secondaryLabel?: string
 *   secondaryHref?: string
 * }
 */
export default function HeroWidget(props) {
  const {
    eyebrow = 'Build client sites and apps in hours — not weeks.',
    title = 'Spin up complete websites & apps with Gizmos & Gadgets',
    subtitle = '',
    body = 'ServiceUp is your headless “site builder engine”: define content once, and generate matching frontends, admin dashboards, and APIs for every project.',
    primaryLabel = 'Get started with ServiceUp',
    primaryHref = '#get-started',
    secondaryLabel = 'View live demo',
    secondaryHref = '#demo',
  } = props || {};

  return (
    <section className="hero">
      <div className="hero-inner">
        {eyebrow && (
          <p className="hero-subheading">
            {eyebrow}
          </p>
        )}

        <h1>{title}</h1>

        {subtitle && (
          <p className="hero-subheading">
            {subtitle}
          </p>
        )}

        {body && <p>{body}</p>}

        <div className="hero-cta">
          {primaryLabel && (
            <a href={primaryHref}>
              {primaryLabel}
            </a>
          )}
          {secondaryLabel && (
            <a href={secondaryHref}>
              {secondaryLabel}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
