/**
 * Общая печать PDF-отчётов: iframe + Inter (не UI-шрифт приложения).
 */

import interCyrillic400 from "@fontsource/inter/files/inter-cyrillic-400-normal.woff2?url";
import interCyrillic500 from "@fontsource/inter/files/inter-cyrillic-500-normal.woff2?url";
import interCyrillic600 from "@fontsource/inter/files/inter-cyrillic-600-normal.woff2?url";
import interLatin400 from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import interLatin500 from "@fontsource/inter/files/inter-latin-500-normal.woff2?url";
import interLatin600 from "@fontsource/inter/files/inter-latin-600-normal.woff2?url";

const FONT_RANGE_CYRILLIC =
  "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116";
const FONT_RANGE_LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

/** PDF only — UI остаётся на Montserrat. */
export const REPORT_PDF_FONT_STACK =
  'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

const FONT_FACES = [
  [interCyrillic400, 400, FONT_RANGE_CYRILLIC],
  [interCyrillic500, 500, FONT_RANGE_CYRILLIC],
  [interCyrillic600, 600, FONT_RANGE_CYRILLIC],
  [interLatin400, 400, FONT_RANGE_LATIN],
  [interLatin500, 500, FONT_RANGE_LATIN],
  [interLatin600, 600, FONT_RANGE_LATIN],
];

/**
 * @param {string} name
 * @returns {string}
 */
function readCssToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * @param {string} href
 * @returns {string}
 */
function absAssetUrl(href) {
  return new URL(href, window.location.href).href;
}

/**
 * @returns {string}
 */
export function buildReportPdfFontCss() {
  return FONT_FACES.map(
    ([href, weight, range]) => `@font-face {
      font-family: "Inter";
      font-style: normal;
      font-display: swap;
      font-weight: ${weight};
      src: url("${absAssetUrl(href)}") format("woff2");
      unicode-range: ${range};
    }`,
  ).join("\n");
}

/**
 * @returns {{
 *   fontFamily: string;
 *   colorText: string;
 *   colorTextStrong: string;
 *   colorTextMuted: string;
 *   colorBody: string;
 *   colorBg: string;
 *   colorBorder: string;
 *   colorSurfaceMuted: string;
 * }}
 */
export function readReportTheme() {
  return {
    fontFamily: REPORT_PDF_FONT_STACK,
    colorText: readCssToken("--color-text"),
    colorTextStrong: readCssToken("--color-text-strong"),
    colorTextMuted: readCssToken("--color-text-muted"),
    colorBody: readCssToken("--color-text-subtle") || readCssToken("--color-text"),
    colorBg: readCssToken("--color-surface") || readCssToken("--color-bg"),
    colorBorder: readCssToken("--color-border"),
    colorSurfaceMuted: readCssToken("--color-surface-muted"),
  };
}

/**
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * @param {string} html
 * @param {string} title
 */
function downloadReportHtml(html, title) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = title.replace(/[^\p{L}\p{N}\-_ ]+/gu, "").trim() || "report";
  link.href = url;
  link.download = `${safeName}.html`;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/**
 * @param {Window} frameWindow
 * @returns {Promise<void>}
 */
function waitForFonts(frameWindow) {
  const fonts = frameWindow.document.fonts;
  if (!fonts?.ready) return Promise.resolve();
  return Promise.race([
    fonts.ready.catch(() => {}),
    new Promise((resolve) => {
      frameWindow.setTimeout(resolve, 2_000);
    }),
  ]);
}

/**
 * @param {string} html
 * @param {{
 *   title: string;
 *   onComplete?: () => void;
 * }} options
 */
export function printReportHtml(html, options) {
  const title = options.title;
  const onComplete =
    typeof options.onComplete === "function" ? options.onComplete : null;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", title);
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  document.body.append(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = iframe.contentDocument;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    downloadReportHtml(html, title);
    onComplete?.();
    return;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
    onComplete?.();
  };

  frameWindow.addEventListener("afterprint", cleanup);

  void waitForFonts(frameWindow).then(() => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch {
      downloadReportHtml(html, title);
      cleanup();
      return;
    }
    window.setTimeout(cleanup, 60_000);
  });
}
