import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import { LANDING_ENABLED } from "./src/config/landing.js";
import { buildRobotsTxt, buildSitemapXml } from "./src/config/siteCrawl.js";

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

/**
 * @param {string} url
 * @returns {{ pathname: string, search: string }}
 */
function splitRequestUrl(url) {
  const raw = String(url || "/");
  const qIndex = raw.indexOf("?");
  const pathname = (qIndex >= 0 ? raw.slice(0, qIndex) : raw).split("#")[0];
  const search = qIndex >= 0 ? raw.slice(qIndex) : "";
  return { pathname, search };
}

/**
 * Пока лендос выключен: `/landing` → корень SPA (query сохраняется).
 * Dev/preview — 302; prod Pages — stub `dist/landing/index.html`.
 * @param {string} base — Vite base, всегда с хвостовым `/`
 */
function landingOffPlugin(base) {
  const landingRoot = `${base}landing`.replace(/\/{2,}/g, "/");

  /**
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   * @param {() => void} next
   */
  function sendRedirect(req, res, next) {
    const { pathname, search } = splitRequestUrl(req.url);
    const stripped = pathname.replace(/\/+$/, "") || "/";
    const root = landingRoot.replace(/\/+$/, "");
    if (stripped !== root && !stripped.startsWith(`${root}/`)) {
      next();
      return;
    }
    res.statusCode = 302;
    res.setHeader("Location", `${base}${search}`);
    res.end();
  }

  const redirectHtml = `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex, nofollow" />
    <title>обратка</title>
    <script>
      location.replace(${JSON.stringify(base)} + location.search + location.hash);
    </script>
    <meta http-equiv="refresh" content="0;url=${base}" />
  </head>
  <body></body>
</html>
`;

  return {
    name: "obratka-landing-off",
    configureServer(server) {
      server.middlewares.use(sendRedirect);
    },
    configurePreviewServer(server) {
      server.middlewares.use(sendRedirect);
    },
    writeBundle(options) {
      const dir = join(options.dir || "dist", "landing");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "index.html"), redirectHtml, "utf8");
    },
  };
}

/**
 * robots.txt / sitemap.xml из `LANDING_ENABLED` (не статика в `public/`).
 * Dev/preview — middleware; prod — `dist/` после копирования public.
 * @param {{ enabled: boolean, origin: string, base: string }} opts
 */
function siteCrawlPlugin({ enabled, origin, base }) {
  const robots = buildRobotsTxt({ enabled, origin, base });
  const sitemap = buildSitemapXml({ enabled, origin, base });
  const robotsPath = `${base}robots.txt`.replace(/\/{2,}/g, "/");
  const sitemapPath = `${base}sitemap.xml`.replace(/\/{2,}/g, "/");

  /**
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   * @param {() => void} next
   */
  function serveCrawl(req, res, next) {
    const { pathname } = splitRequestUrl(req.url);
    if (pathname === robotsPath) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(robots);
      return;
    }
    if (pathname === sitemapPath) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.end(sitemap);
      return;
    }
    next();
  }

  return {
    name: "obratka-site-crawl",
    configureServer(server) {
      server.middlewares.use(serveCrawl);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveCrawl);
    },
    writeBundle(options) {
      const dir = options.dir || "dist";
      writeFileSync(join(dir, "robots.txt"), robots, "utf8");
      writeFileSync(join(dir, "sitemap.xml"), sitemap, "utf8");
    },
  };
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

  /** @type {Record<string, string>} */
  const input = {
    main: resolve(__dirname, "index.html"),
  };
  if (LANDING_ENABLED) {
    input.landing = resolve(__dirname, "landing/index.html");
  }

  return {
    base,
    // Only `VITE_*` auto-expose; allowlisted SUPABASE_/TELEGRAM_ via `define` above.
    envPrefix: ["VITE_"],
    define: defineEnv,
    build: {
      rollupOptions: {
        input,
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
      siteCrawlPlugin({ enabled: LANDING_ENABLED, origin: siteOrigin, base }),
      ...(LANDING_ENABLED ? [] : [landingOffPlugin(base)]),
    ],
  };
});
