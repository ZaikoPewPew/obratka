import { defineConfig } from "vite";

export default defineConfig({
  // Разрешаем использовать переменные Supabase без префикса VITE_.
  envPrefix: ["VITE_", "SUPABASE_"],
  server: {
    // Фиксированный порт для локальной разработки.
    port: 5173,
    // Автооткрытие страницы после запуска dev-сервера.
    open: true,
  },
});
