import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findExternalEmbedHost,
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
