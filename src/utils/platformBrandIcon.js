/**
 * Иконка площадки портфолио: Simple Icons для известных брендов,
 * иначе литера «W» (кастомный / личный сайт).
 */

import { hostMatchesSuffix } from "./embedHosts.js";
import {
  duckDuckGoFaviconUrl,
  googleFaviconUrl,
  iconDomain,
} from "./portfolioMeta.js";

/** Pin Simple Icons major — без LinkedIn/Adobe (убраны из SI по бренд-гайдам). */
const SIMPLE_ICONS_VERSION = "v15";

/**
 * @typedef {{
 *   suffix: string;
 *   slug: string;
 *   faviconHost?: string;
 * }} PlatformBrandEntry
 */

/**
 * Известные площадки с SVG в Simple Icons (jsDelivr).
 * Более специфичные суффиксы — раньше общих.
 *
 * @type {readonly PlatformBrandEntry[]}
 */
export const PLATFORM_BRAND_ICONS = Object.freeze([
  { suffix: "docs.google.com", slug: "googledocs", faviconHost: "docs.google.com" },
  { suffix: "drive.google.com", slug: "googledrive", faviconHost: "drive.google.com" },
  { suffix: "sheets.google.com", slug: "googlesheets", faviconHost: "sheets.google.com" },
  { suffix: "slides.google.com", slug: "googleslides", faviconHost: "slides.google.com" },
  { suffix: "behance.net", slug: "behance" },
  { suffix: "dribbble.com", slug: "dribbble" },
  { suffix: "instagram.com", slug: "instagram" },
  { suffix: "facebook.com", slug: "facebook" },
  { suffix: "fb.com", slug: "facebook", faviconHost: "facebook.com" },
  { suffix: "twitter.com", slug: "x", faviconHost: "x.com" },
  { suffix: "x.com", slug: "x" },
  { suffix: "pinterest.com", slug: "pinterest" },
  { suffix: "medium.com", slug: "medium" },
  { suffix: "notion.so", slug: "notion", faviconHost: "notion.so" },
  { suffix: "notion.site", slug: "notion", faviconHost: "notion.so" },
  { suffix: "notion.com", slug: "notion", faviconHost: "notion.so" },
  { suffix: "miro.com", slug: "miro" },
  { suffix: "artstation.com", slug: "artstation" },
  { suffix: "framer.com", slug: "framer" },
  { suffix: "framer.website", slug: "framer", faviconHost: "framer.com" },
  { suffix: "framer.ai", slug: "framer", faviconHost: "framer.com" },
  { suffix: "webflow.com", slug: "webflow" },
  { suffix: "figma.com", slug: "figma" },
  { suffix: "awwwards.com", slug: "awwwards" },
]);

/**
 * @param {string} slug
 * @returns {string}
 */
export function simpleIconsUrl(slug) {
  const safe = String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return `https://cdn.jsdelivr.net/npm/simple-icons@${SIMPLE_ICONS_VERSION}/icons/${safe}.svg`;
}

/**
 * @param {string} hostnameOrUrl
 * @returns {string}
 */
function hostnameFromInput(hostnameOrUrl) {
  const raw = String(hostnameOrUrl || "").trim();
  if (!raw) return "";
  try {
    if (/^https?:\/\//i.test(raw)) {
      return iconDomain(new URL(raw).hostname);
    }
    return iconDomain(raw);
  } catch {
    return iconDomain(raw);
  }
}

/**
 * @param {string} hostname
 * @returns {PlatformBrandEntry | null}
 */
export function findPlatformBrandIcon(hostname) {
  const host = iconDomain(hostname);
  if (!host) return null;
  for (const entry of PLATFORM_BRAND_ICONS) {
    if (hostMatchesSuffix(host, entry.suffix)) {
      return entry;
    }
  }
  return null;
}

/**
 * @typedef {{
 *   kind: "brand";
 *   src: string;
 *   fallbacks: string[];
 * } | {
 *   kind: "web";
 * }} PlatformIconResolved
 */

/**
 * @param {string} hostnameOrUrl — hostname или полный URL портфолио
 * @returns {PlatformIconResolved | null}
 */
export function resolvePlatformIcon(hostnameOrUrl) {
  const host = hostnameFromInput(hostnameOrUrl);
  if (!host) return null;

  const brand = findPlatformBrandIcon(host);
  if (brand) {
    const faviconHost = brand.faviconHost || host;
    return {
      kind: "brand",
      src: simpleIconsUrl(brand.slug),
      fallbacks: [
        googleFaviconUrl(faviconHost),
        duckDuckGoFaviconUrl(faviconHost),
      ],
    };
  }

  return { kind: "web" };
}
