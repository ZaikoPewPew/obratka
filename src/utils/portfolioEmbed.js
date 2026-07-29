/**
 * Как показать портфолио: iframe, Figma/YouTube embed или внешняя вкладка.
 * Каталог хостов: embedHosts.js / content/embed-hosts.md
 */

import { findExternalEmbedHost } from "./embedHosts.js";

export {
  findExternalEmbedHost,
  hostMatchesSuffix,
  isKnownExternalOnlyHost,
  EXTERNAL_EMBED_HOSTS,
} from "./embedHosts.js";

const FIGMA_EMBED_HOST = "obratka";

/**
 * @param {URLSearchParams} from
 * @param {URLSearchParams} to
 */
function copySearchParams(from, to) {
  from.forEach((value, key) => {
    const normalized = key === "node_id" ? "node-id" : key;
    if (normalized === "embed_host") return;
    to.set(normalized, value);
  });
}

/**
 * @param {string} href
 * @returns {string | null}
 */
export function toFigmaEmbedUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();

  if (host === "embed.figma.com") {
    if (!url.searchParams.has("embed-host")) {
      url.searchParams.set("embed-host", FIGMA_EMBED_HOST);
    }
    return url.href;
  }

  if (host !== "figma.com") return null;

  if (url.pathname === "/embed" || url.pathname.startsWith("/embed/")) {
    const nested = url.searchParams.get("url");
    if (!nested) return null;
    return toFigmaEmbedUrl(nested);
  }

  const match = url.pathname.match(
    /^\/(design|file|proto|board|slides|deck)\/([^/]+)(\/.*)?$/i,
  );
  if (!match) return null;

  let type = match[1].toLowerCase();
  if (type === "file") type = "design";
  const fileKey = match[2];
  const rest = match[3] || "";

  const embed = new URL(`https://embed.figma.com/${type}/${fileKey}${rest}`);
  copySearchParams(url.searchParams, embed.searchParams);
  embed.searchParams.set("embed-host", FIGMA_EMBED_HOST);
  return embed.href;
}

/**
 * @param {string} href
 * @returns {string | null}
 */
