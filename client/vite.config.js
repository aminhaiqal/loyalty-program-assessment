import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: clientDir,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(clientDir, "src")
    }
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3000" }
  },
  build: {
    outDir: path.resolve(clientDir, "../dist"),
    emptyOutDir: true
  }
});
