// site/src/widgetRegistry.js
import React from 'react';

// Example hero widget component
export function HeroWidget({ headline, subheading, primary_cta }) {
  return (
    <section className="max-w-5xl mx-auto py-16 px-4">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          {headline}
        </h1>
        {subheading && (
          <p className="text-lg text-gray-600 max-w-2xl">
            {subheading}
          </p>
        )}
        {primary_cta && primary_cta.label && (
          <div className="pt-4">
            <a
              href={primary_cta.href || '#'}
              className="inline-flex items-center px-6 py-3 rounded-full text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition"
            >
              {primary_cta.label}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

// Add more widget components as you define them:
// - FeatureGridWidget
// - TestimonialWidget
// - CTAWidget
// etc.

const widgetRegistry = {
  hero: HeroWidget,
  // feature_grid: FeatureGridWidget,
  // testimonial: TestimonialWidget,
};

export default widgetRegistry;
