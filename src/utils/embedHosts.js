/**
 * Каталог хостов портфолио для стратегии iframe / внешней вкладки.
 * Человеческое описание: content/embed-hosts.md
 */

/**
 * @typedef {{
 *   id: string,
 *   suffix: string,
 *   label: string,
 * }} EmbedHostEntry
 */

/**
 * Хосты, которые стабильно запрещают встраивание в чужой iframe.
 * Порядок: более специфичные суффиксы раньше общих (например portfolio.adobe.com до adobe.com).
 *
 * @type {readonly EmbedHostEntry[]}
 */
export const EXTERNAL_EMBED_HOSTS = Object.freeze([
  { id: "behance", suffix: "behance.net", label: "Behance" },
  { id: "dribbble", suffix: "dribbble.com", label: "Dribbble" },
  { id: "linkedin", suffix: "linkedin.com", label: "LinkedIn" },
  { id: "instagram", suffix: "instagram.com", label: "Instagram" },
  { id: "facebook", suffix: "facebook.com", label: "Facebook" },
  { id: "fb", suffix: "fb.com", label: "Facebook" },
  { id: "twitter", suffix: "twitter.com", label: "X" },
  { id: "x", suffix: "x.com", label: "X" },
  { id: "pinterest", suffix: "pinterest.com", label: "Pinterest" },
  { id: "medium", suffix: "medium.com", label: "Medium" },
  { id: "notion-so", suffix: "notion.so", label: "Notion" },
  { id: "notion-site", suffix: "notion.site", label: "Notion" },
  { id: "google-docs", suffix: "docs.google.com", label: "Google Docs" },
  { id: "google-drive", suffix: "drive.google.com", label: "Google Drive" },
  { id: "google-sheets", suffix: "sheets.google.com", label: "Google Sheets" },
  { id: "google-slides", suffix: "slides.google.com", label: "Google Slides" },
  { id: "miro", suffix: "miro.com", label: "Miro" },
  { id: "whimsical", suffix: "whimsical.com", label: "Whimsical" },
  {
    id: "adobe-portfolio",
    suffix: "portfolio.adobe.com",
    label: "Adobe Portfolio",
  },
  { id: "adobe", suffix: "adobe.com", label: "Adobe" },
  { id: "uxfolio", suffix: "uxfol.io", label: "UXfol.io" },
  { id: "readymag", suffix: "readymag.com", label: "Readymag" },
  {
    id: "readymag-website",
    suffix: "readymag.website",
    label: "Readymag",
  },
  { id: "artstation", suffix: "artstation.com", label: "ArtStation" },
  { id: "contra", suffix: "contra.com", label: "Contra" },
  { id: "framer", suffix: "framer.com", label: "Framer" },
  { id: "framer-website", suffix: "framer.website", label: "Framer" },
  { id: "webflow", suffix: "webflow.com", label: "Webflow" },
  { id: "tilda-cc", suffix: "tilda.cc", label: "Tilda" },
  { id: "tilda-ws", suffix: "tilda.ws", label: "Tilda" },
  { id: "awwwards", suffix: "awwwards.com", label: "Awwwards" },
]);

/**
 * @param {string} hostname
 * @param {string} suffix
 * @returns {boolean}
 */
export function hostMatchesSuffix(hostname, suffix) {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  const needle = suffix.replace(/^www\./i, "").toLowerCase();
  return host === needle || host.endsWith(`.${needle}`);
}

/**
 * @param {string} hostname
 * @returns {EmbedHostEntry | null}
 */
export function findExternalEmbedHost(hostname) {
  for (const entry of EXTERNAL_EMBED_HOSTS) {
    if (hostMatchesSuffix(hostname, entry.suffix)) {
      return entry;
    }
  }
  return null;
}

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isKnownExternalOnlyHost(hostname) {
  return findExternalEmbedHost(hostname) !== null;
}
