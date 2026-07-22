/**
 * Нормализация и метаданные портфолио-URL (имя, favicon).
 */

/** Макс. длина подписи в шапке — чтобы не подходить вплотную к таймеру. */
export const PORTFOLIO_DISPLAY_NAME_MAX = 28;

/**
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizePortfolioUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (!url.hostname.includes(".")) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

/**
 * @param {string} hostname
 * @returns {string}
 */
export function iconDomain(hostname) {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

/**
 * @param {string} hostname
 * @returns {string}
 */
export function googleFaviconUrl(hostname) {
  const host = iconDomain(hostname);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

/**
 * @param {string} hostname
 * @returns {string}
 */
export function duckDuckGoFaviconUrl(hostname) {
  const host = iconDomain(hostname);
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
}

/**
 * @param {string} portfolioUrl
 * @returns {string}
 */
export function originFaviconUrl(portfolioUrl) {
  const { origin } = new URL(portfolioUrl);
  return `${origin}/favicon.ico`;
}

/**
 * @param {string} portfolioUrl
 * @returns {string}
 */
export function portfolioFaviconUrl(portfolioUrl) {
  return googleFaviconUrl(new URL(portfolioUrl).hostname);
}

/**
 * Кандидаты favicon с учётом платформ, где HTML недоступен (CORS)
 * или Google отдаёт пустую заглушку.
 *
 * Порядок: HTML → DuckDuckGo → Google → /favicon.ico
 *
 * DuckDuckGo раньше Google: s2/favicons часто отдаёт серую заглушку
 * как «успешную» картинку, и очередь фолбэков обрывается.
 *
 * @param {string} portfolioUrl
 * @param {string[]} [fromHtml]
 * @returns {string[]}
 */
export function buildFaviconCandidates(portfolioUrl, fromHtml = []) {
  const host = new URL(portfolioUrl).hostname;
  const googleIcon = googleFaviconUrl(host);
  const ddgIcon = duckDuckGoFaviconUrl(host);
  const originIcon = originFaviconUrl(portfolioUrl);

  return [...fromHtml, ddgIcon, googleIcon, originIcon].filter(
    (href, index, list) => Boolean(href) && list.indexOf(href) === index,
  );
}

/**
 * @param {string} hostname
 * @returns {string}
 */
export function labelFromHostname(hostname) {
  const host = hostname.replace(/^www\./i, "");
  const base = host.split(".")[0] || host;
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * @param {string} value
 * @returns {string}
 */
function decodeHtmlEntities(value) {
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    );
}

/**
 * Короткое имя для шапки: бренд / главное из SERP-title, одна строка.
 *
 * @param {string} raw
 * @param {number} [maxLen]
 * @returns {string}
 */
export function formatDisplayLabel(raw, maxLen = PORTFOLIO_DISPLAY_NAME_MAX) {
  let text = String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  const parts = text
    .split(/\s*[|–—·•«»]\s*|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    const generic = /^(home|portfolio|index|welcome|главная|портфолио)$/i;
    text = generic.test(parts[0]) && parts[1] ? parts[1] : parts[0];
  }

  if (text.length > maxLen) {
    return `${text.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
  }
  return text;
}

/**
 * @param {string} html
 * @returns {string | null}
 */
export function extractTitleFromHtml(html) {
  const ogSite = html.match(
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
  );
  if (ogSite?.[1]) return decodeHtmlEntities(ogSite[1].trim());

  const appName = html.match(
    /<meta[^>]+name=["']application-name["'][^>]+content=["']([^"']+)["']/i,
  );
  if (appName?.[1]) return decodeHtmlEntities(appName[1].trim());

  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (ogTitle?.[1]) return decodeHtmlEntities(ogTitle[1].trim());

  const twitterTitle = html.match(
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (twitterTitle?.[1]) return decodeHtmlEntities(twitterTitle[1].trim());

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (title?.[1]) return decodeHtmlEntities(title[1].trim());

  return null;
}

/**
 * @param {string} tag
 * @param {string} attr
 * @returns {string | null}
 */
function getAttr(tag, attr) {
  const match = tag.match(
    new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

/**
 * @param {string} html
 * @param {string} baseUrl
 * @returns {string[]}
 */
export function extractFaviconsFromHtml(html, baseUrl) {
  /** @type {{ href: string; score: number }[]} */
  const found = [];
  const tags = html.match(/<link\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const rel = (getAttr(tag, "rel") || "").toLowerCase();
    if (!rel) continue;
    const isIcon =
      rel.includes("icon") ||
      rel.includes("apple-touch-icon") ||
      rel.includes("shortcut");
    if (!isIcon) continue;
    // Safari mask-icon — монохромный, для аватара не подходит.
    if (rel.includes("mask-icon")) continue;

    const href = getAttr(tag, "href");
    if (!href || href.startsWith("data:")) continue;

    let absolute;
    try {
      absolute = new URL(href, baseUrl).href;
    } catch {
      continue;
    }

    const type = (getAttr(tag, "type") || "").toLowerCase();
    const sizes = getAttr(tag, "sizes") || "";
    const sizeMatch = sizes.match(/(\d+)/);
    const size = sizeMatch ? Number(sizeMatch[1]) : 0;
    let score = size;
    if (rel.includes("apple-touch-icon")) score += 20;
    if (rel === "icon" || rel.includes("shortcut")) score += 10;
    if (type.includes("svg")) score += 15;
    if (type.includes("png")) score += 5;
    found.push({ href: absolute, score });
  }

  found.sort((a, b) => b.score - a.score);
  return [...new Set(found.map((item) => item.href))];
}

/**
 * Кандидаты favicon: из HTML (если доступны) → DuckDuckGo → Google → /favicon.ico.
 * `/favicon.ico` намеренно не первый: часто 404 с HTML и даёт битую картинку.
 *
 * @param {string} portfolioUrl
 * @returns {Promise<{ url: string; label: string; favicon: string; faviconFallbacks: string[] }>}
 */
export async function resolvePortfolioMeta(portfolioUrl) {
  const url = new URL(portfolioUrl);
  const fallbackLabel = labelFromHostname(url.hostname);
  /** @type {string[]} */
  const fromHtml = [];
  let label = fallbackLabel;

  try {
    const response = await fetch(portfolioUrl, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
    });
    if (response.ok) {
      const html = await response.text();
      const fromTitle = extractTitleFromHtml(html);
      if (fromTitle) {
        label = formatDisplayLabel(fromTitle) || fallbackLabel;
      }
      fromHtml.push(...extractFaviconsFromHtml(html, portfolioUrl));
    }
  } catch {
    /* CORS / сеть — остаёмся на hostname + CDN-иконки */
  }

  if (label === fallbackLabel) {
    label = formatDisplayLabel(fallbackLabel) || fallbackLabel;
  }

  const candidates = buildFaviconCandidates(portfolioUrl, fromHtml);
  const [favicon, ...faviconFallbacks] = candidates;

  return {
    url: portfolioUrl,
    label,
    favicon: favicon || googleFaviconUrl(url.hostname),
    faviconFallbacks,
  };
}
