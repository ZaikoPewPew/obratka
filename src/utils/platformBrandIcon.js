/**
 * Иконка площадки портфолио: Simple Icons / favicon для известных брендов,
 * иначе метка «www» (кастомный / личный сайт).
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
 *   label: string;
 *   slug?: string;
 *   faviconHost?: string;
 * }} PlatformBrandEntry
 */

/**
 * Известные площадки: SVG в Simple Icons (jsDelivr) или favicon (без slug).
 * Более специфичные суффиксы — раньше общих.
 *
 * @type {readonly PlatformBrandEntry[]}
 */
export const PLATFORM_BRAND_ICONS = Object.freeze([
  {
    suffix: "docs.google.com",
    slug: "googledocs",
    faviconHost: "docs.google.com",
    label: "Google Docs",
  },
  {
    suffix: "drive.google.com",
    slug: "googledrive",
    faviconHost: "drive.google.com",
    label: "Google Drive",
  },
  {
    suffix: "sheets.google.com",
    slug: "googlesheets",
    faviconHost: "sheets.google.com",
    label: "Google Sheets",
  },
  {
    suffix: "slides.google.com",
    slug: "googleslides",
    faviconHost: "slides.google.com",
    label: "Google Slides",
  },
  { suffix: "behance.net", slug: "behance", label: "Behance" },
  { suffix: "dribbble.com", slug: "dribbble", label: "Dribbble" },
  { suffix: "instagram.com", slug: "instagram", label: "Instagram" },
  { suffix: "facebook.com", slug: "facebook", label: "Facebook" },
  {
    suffix: "fb.com",
    slug: "facebook",
    faviconHost: "facebook.com",
    label: "Facebook",
  },
  { suffix: "twitter.com", slug: "x", faviconHost: "x.com", label: "X" },
  { suffix: "x.com", slug: "x", label: "X" },
  { suffix: "pinterest.com", slug: "pinterest", label: "Pinterest" },
  { suffix: "medium.com", slug: "medium", label: "Medium" },
  {
    suffix: "notion.so",
    slug: "notion",
    faviconHost: "notion.so",
    label: "Notion",
  },
  {
    suffix: "notion.site",
    slug: "notion",
    faviconHost: "notion.so",
    label: "Notion",
  },
  {
    suffix: "notion.com",
    slug: "notion",
    faviconHost: "notion.so",
    label: "Notion",
  },
  { suffix: "miro.com", slug: "miro", label: "Miro" },
  { suffix: "artstation.com", slug: "artstation", label: "ArtStation" },
  { suffix: "framer.com", slug: "framer", label: "Framer" },
  {
    suffix: "framer.website",
    slug: "framer",
    faviconHost: "framer.com",
    label: "Framer",
  },
  {
    suffix: "framer.ai",
    slug: "framer",
    faviconHost: "framer.com",
    label: "Framer",
  },
  { suffix: "webflow.com", slug: "webflow", label: "Webflow" },
  { suffix: "figma.com", slug: "figma", label: "Figma" },
  { suffix: "awwwards.com", slug: "awwwards", label: "Awwwards" },
  /** Нет в Simple Icons — favicon с designfolio.me */
  {
    suffix: "designfolio.me",
    faviconHost: "designfolio.me",
    label: "Designfolio",
  },
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
 *   label: string;
 * } | {
 *   kind: "web";
 *   label: null;
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
    const googleIcon = googleFaviconUrl(faviconHost);
    const ddgIcon = duckDuckGoFaviconUrl(faviconHost);
    if (!brand.slug) {
      return {
        kind: "brand",
        src: googleIcon,
        fallbacks: [ddgIcon, `https://${faviconHost}/favicon.ico`],
        label: brand.label,
      };
    }
    return {
      kind: "brand",
      src: simpleIconsUrl(brand.slug),
      fallbacks: [googleIcon, ddgIcon],
      label: brand.label,
    };
  }

  return { kind: "web", label: null };
}
