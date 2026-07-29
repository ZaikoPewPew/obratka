import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findExternalEmbedHost,
  isLikelyFrameBlocked,
  looksLikeReadymagHtml,
  resolvePortfolioEmbed,
  toFigmaEmbedUrl,
} from "./portfolioEmbed.js";

describe("resolvePortfolioEmbed", () => {
  it("routes Behance to external with platform label", () => {
    const plan = resolvePortfolioEmbed(
      "https://www.behance.net/gallery/235874751/Alfabankru-Desktop-Website",
    );
    assert.equal(plan.mode, "external");
    assert.equal(plan.hostLabel, "Behance");
    assert.equal(plan.frameSrc, null);
  });

  it("routes Notion to external", () => {
    const plan = resolvePortfolioEmbed(
      "https://www.notion.so/Some-Portfolio-abc123",
    );
    assert.equal(plan.mode, "external");
    assert.equal(plan.hostLabel, "Notion");
  });

  it("rewrites Figma design URL to official embed", () => {
    const plan = resolvePortfolioEmbed(
      "https://www.figma.com/design/ABC123xyz/My-File?node-id=1-2",
    );
    assert.equal(plan.mode, "iframe");
    assert.equal(plan.hostLabel, "Figma");
    assert.ok(plan.frameSrc?.startsWith("https://embed.figma.com/design/"));
    assert.match(plan.frameSrc, /embed-host=obratka/);
    assert.match(plan.frameSrc, /node-id=1-2/);
  });

  it("keeps Dprofile as optimistic iframe", () => {
    const plan = resolvePortfolioEmbed("https://dprofile.ru/someone");
    assert.equal(plan.mode, "iframe");
    assert.equal(plan.frameSrc, "https://dprofile.ru/someone");
    assert.equal(plan.hostLabel, "dprofile.ru");
  });

  it("keeps custom domains as optimistic iframe", () => {
    const plan = resolvePortfolioEmbed("https://janelle.page/work");
    assert.equal(plan.mode, "iframe");
    assert.equal(plan.frameSrc, "https://janelle.page/work");
  });

  it("routes UXfol.io to external", () => {
    const plan = resolvePortfolioEmbed("https://uxfol.io/designer");
    assert.equal(plan.mode, "external");
    assert.equal(plan.hostLabel, "UXfol.io");
  });

  it("routes Framer.website published hosts to external", () => {
    const plan = resolvePortfolioEmbed("https://cool-case.framer.website/");
    assert.equal(plan.mode, "external");
    assert.equal(plan.hostLabel, "Framer");
  });

  it("keeps Framer.ai published sites as optimistic iframe", () => {
    const plan = resolvePortfolioEmbed("https://dsgn-thinking.framer.ai/");
    assert.equal(plan.mode, "iframe");
    assert.equal(plan.frameSrc, "https://dsgn-thinking.framer.ai/");
    assert.equal(findExternalEmbedHost("dsgn-thinking.framer.ai"), null);
  });

  it("routes Tilda.ws published hosts to external", () => {
    const plan = resolvePortfolioEmbed(
      "https://kmvdigital.tilda.ws/about_me",
    );
    assert.equal(plan.mode, "external");
    assert.equal(plan.hostLabel, "Tilda");
  });

  it("does not treat webflow.io published sites as external", () => {
    const plan = resolvePortfolioEmbed("https://my-site.webflow.io/");
    assert.equal(plan.mode, "iframe");
    assert.equal(findExternalEmbedHost("my-site.webflow.io"), null);
  });

  it("routes webflow.com marketing to external", () => {
    const plan = resolvePortfolioEmbed("https://webflow.com/dashboard");
    assert.equal(plan.mode, "external");
    assert.equal(plan.hostLabel, "Webflow");
  });

  it("routes Adobe Portfolio myportfolio hosts to external", () => {
    const plan = resolvePortfolioEmbed("https://name.myportfolio.com/");
    assert.equal(plan.mode, "external");
    assert.equal(plan.hostLabel, "Adobe Portfolio");
  });
  it("routes Pixpa hosts to external", () => {
    const plan = resolvePortfolioEmbed("https://studio.pixpa.com/portfolio");
    assert.equal(plan.mode, "external");
    assert.equal(plan.hostLabel, "Pixpa");
  });

  it("routes Journo Portfolio hosts to external", () => {
    const plan = resolvePortfolioEmbed("https://name.journoportfolio.com/");
    assert.equal(plan.mode, "external");
    assert.equal(plan.hostLabel, "Journo Portfolio");
  });

  it("routes Wix site hosts to external", () => {
    const plan = resolvePortfolioEmbed("https://user.wixsite.com/portfolio");
    assert.equal(plan.mode, "external");
    assert.equal(plan.hostLabel, "Wix");
  });

  it("routes report2 blocked hosts to external", () => {
    assert.equal(
      resolvePortfolioEmbed("https://name.weebly.com/").mode,
      "external",
    );
    assert.equal(
      resolvePortfolioEmbed("https://name.strikingly.com/").hostLabel,
      "Strikingly",
    );
    assert.equal(
      resolvePortfolioEmbed("https://bento.me/designer").hostLabel,
      "Bento",
    );
    assert.equal(
      resolvePortfolioEmbed("https://name.onuniverse.com/").hostLabel,
      "Universe",
    );
    assert.equal(
      resolvePortfolioEmbed("https://name.smugmug.com/").hostLabel,
      "SmugMug",
    );
    assert.equal(
      resolvePortfolioEmbed("https://sites.google.com/view/portfolio").hostLabel,
      "Google Sites",
    );
    assert.equal(
      resolvePortfolioEmbed("https://folio.vercel.app/").hostLabel,
      "Vercel",
    );
  });

  it("keeps carrd / github.io optimistic", () => {
    assert.equal(
      resolvePortfolioEmbed("https://designer.carrd.co/").mode,
      "iframe",
    );
    assert.equal(
      resolvePortfolioEmbed("https://user.github.io/folio/").mode,
      "iframe",
    );
  });

  it("keeps custom domains optimistic without hostname match", () => {
    const plan = resolvePortfolioEmbed("https://oliviagrace.work/");
    assert.equal(plan.mode, "iframe");
    assert.equal(plan.hostLabel, "oliviagrace.work");
  });
});

