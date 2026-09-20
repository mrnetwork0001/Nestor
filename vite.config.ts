import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The static-hosting CLI injects the mount path when it builds for convex.site.
  base: process.env.STATIC_HOSTING_BASE_PATH ?? "/",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Everything in dist/ is uploaded to Convex storage, so skip source maps.
  build: { sourcemap: false },
  server: { port: 5173, strictPort: false },
});
