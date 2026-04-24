import path from "path";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const classicScriptBuild = (): Plugin => ({
  name: "classic-script-build",
  apply: "build",
  transformIndexHtml(html) {
    return html.replace('type="module" crossorigin', "defer");
  },
});

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    classicScriptBuild(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