export function toYouTubeEmbedUrl(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  let videoId = null;

  if (host === "youtu.be") {
    videoId = url.pathname.replace(/^\//, "").split("/")[0] || null;
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else {
      const embedMatch = url.pathname.match(
        /^\/(?:embed|shorts|live)\/([^/]+)/i,
      );
      if (embedMatch) videoId = embedMatch[1];
    }
  }

  if (!videoId) return null;
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
}

/**
 * @typedef {'iframe' | 'external'} PortfolioEmbedMode
 *
 * @typedef {{
 *   mode: PortfolioEmbedMode,
 *   openUrl: string,
 *   frameSrc: string | null,
 *   allowFullscreen: boolean,
 *   hostLabel: string,
 * }} PortfolioEmbedPlan
 */

/** Max HTML sample for Readymag fingerprint (props blob can be large). */
const READYMAG_HTML_PROBE_CHARS = 120_000;

/** @type {readonly RegExp[]} */
const READYMAG_HTML_MARKERS = Object.freeze([
  /name\s*=\s*["']generator["'][^>]*content\s*=\s*["']Readymag["']/i,
  /content\s*=\s*["']Readymag["'][^>]*name\s*=\s*["']generator["']/i,
  /Designed with Readymag/i,
  /__RM_PROPS__/i,
  /\.rmcdn\.net\b/i,
  /\.rmcdn1\.net\b/i,
]);

/**
 * @param {string} html
 * @returns {boolean}
 */
export function looksLikeReadymagHtml(html) {
  const sample = String(html || "").slice(0, READYMAG_HTML_PROBE_CHARS);
  if (!sample) return false;
  return READYMAG_HTML_MARKERS.some((re) => re.test(sample));
}

/**
 * Best-effort CORS fetch. Often fails on custom domains — then iframe fallback.
 * @param {string} portfolioUrl
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
export async function probeReadymagPortfolio(portfolioUrl, opts = {}) {
  const timeoutMs =
    typeof opts.timeoutMs === "number" && opts.timeoutMs > 0
      ? opts.timeoutMs
      : 4000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(portfolioUrl, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const html = await response.text();
    return looksLikeReadymagHtml(html);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Framing blocked после load/error optimistic iframe?
 *
 * - `about:blank` / `about:*` (XFO/CSP/сеть) → blocked → external UI.
 * - SecurityError на `location` → чужой документ сел → iframe ok.
 * - Читаемый `http(s)` href → документ реально загрузился (в т.ч. same-origin
 *   GH Pages: `…github.io/obratka` ↔ `…github.io/NewPortfolio`) → iframe ok.
 *   Старый `return true` на любом readable location ложно кидал github.io в external.
 *
 * @param {HTMLIFrameElement | null | undefined} iframe
 * @returns {boolean}
 */
export function isLikelyFrameBlocked(iframe) {
  if (!iframe) return true;
  try {
    const win = iframe.contentWindow;
    if (!win) return true;
    const href = String(win.location?.href || "");
    // #region agent log
    {
      const blockedEarly =
        !href || href === "about:blank" || href.startsWith("about:");
      const httpOk = /^https?:\/\//i.test(href);
      const result = blockedEarly ? true : httpOk ? false : true;
      const payload = {
        sessionId: "1948db",
        runId: "embed",
        hypothesisId: "H1",
        location: "portfolioEmbed.js:isLikelyFrameBlocked",
        message: "frame blocked check",
        data: { href, blockedEarly, httpOk, result },
        timestamp: Date.now(),
      };
      globalThis.__DBG_1948db = globalThis.__DBG_1948db || [];
      globalThis.__DBG_1948db.push(payload);
      fetch("http://127.0.0.1:7456/ingest/4ffd5680-c2dd-408a-9f58-53e871b7f5b9", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "1948db",
        },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
    // #endregion
    if (!href || href === "about:blank" || href.startsWith("about:")) {
      return true;
    }
    if (/^https?:\/\//i.test(href)) {
      return false;
    }
    return true;
  } catch {
    // #region agent log
    {
      const payload = {
        sessionId: "1948db",
        runId: "embed",
        hypothesisId: "H1",
        location: "portfolioEmbed.js:isLikelyFrameBlocked",
        message: "SecurityError → not blocked",
        data: { result: false },
        timestamp: Date.now(),
      };
      globalThis.__DBG_1948db = globalThis.__DBG_1948db || [];
      globalThis.__DBG_1948db.push(payload);
      fetch("http://127.0.0.1:7456/ingest/4ffd5680-c2dd-408a-9f58-53e871b7f5b9", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "1948db",
        },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
    // #endregion
    return false;
  }
}

/**
 * @param {string} openUrl
 * @param {string} hostLabel
 * @returns {PortfolioEmbedPlan}
 */
export function toExternalEmbedPlan(openUrl, hostLabel) {
  return {
    mode: "external",
    openUrl,
    frameSrc: null,
    allowFullscreen: false,
    hostLabel: hostLabel || "site",
  };
}

/**
 * @param {string} portfolioUrl
 * @returns {PortfolioEmbedPlan}
 */
export function resolvePortfolioEmbed(portfolioUrl) {
  const url = new URL(portfolioUrl);
  const hostnameLabel = url.hostname.replace(/^www\./i, "");

  const figmaEmbed = toFigmaEmbedUrl(portfolioUrl);
  if (figmaEmbed) {
    return {
      mode: "iframe",
      openUrl: portfolioUrl,
      frameSrc: figmaEmbed,
      allowFullscreen: true,
      hostLabel: "Figma",
    };
  }

  const youtubeEmbed = toYouTubeEmbedUrl(portfolioUrl);
  if (youtubeEmbed) {
    return {
      mode: "iframe",
      openUrl: portfolioUrl,
      frameSrc: youtubeEmbed,
      allowFullscreen: true,
      hostLabel: "YouTube",
    };
  }

  const external = findExternalEmbedHost(url.hostname);
  if (external) {
    return toExternalEmbedPlan(portfolioUrl, external.label);
  }

  return {
    mode: "iframe",
    openUrl: portfolioUrl,
    frameSrc: portfolioUrl,
    allowFullscreen: false,
    hostLabel: hostnameLabel,
  };
}
