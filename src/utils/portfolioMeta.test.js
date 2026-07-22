import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PORTFOLIO_DISPLAY_NAME_MAX,
  buildFaviconCandidates,
  duckDuckGoFaviconUrl,
  extractFaviconsFromHtml,
  extractTitleFromHtml,
  formatDisplayLabel,
  googleFaviconUrl,
  labelFromHostname,
  originFaviconUrl,
} from "./portfolioMeta.js";

describe("formatDisplayLabel", () => {
  it("keeps short brand names intact", () => {
    assert.equal(formatDisplayLabel("Behance"), "Behance");
    assert.equal(formatDisplayLabel("Ivan Petrov"), "Ivan Petrov");
  });

  it("prefers the primary SERP chunk before separators", () => {
    assert.equal(
      formatDisplayLabel(
        "Studio North — Product Designer Portfolio | Cases & Contact",
      ),
      "Studio North",
    );
  });

  it("skips generic first segments like Home / Portfolio", () => {
    assert.equal(
      formatDisplayLabel("Home | Lumina Design"),
      "Lumina Design",
    );
    assert.equal(
      formatDisplayLabel("Портфолио — Анна Смирнова"),
      "Анна Смирнова",
    );
  });

  it("truncates with ellipsis when still too long", () => {
    const long = "A".repeat(PORTFOLIO_DISPLAY_NAME_MAX + 10);
    const formatted = formatDisplayLabel(long);
    assert.equal(formatted.length, PORTFOLIO_DISPLAY_NAME_MAX);
    assert.ok(formatted.endsWith("…"));
  });
});

describe("extractTitleFromHtml", () => {
  it("prefers og:site_name over long document title", () => {
    const html = `
      <html><head>
        <meta property="og:site_name" content="Lumina" />
        <meta property="og:title" content="Lumina — Cases" />
        <title>Lumina — Product Design Studio | Home</title>
      </head></html>
    `;
    assert.equal(extractTitleFromHtml(html), "Lumina");
  });

  it("falls back to application-name then title", () => {
    const html = `
      <html><head>
        <meta name="application-name" content="Dropfile" />
        <title>Dropfile — Share</title>
      </head></html>
    `;
    assert.equal(extractTitleFromHtml(html), "Dropfile");
  });
});

describe("extractFaviconsFromHtml", () => {
  it("ranks apple-touch and sized icons above bare favicon", () => {
    const html = `
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
    `;
    const icons = extractFaviconsFromHtml(html, "https://example.com/page");
    assert.equal(icons[0], "https://example.com/apple-touch-icon.png");
    assert.ok(icons.includes("https://example.com/icon-32.png"));
    assert.ok(icons.includes("https://example.com/favicon.ico"));
  });

  it("skips mask-icon and data URIs", () => {
    const html = `
      <link rel="mask-icon" href="/safari.svg" color="#000" />
      <link rel="icon" href="data:image/svg+xml,%3Csvg/%3E" />
      <link rel="icon" href="/ok.png" />
    `;
    const icons = extractFaviconsFromHtml(html, "https://example.com/");
    assert.deepEqual(icons, ["https://example.com/ok.png"]);
  });
});

describe("buildFaviconCandidates", () => {
  it("chains HTML → DuckDuckGo → Google → origin favicon.ico", () => {
    const url = "https://www.studio.example/work";
    const candidates = buildFaviconCandidates(url, [
      "https://cdn.example/icon.png",
    ]);
    assert.equal(candidates[0], "https://cdn.example/icon.png");
    assert.equal(candidates[1], duckDuckGoFaviconUrl("www.studio.example"));
    assert.equal(candidates[2], googleFaviconUrl("www.studio.example"));
    assert.equal(candidates[3], originFaviconUrl(url));
  });

  it("dedupes when HTML already points at Google or origin icon", () => {
    const url = "https://studio.example/";
    const google = googleFaviconUrl("studio.example");
    const candidates = buildFaviconCandidates(url, [google]);
    assert.equal(candidates.filter((href) => href === google).length, 1);
  });
});

describe("labelFromHostname", () => {
  it("title-cases domain labels", () => {
    assert.equal(labelFromHostname("www.ivan-petrov.design"), "Ivan Petrov");
  });
});
