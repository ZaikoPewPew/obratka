import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages project site: /obratka/ (см. workflow). Локально — /.
  base: process.env.VITE_BASE_PATH || "/",
  // Разрешаем использовать переменные Supabase без префикса VITE_.
  envPrefix: ["VITE_", "SUPABASE_", "TELEGRAM_"],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        landing: resolve(__dirname, "landing/index.html"),
      },
    },
  },
  server: {
    // Фиксированный порт для локальной разработки.
    port: 5173,
    // Автооткрытие страницы после запуска dev-сервера.
    open: true,
  },
});
