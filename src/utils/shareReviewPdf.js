import { formatString, getStrings } from "../i18n.js";
import { buildReportSections } from "./reviewReport.js";

/**
 * @typedef {{
 *   answers: import("./reviewReport.js").ReviewAnswers;
 *   reviewerName?: string;
 *   sheetLabel?: string;
 * }} ReviewPdfPage
 */

/**
 * Печать отчёта через скрытый iframe (без window.open — не блокируется).
 * В диалоге печати: «Сохранить как PDF».
 * Один ревьюер → одна страница (`page-break-after`).
 *
 * @param {import("./reviewReport.js").ReviewAnswers | ReviewPdfPage[]} answersOrPages
 * @param {{
 *   portfolioName?: string;
 *   onComplete?: () => void;
 * }} [options]
 */
export function shareReviewPdf(answersOrPages, options = {}) {
  const t = getStrings();
  const pages = normalizePdfPages(answersOrPages, t);
  if (pages.length === 0) {
    options.onComplete?.();
    return;
  }

  const portfolioName = options.portfolioName?.trim() || t.brandName;
  const title = `${t.reportDocumentTitle} — ${portfolioName}`;
  const html = buildReportDocumentHtml({ title, portfolioName, pages, t });
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
  window.setTimeout(() => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch {
      downloadReportHtml(html, title);
      cleanup();
      return;
    }
    window.setTimeout(cleanup, 60_000);
  }, 50);
}

/**
 * @param {import("./reviewReport.js").ReviewAnswers | ReviewPdfPage[]} answersOrPages
 * @param {Record<string, string>} t
 * @returns {ReviewPdfPage[]}
 */
function normalizePdfPages(answersOrPages, t) {
  if (Array.isArray(answersOrPages)) {
    return answersOrPages.filter(
      (page) => page && page.answers && typeof page.answers === "object",
    );
  }
  if (answersOrPages && typeof answersOrPages === "object") {
    return [
      {
        answers: answersOrPages,
        sheetLabel: formatString(t.reportSheetLabel, { n: 1 }),
      },
    ];
  }
  return [];
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
 * @param {string} name
 * @returns {string}
 */
function readCssToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * PDF iframe не видит app CSS — подставляем уже вычисленные значения токенов.
 * @returns {{
 *   fontFamily: string;
 *   colorText: string;
 *   colorTextStrong: string;
 *   colorTextMuted: string;
 *   colorBody: string;
 *   colorBg: string;
 *   colorBorder: string;
 * }}
 */
function readReportTheme() {
  return {
    fontFamily: readCssToken("--font-family") || "Montserrat, sans-serif",
    colorText: readCssToken("--color-text"),
    colorTextStrong: readCssToken("--color-text-strong"),
    colorTextMuted: readCssToken("--color-text-muted"),
    colorBody: readCssToken("--color-text-subtle") || readCssToken("--color-text"),
    colorBg: readCssToken("--color-surface") || readCssToken("--color-bg"),
    colorBorder: readCssToken("--color-border"),
  };
}

/**
 * @param {{
 *   title: string;
 *   portfolioName: string;
 *   pages: ReviewPdfPage[];
 *   t: Record<string, string>;
 * }} params
 */
function buildReportDocumentHtml({ title, portfolioName, pages, t }) {
  const theme = readReportTheme();
  const pagesHtml = pages
    .map((page, index) => {
      const sections = buildReportSections(page.answers, t);
      const sectionHtml = sections
        .map(
          (section) => `
      <section class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <p>${escapeHtml(section.body)}</p>
      </section>`,
        )
        .join("");
      const sheetLabel =
        page.sheetLabel?.trim() ||
        formatString(t.reportSheetLabel, { n: index + 1 });
      const reviewer =
        page.reviewerName?.trim() || t.reportSheetReviewerFallback || "";
      const subtitle = [sheetLabel, reviewer, portfolioName]
        .filter(Boolean)
        .join(" · ");

      return `
  <main class="page${index < pages.length - 1 ? " page--break" : ""}">
    <p class="eyebrow">${escapeHtml(t.brandName)}</p>
    <h1>${escapeHtml(t.reportDocumentTitle)}</h1>
    <p class="subtitle">${escapeHtml(subtitle)}</p>
    ${sectionHtml}
  </main>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(document.documentElement.lang || "ru")}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ${escapeHtml(theme.fontFamily)};
      color: ${escapeHtml(theme.colorText)};
      background: ${escapeHtml(theme.colorBg)};
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 20px 40px;
    }
    .page--break {
      page-break-after: always;
      break-after: page;
    }
    .eyebrow {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: ${escapeHtml(theme.colorTextMuted)};
    }
    h1 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 600;
      line-height: 1.25;
      color: ${escapeHtml(theme.colorTextStrong)};
    }
    .subtitle {
      margin: 0 0 28px;
      font-size: 14px;
      color: ${escapeHtml(theme.colorTextMuted)};
    }
    .section {
      margin: 0 0 20px;
      padding: 0 0 16px;
      border-bottom: 1px solid ${escapeHtml(theme.colorBorder)};
    }
    .section:last-child {
      border-bottom: 0;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.3;
      color: ${escapeHtml(theme.colorTextStrong)};
    }
    p {
      margin: 0;
      font-size: 14px;
      color: ${escapeHtml(theme.colorBody)};
    }
    @media print {
      .page { padding: 0; max-width: none; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
