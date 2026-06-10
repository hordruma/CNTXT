import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5180,
    proxy: {
      "/api": "http://localhost:3100",
    },
  },
  build: {
    outDir: "dist",
  },
});
