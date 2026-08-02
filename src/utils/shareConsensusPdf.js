/**
 * Печать сводного PDF (один документ: сводка + план + советы).
 * Per-sheet остаётся в shareReviewPdf — без action cards.
 */

import { formatString, getStrings } from "../i18n.js";
import { buildConsensusReport } from "./buildConsensusReport.js";

/**
 * @param {unknown[]} sheetsOrAnswers
 * @param {{
 *   portfolioName?: string;
 *   onComplete?: () => void;
 * }} [options]
 */
export function shareConsensusPdf(sheetsOrAnswers, options = {}) {
  const t = getStrings();
  const report = buildConsensusReport(sheetsOrAnswers, t);
  if (report.aggregate.n === 0) {
    options.onComplete?.();
    return;
  }

  const portfolioName = options.portfolioName?.trim() || t.brandName;
  const title = `${t.reportConsensusDocumentTitle ?? t.reportDocumentTitle} — ${portfolioName}`;
  const html = buildConsensusDocumentHtml({
    title,
    portfolioName,
    report,
    t,
  });
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
function readReportTheme() {
  return {
    fontFamily: readCssToken("--font-family") || "Montserrat, sans-serif",
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
 * @param {{
 *   title: string;
 *   portfolioName: string;
 *   report: import("./buildConsensusReport.js").ConsensusReport;
 *   t: Record<string, string>;
 * }} params
 */
function buildConsensusDocumentHtml({ title, portfolioName, report, t }) {
  const theme = readReportTheme();
  const n = report.aggregate.n;
  const subtitle = formatString(
    t.reportConsensusSubtitle ?? "{n} из {n} · {name}",
    { n, name: portfolioName },
  );

  const summaryHtml = report.sections
    .map(
      (section) => `
      <section class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <p>${escapeHtml(section.body)}</p>
      </section>`,
    )
    .join("");

  let planHtml = "";
  if (report.actionCards.length > 0) {
    const cardsHtml = report.actionCards
      .map((card) => {
        const steps = card.steps
          .map((step) => `<li>${escapeHtml(step)}</li>`)
          .join("");
        const links = [...card.links];
        if (card.example) links.push(card.example);
        const linksHtml = links
          .map(
            (link) => `
          <li>
            <a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a>
            <span class="url">${escapeHtml(link.url)}</span>
          </li>`,
          )
          .join("");
        return `
      <article class="card">
        <p class="badge">${escapeHtml(card.categoryLabel)}</p>
        <h3>${escapeHtml(card.title)}</h3>
        <p class="problem">${escapeHtml(card.problem)}</p>
        ${steps ? `<ol class="steps">${steps}</ol>` : ""}
        ${linksHtml ? `<ul class="links">${linksHtml}</ul>` : ""}
      </article>`;
      })
      .join("");

    planHtml = `
    <section class="block">
      <h2>${escapeHtml(t.reportActionPlanTitle ?? "")}</h2>
      ${cardsHtml}
    </section>`;
  }

  let adviceHtml = "";
  if (report.adviceList.length > 0) {
    const items = report.adviceList
      .map((item) => {
        const name =
          item.reviewerName?.trim() ||
          t.reportSheetReviewerFallback ||
          "";
        return `
      <section class="section advice">
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(item.text)}</p>
      </section>`;
      })
      .join("");
    adviceHtml = `
    <section class="block">
      <h2>${escapeHtml(t.reportConsensusAdviceTitle ?? t.reportAdviceTitle ?? "")}</h2>
      ${items}
    </section>`;
  }

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
    .block { margin: 0 0 28px; }
    .section {
      margin: 0 0 16px;
      padding: 0 0 14px;
      border-bottom: 1px solid ${escapeHtml(theme.colorBorder)};
    }
    .section:last-child {
      border-bottom: 0;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
      color: ${escapeHtml(theme.colorTextStrong)};
    }
    h3 {
      margin: 0 0 6px;
      font-size: 14px;
      font-weight: 600;
      color: ${escapeHtml(theme.colorTextStrong)};
    }
    p {
      margin: 0;
      font-size: 14px;
      color: ${escapeHtml(theme.colorBody)};
    }
    .card {
      margin: 0 0 16px;
      padding: 14px 16px;
      border: 1px solid ${escapeHtml(theme.colorBorder)};
      border-radius: 12px;
      background: ${escapeHtml(theme.colorSurfaceMuted || theme.colorBg)};
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .badge {
      margin: 0 0 8px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: ${escapeHtml(theme.colorTextMuted)};
    }
    .problem { margin: 0 0 10px; }
    .steps, .links {
      margin: 0;
      padding-left: 18px;
      font-size: 13px;
      color: ${escapeHtml(theme.colorBody)};
    }
    .steps li, .links li { margin: 0 0 6px; }
    .links a {
      color: ${escapeHtml(theme.colorTextStrong)};
      text-decoration: underline;
    }
    .url {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      word-break: break-all;
      color: ${escapeHtml(theme.colorTextMuted)};
    }
    .advice h3 { margin-bottom: 4px; }
    @media print {
      .page { padding: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <main class="page">
    <p class="eyebrow">${escapeHtml(t.brandName)}</p>
    <h1>${escapeHtml(t.reportConsensusDocumentTitle ?? t.reportDocumentTitle)}</h1>
    <p class="subtitle">${escapeHtml(subtitle)}</p>
    <section class="block">
      <h2>${escapeHtml(t.reportConsensusTitle ?? "")}</h2>
      ${summaryHtml}
    </section>
    ${planHtml}
    ${adviceHtml}
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
