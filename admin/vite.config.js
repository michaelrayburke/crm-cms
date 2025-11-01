// OPTIONAL vite.config.js enhancements
// - Adds sourcemap in prod for easier debugging
// - Raises chunkSizeWarningLimit
// - Keeps your existing aliases (adjust if you already have this file)
const { resolve } = require('path');

/** @type {import('vite').UserConfig} */
module.exports = {
  build: {
    sourcemap: true,               // optional, remove if you prefer
    chunkSizeWarningLimit: 800,    // quiet large bundle warnings
  },
  resolve: {
    alias: {
      '@utils': resolve(__dirname, 'src/utils'),
      '@':      resolve(__dirname, 'src'),
    },
  },
};
