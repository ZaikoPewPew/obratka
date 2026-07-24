import { getStrings } from "../i18n.js";
import { buildReportSections } from "./reviewReport.js";

/**
 * Печать отчёта через скрытый iframe (без window.open — не блокируется).
 * В диалоге печати: «Сохранить как PDF».
 *
 * @param {import("./reviewReport.js").ReviewAnswers} answers
 * @param {{ portfolioName?: string }} [options]
 */
export function shareReviewPdf(answers, options = {}) {
  const t = getStrings();
  const sections = buildReportSections(answers, t);
  const portfolioName = options.portfolioName?.trim() || t.brandName;
  const title = `${t.reportDocumentTitle} — ${portfolioName}`;
  const html = buildReportDocumentHtml({ title, portfolioName, sections, t });

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
  };

  frameWindow.addEventListener("afterprint", cleanup);
  window.setTimeout(() => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch {
      downloadReportHtml(html, title);
    }
    window.setTimeout(cleanup, 60_000);
  }, 50);
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
 *   sections: import("./reviewReport.js").ReportSection[];
 *   t: Record<string, string>;
 * }} params
 */
function buildReportDocumentHtml({ title, portfolioName, sections, t }) {
  const theme = readReportTheme();
  const sectionHtml = sections
    .map(
      (section) => `
      <section class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <p>${escapeHtml(section.body)}</p>
      </section>`,
    )
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
  <main class="page">
    <p class="eyebrow">${escapeHtml(t.brandName)}</p>
    <h1>${escapeHtml(t.reportDocumentTitle)}</h1>
    <p class="subtitle">${escapeHtml(portfolioName)}</p>
    ${sectionHtml}
  </main>
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
