import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// Cesium loads its web workers, widget styles and built-in assets at runtime from /cesium
// (window.CESIUM_BASE_URL, set in src/components/map/cesium.ts).
const CESIUM = "node_modules/cesium/Build/Cesium";
const CESIUM_BASE = "cesium";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: ["Workers", "ThirdParty", "Assets", "Widgets"].map((dir) => ({ src: `${CESIUM}/${dir}`, dest: CESIUM_BASE, rename: { stripBase: 4 } })),
    }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 3000,
    // The Django API in development. Same-origin through the proxy, so no CORS setup is needed.
    proxy: { "/api": { target: process.env.VITE_API_TARGET ?? "http://localhost:8000", changeOrigin: true } },
  },
});
