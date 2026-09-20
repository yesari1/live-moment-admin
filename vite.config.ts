import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// This repo serves only the admin console, at the root of
// https://admin.yesastudio.com/.
export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    watch: {
      // Never watch secret key material: locked files crash the dev watcher,
      // and these must never be served or bundled.
      ignored: [
        "**/*firebase-adminsdk*.json",
        "**/service-account*.json",
        "**/*.pem",
      ],
    },
  },
});