describe("toFigmaEmbedUrl", () => {
  it("maps legacy /file/ paths to design embeds", () => {
    const embed = toFigmaEmbedUrl("https://www.figma.com/file/KEY123/Old");
    assert.equal(
      embed,
      "https://embed.figma.com/design/KEY123/Old?embed-host=obratka",
    );
  });
});

describe("looksLikeReadymagHtml", () => {
  it("detects generator meta and Designed-with comment", () => {
    assert.equal(
      looksLikeReadymagHtml(
        `<!doctype html><!-- Designed with Readymag --><meta name="generator" content="Readymag"/>`,
      ),
      true,
    );
  });

  it("detects rmcdn assets", () => {
    assert.equal(
      looksLikeReadymagHtml(
        `<link rel="icon" href="https://c-p.rmcdn.net/abc/Favicon.png"/>`,
      ),
      true,
    );
  });

  it("ignores unrelated HTML", () => {
    assert.equal(looksLikeReadymagHtml("<html><title>Hi</title></html>"), false);
  });
});

describe("isLikelyFrameBlocked", () => {
  it("treats about:blank as blocked", () => {
    const iframe = {
      contentWindow: { location: { href: "about:blank" } },
    };
    assert.equal(isLikelyFrameBlocked(iframe), true);
  });

  it("treats about:neterror as blocked", () => {
    const iframe = {
      contentWindow: { location: { href: "about:neterror?e=nssFailure" } },
    };
    assert.equal(isLikelyFrameBlocked(iframe), true);
  });

  it("treats cross-origin SecurityError as embedded", () => {
    const iframe = {
      contentWindow: {
        get location() {
          throw new DOMException("Blocked", "SecurityError");
        },
      },
    };
    assert.equal(isLikelyFrameBlocked(iframe), false);
  });

  it("keeps same-origin github.io portfolio in iframe", () => {
    const iframe = {
      contentWindow: {
        location: {
          href: "https://zaikopewpew.github.io/NewPortfolio/",
        },
      },
    };
    assert.equal(isLikelyFrameBlocked(iframe), false);
  });
});
