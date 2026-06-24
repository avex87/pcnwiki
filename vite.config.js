import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Cloudflare Pages serves the built site from /dist at the site root.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
  },
});
