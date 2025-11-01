// admin/vite.config.js
const { resolve } = require("path");
const react = require("@vitejs/plugin-react");

/** @type {import("vite").UserConfig} */
module.exports = {
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@utils": resolve(__dirname, "src/utils"),
    },
  },
};
