/**
 * Нормализация и метаданные портфолио-URL (имя, favicon).
 */

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
export function googleFaviconUrl(hostname) {
  const host = hostname.replace(/^www\./i, "");
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

/**
 * @param {string} portfolioUrl
 * @returns {string}
 */
export function portfolioFaviconUrl(portfolioUrl) {
  return googleFaviconUrl(new URL(portfolioUrl).hostname);
}

/**
 * @param {string} hostname
 * @returns {string}
 */
function labelFromHostname(hostname) {
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
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

/**
 * @param {string} html
 * @returns {string | null}
 */
function extractTitleFromHtml(html) {
  const ogSite = html.match(
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
  );
  if (ogSite?.[1]) return decodeHtmlEntities(ogSite[1].trim());

  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  );
  if (ogTitle?.[1]) return decodeHtmlEntities(ogTitle[1].trim());

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
function extractFaviconsFromHtml(html, baseUrl) {
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

    const href = getAttr(tag, "href");
    if (!href || href.startsWith("data:")) continue;

    let absolute;
    try {
      absolute = new URL(href, baseUrl).href;
    } catch {
      continue;
    }

    const sizes = getAttr(tag, "sizes") || "";
    const sizeMatch = sizes.match(/(\d+)/);
    const size = sizeMatch ? Number(sizeMatch[1]) : 0;
    let score = size;
    if (rel.includes("apple-touch-icon")) score += 20;
    if (rel === "icon" || rel.includes("shortcut")) score += 10;
    found.push({ href: absolute, score });
  }

  found.sort((a, b) => b.score - a.score);
  return [...new Set(found.map((item) => item.href))];
}

/**
 * Кандидаты favicon: из HTML (если доступны) → Google Favicon API.
 * `/favicon.ico` намеренно не первый: часто 404 с HTML и даёт битую картинку.
 *
 * @param {string} portfolioUrl
 * @returns {Promise<{ url: string; label: string; favicon: string; faviconFallbacks: string[] }>}
 */
export async function resolvePortfolioMeta(portfolioUrl) {
  const url = new URL(portfolioUrl);
  const fallbackLabel = labelFromHostname(url.hostname);
  const googleIcon = googleFaviconUrl(url.hostname);
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
        label = fromTitle.replace(/\s+/g, " ").slice(0, 80);
      }
      fromHtml.push(...extractFaviconsFromHtml(html, portfolioUrl));
    }
  } catch {
    /* CORS / сеть — остаёмся на hostname + Google icon */
  }

  const candidates = [...fromHtml, googleIcon].filter(
    (href, index, list) => list.indexOf(href) === index,
  );
  const [favicon, ...faviconFallbacks] = candidates;

  return {
    url: portfolioUrl,
    label,
    favicon: favicon || googleIcon,
    faviconFallbacks,
  };
}
