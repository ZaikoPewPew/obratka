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
    return {
      mode: "external",
      openUrl: portfolioUrl,
      frameSrc: null,
      allowFullscreen: false,
      hostLabel: external.label,
    };
  }

  return {
    mode: "iframe",
    openUrl: portfolioUrl,
    frameSrc: portfolioUrl,
    allowFullscreen: false,
    hostLabel: hostnameLabel,
  };
}
