import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

/** Prod origin for absolute OG / canonical / sitemap URLs. */
const SITE_ORIGIN_DEFAULT = "https://obratka.net";

/**
 * Publishable client env only — never service_role / bot token / ZAI.
 * Vite `envPrefix` is prefix-based; we inject these by exact name via `define`
 * so a stray `SUPABASE_SERVICE_ROLE_KEY` in build env cannot enter the bundle.
 */
const CLIENT_ENV_ALLOWLIST = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "TELEGRAM_BOT_ID",
  "TELEGRAM_BOT_USERNAME",
];

/**
 * Normalize Vite base to always end with `/` (except empty → `/`).
 * @param {string} raw
 */
function normalizeBase(raw) {
  const value = String(raw || "/").trim() || "/";
  if (value === "/") return "/";
  return value.endsWith("/") ? value : `${value}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Custom domain obratka.net: CI sets `/`. Project-site `/obratka/` only if needed.
  const base = normalizeBase(
    process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || "/",
  );
  const siteOrigin =
    process.env.VITE_SITE_ORIGIN || env.VITE_SITE_ORIGIN || SITE_ORIGIN_DEFAULT;

  /** @type {Record<string, string>} */
  const defineEnv = {};
  for (const key of CLIENT_ENV_ALLOWLIST) {
    defineEnv[`import.meta.env.${key}`] = JSON.stringify(env[key] ?? "");
  }

  return {
    base,
    // Only `VITE_*` auto-expose; allowlisted SUPABASE_/TELEGRAM_ via `define` above.
    envPrefix: ["VITE_"],
    define: defineEnv,
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
          // Build with VITE_BASE_PATH=/ → absolute URLs for OG/canonical on obratka.net.
          return html
            .replaceAll("%SITE_ORIGIN%", siteOrigin)
            .replaceAll("%SITE_BASE%", base);
        },
      },
    ],
  };
});
