/**
 * robots.txt / sitemap.xml от `LANDING_ENABLED`.
 * Источник правды для crawl — этот модуль (Vite пишет файлы в dist / отдаёт в dev).
 * Не править статику в `public/`.
 */

import { ROUTE_PATHS } from "../app/routes.js";

/** Промо MPA; trailing slash как canonical в `landing/index.html`. */
const LANDING_PATH = "/landing/";

/**
 * @param {string} [raw]
 * @returns {string}
 */
function normalizeOrigin(raw) {
  return String(raw || "").replace(/\/+$/, "");
}

/**
 * @param {string} [raw]
 * @returns {string}
 */
function normalizeBase(raw) {
  const value = String(raw || "/").trim() || "/";
  if (value === "/") return "/";
  return value.endsWith("/") ? value : `${value}/`;
}

/**
 * Path на сайте с учётом Vite base (`/home` или `/obratka/home`).
 * @param {string} base
 * @param {string} path — начинается с `/`
 * @returns {string}
 */
function joinBase(base, path) {
  const b = normalizeBase(base);
  const p = path.startsWith("/") ? path : `/${path}`;
  if (b === "/") return p;
  return `${b.slice(0, -1)}${p}`;
}

/**
 * @param {string} origin
 * @param {string} base
 * @param {string} pathOrFile — `/landing/` или `sitemap.xml`
 * @returns {string}
 */
function absoluteUrl(origin, base, pathOrFile) {
  const o = normalizeOrigin(origin);
  const b = normalizeBase(base);
  if (pathOrFile.startsWith("/")) {
    return `${o}${joinBase(b, pathOrFile)}`;
  }
  return `${o}${b}${pathOrFile}`;
}

/**
 * Вложенные path (`/registration/code`, `/quiz/done`) покрываются родителем.
 * Корень `/` не отдаём — его режет meta noindex, не Disallow.
 * @param {string} base
 * @returns {string[]}
 */
function spaDisallowPaths(base) {
  const paths = Object.values(ROUTE_PATHS).filter((path) => path !== "/");
  const byLength = [...paths].sort((a, b) => a.length - b.length);
  /** @type {string[]} */
  const prefixes = [];
  for (const path of byLength) {
    if (prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      continue;
    }
    prefixes.push(path);
  }
  const keep = new Set(prefixes);
  return paths.filter((path) => keep.has(path)).map((path) => joinBase(base, path));
}

/**
 * @param {{
 *   enabled: boolean;
 *   origin: string;
 *   base?: string;
 * }} opts
 * @returns {string}
 */
export function buildRobotsTxt(opts) {
  const enabled = Boolean(opts.enabled);
  const origin = opts.origin;
  const base = opts.base ?? "/";
  const landingPath = joinBase(base, LANDING_PATH);

  const lines = [
    "# Custom domain (obratka.net) on GitHub Pages. Root base `/`.",
    "# SPA shell is also noindex via <meta robots> in index.html.",
    enabled
      ? "# Landing MPA on (`LANDING_ENABLED`) — index /landing/ only."
      : "# Landing MPA off (`LANDING_ENABLED = false`) — do not index /landing/.",
    "User-agent: *",
    enabled ? `Allow: ${landingPath}` : `Disallow: ${landingPath}`,
    "",
  ];

  for (const path of spaDisallowPaths(base)) {
    lines.push(`Disallow: ${path}`);
  }

  lines.push("");
  lines.push(`Sitemap: ${absoluteUrl(origin, base, "sitemap.xml")}`);
  lines.push("");
  return lines.join("\n");
}

/**
 * @param {{
 *   enabled: boolean;
 *   origin: string;
 *   base?: string;
 * }} opts
 * @returns {string}
 */
export function buildSitemapXml(opts) {
  const enabled = Boolean(opts.enabled);
  const origin = opts.origin;
  const base = opts.base ?? "/";
  const loc = absoluteUrl(origin, base, LANDING_PATH);
  const inner = enabled
    ? `  <url>\n    <loc>${loc}</loc>\n  </url>\n`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${inner}</urlset>\n`;
}
