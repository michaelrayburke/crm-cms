/**
 * widgetRegistry.js
 *
 * Automatically loads all widget components from /widgets.
 * The filename becomes the widget_type key.
 *
 * Examples:
 *   widgets/hero.jsx              → widget_type: "hero"
 *   widgets/feature-grid.jsx      → widget_type: "feature-grid"
 *   widgets/split_section.jsx     → widget_type: "split_section"
 *
 * NO manual imports required.
 */

const modules = import.meta.glob('./widgets/*.{jsx,tsx}', {
  eager: true,
});

const registry = {};

/**
 * Normalize a filename to a widget key.
 * You can adjust this if you want snake_case instead.
 */
function normalizeWidgetKey(name) {
  return name.trim();
}

for (const [path, mod] of Object.entries(modules)) {
  try {
    // Extract filename → "hero.jsx"
    const fileName = path.split('/').pop();

    // Remove extension → "hero", "feature-grid", etc.
    const baseName = fileName.replace(/\.[jt]sx?$/, '');

    const Component = mod.default;

    if (!Component) {
      console.warn(
        `[widgetRegistry] Skipped ${fileName} — no default export found.`
      );
      continue;
    }

    const widgetKey = normalizeWidgetKey(baseName);

    registry[widgetKey] = Component;

    // Optional debug log:
    // console.log(`[widgetRegistry] Registered widget: ${widgetKey}`);
  } catch (err) {
    console.error(`[widgetRegistry] Error loading widget at ${path}`, err);
  }
}

export default registry;
