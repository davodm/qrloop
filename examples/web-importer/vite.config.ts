import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5174 },
  optimizeDeps: {
    include: ["buffer", "qrloop", "jsqr"],
  },
  define: {
    global: "globalThis",
  },
});
