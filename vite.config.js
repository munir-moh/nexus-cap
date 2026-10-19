import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL("./frontend", import.meta.url)),
  base: mode === "production" ? "/static/build/" : "/",
  publicDir: false,
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/static": "http://127.0.0.1:8000",
    },
  },
  build: {
    outDir: fileURLToPath(new URL("./static/build", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./frontend/index.html", import.meta.url)),
    },
  },
}));
