import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: ["VITE_", "SUPABASE_"],
  server: {
    port: 5173,
    open: true,
  },
});
