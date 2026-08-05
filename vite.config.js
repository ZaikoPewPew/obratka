import { resolve } from "node:path";
import { defineConfig } from "vite";

/** Prod origin for absolute OG / canonical / sitemap URLs (GitHub Pages). */
const SITE_ORIGIN = "https://zaikopewpew.github.io";

/**
 * Normalize Vite base to always end with `/` (except empty → `/`).
 * @param {string} raw
 */
function normalizeBase(raw) {
  const value = String(raw || "/").trim() || "/";
  if (value === "/") return "/";
  return value.endsWith("/") ? value : `${value}/`;
}

export default defineConfig(() => {
  // GitHub Pages project site: /obratka/ (см. workflow). Локально — /.
  const base = normalizeBase(process.env.VITE_BASE_PATH || "/");

  return {
    base,
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
    plugins: [
      {
        name: "obratka-site-url-placeholders",
        transformIndexHtml(html) {
          // Build with VITE_BASE_PATH=/obratka/ → absolute Pages URLs for OG/canonical.
          return html
            .replaceAll("%SITE_ORIGIN%", SITE_ORIGIN)
            .replaceAll("%SITE_BASE%", base);
        },
      },
    ],
  };
});
