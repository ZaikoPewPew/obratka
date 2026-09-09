/**
 * Печать сводного PDF (один документ: сводка + план + советы).
 * Per-sheet остаётся в shareReviewPdf — без action cards.
 */

import { formatString, getLocale, getStrings } from "../i18n.js";
import { buildConsensusReport } from "./buildConsensusReport.js";
import {
  buildReportPdfFontCss,
  escapeHtml,
  printReportHtml,
  readReportTheme,
} from "./printReport.js";

/**
 * @param {unknown[]} sheetsOrAnswers
 * @param {{
 *   portfolioName?: string;
 *   sheetLimit?: number;
 *   onComplete?: () => void;
 * }} [options]
 */
export function shareConsensusPdf(sheetsOrAnswers, options = {}) {
  const t = getStrings();
  const report = buildConsensusReport(sheetsOrAnswers, t, {
    locale: getLocale(),
    sheetLimit: options.sheetLimit,
  });
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
  printReportHtml(html, {
    title,
    onComplete: options.onComplete,
  });
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

  let verdictHtml = "";
  if (report.verdict?.body) {
    const bodyHtml = String(report.verdict.body)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("");
    verdictHtml = `
    <section class="chapter">
      <h2>${escapeHtml(report.verdict.title || t.reportConsensusVerdictTitle || "")}</h2>
      <div class="section-body">${bodyHtml}</div>
    </section>`;
  }

  let strengthsHtml = "";
  if (report.strengths.length > 0) {
    const items = report.strengths
      .map((item) => `<li>${escapeHtml(item.label)}</li>`)
      .join("");
    strengthsHtml = `
    <section class="chapter">
      <h2>${escapeHtml(t.reportConsensusStrengthsTitle ?? "")}</h2>
      <ul class="strengths">${items}</ul>
    </section>`;
  }

  const summaryHtml = report.sections
    .map((section) => {
      const bodyHtml = String(section.body || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join("");
      return `
      <section class="axis">
        <h3>${escapeHtml(section.title)}</h3>
        <div class="section-body">${bodyHtml}</div>
      </section>`;
    })
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
        <p class="confirm">${escapeHtml(card.confirmations || "")}</p>
        <h3>${escapeHtml(card.title)}</h3>
        <p class="problem">${escapeHtml(card.problem)}</p>
        ${steps ? `<ol class="steps">${steps}</ol>` : ""}
        ${linksHtml ? `<ul class="links">${linksHtml}</ul>` : ""}
      </article>`;
      })
      .join("");

    planHtml = `
    <section class="chapter">
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
      <section class="axis advice">
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(item.text)}</p>
      </section>`;
      })
      .join("");
    adviceHtml = `
    <section class="chapter">
      <h2>${escapeHtml(t.reportConsensusAdviceTitle ?? t.reportAdviceTitle ?? "")}</h2>
      ${items}
    </section>`;
  }

  let dictationHtml = "";
  if (report.dictationList.length > 0) {
    const items = report.dictationList
      .map((item) => {
        const name =
          item.reviewerName?.trim() ||
          t.reportSheetReviewerFallback ||
          "";
        return `
      <section class="axis advice">
        <h3>${escapeHtml(name)}</h3>
        <p class="opinion">${escapeHtml(t.reportConsensusOpinionLabel ?? "")}</p>
        <p>${escapeHtml(item.text)}</p>
        <p class="hint">${escapeHtml(t.reportConsensusOpinionHint ?? "")}</p>
      </section>`;
      })
      .join("");
    dictationHtml = `
    <section class="chapter">
      <h2>${escapeHtml(t.reportConsensusDictationTitle ?? t.reportDictationTitle ?? "")}</h2>
      ${items}
    </section>`;
  }

  const summaryBlock = summaryHtml
    ? `
    <section class="chapter">
      <h2>${escapeHtml(t.reportConsensusTitle ?? "")}</h2>
      ${summaryHtml}
    </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(document.documentElement.lang || "ru")}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${buildReportPdfFontCss()}
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ${escapeHtml(theme.fontFamily)};
      font-synthesis: none;
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
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${escapeHtml(theme.colorTextMuted)};
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.03em;
      line-height: 1.2;
      color: ${escapeHtml(theme.colorTextStrong)};
    }
    .subtitle {
      margin: 0 0 32px;
      font-size: 14px;
      color: ${escapeHtml(theme.colorTextMuted)};
    }
    .chapter { margin: 0 0 32px; }
    .chapter > h2 {
      margin: 0 0 16px;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1.3;
      color: ${escapeHtml(theme.colorTextStrong)};
    }
    .axis {
      margin: 0 0 16px;
      padding: 0 0 14px;
      border-bottom: 1px solid ${escapeHtml(theme.colorBorder)};
    }
    .axis:last-child {
      border-bottom: 0;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .axis h3 {
      margin: 0 0 6px;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.3;
      color: ${escapeHtml(theme.colorTextStrong)};
    }
    .card h3 {
      margin: 0 0 6px;
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
    .section-body p + p {
      margin-top: 4px;
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
    .confirm {
      margin: 0 0 8px;
      font-size: 12px;
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
    .opinion {
      margin: 0 0 4px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: ${escapeHtml(theme.colorTextMuted)};
    }
    .hint {
      margin-top: 6px;
      font-size: 12px;
      color: ${escapeHtml(theme.colorTextMuted)};
    }
    .strengths {
      margin: 0;
      padding-left: 18px;
      font-size: 14px;
      color: ${escapeHtml(theme.colorBody)};
    }
    .strengths li { margin: 0 0 6px; }
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
    ${verdictHtml}
    ${strengthsHtml}
    ${summaryBlock}
    ${planHtml}
    ${adviceHtml}
    ${dictationHtml}
  </main>
</body>
</html>`;
}
