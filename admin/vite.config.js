// vite.config.js
const { resolve } = require("path");

/** @type {import("vite").UserConfig} */
module.exports = {
  base: "./",
  resolve: {
    alias: {
      "@utils": resolve(__dirname, "src/utils"),
      "@": resolve(__dirname, "src"),
    },
  },
};
