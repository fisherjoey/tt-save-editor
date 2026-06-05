import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Build mode "offline" produces a single self-contained index.html that runs
// from file:// (for the NexusMods download). Default build is the hosted SPA.
export default defineConfig(({ mode }) => ({
  plugins: mode === "offline" ? [react(), viteSingleFile()] : [react()],
  base: mode === "offline" ? "./" : "/",
  build: mode === "offline" ? { assetsInlineLimit: 100 * 1024 * 1024, cssCodeSplit: false } : {},
}));
