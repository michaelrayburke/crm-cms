// admin/vite.config.js (CommonJS)
const { resolve } = require("path");
const react = require("@vitejs/plugin-react");

/** @type {import("vite").UserConfig} */
module.exports = {
  plugins: [react()],
  resolve: {
    alias: {
      "@utils": resolve(__dirname, "src/utils"),
      "@":      resolve(__dirname, "src"),
    },
  },
  build: {
    sourcemap: true,
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
    },
  },
};
