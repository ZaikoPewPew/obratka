import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRobotsTxt, buildSitemapXml } from "./siteCrawl.js";

const ORIGIN = "https://obratka.net";

const SPA_PREFIXES = [
  "/home",
  "/referral",
  "/registration",
  "/onboarding",
  "/settings",
  "/portfolio",
  "/review",
  "/quiz",
  "/done",
  "/banned",
  "/report",
  "/404",
];

describe("siteCrawl", () => {
  it("off: Disallow /landing/ and empty sitemap urlset", () => {
    const robots = buildRobotsTxt({
      enabled: false,
      origin: ORIGIN,
      base: "/",
    });
    const sitemap = buildSitemapXml({
      enabled: false,
      origin: ORIGIN,
      base: "/",
    });

    assert.match(robots, /^Disallow: \/landing\/$/m);
    assert.doesNotMatch(robots, /^Allow: \/landing\/$/m);
    assert.doesNotMatch(robots, /^Disallow: \/$/m);
    assert.match(robots, /^Sitemap: https:\/\/obratka\.net\/sitemap\.xml$/m);

    assert.doesNotMatch(sitemap, /<loc>/);
    assert.doesNotMatch(sitemap, /<url>/);
    assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\s*<\/urlset>/);
  });

  it("on: Allow /landing/, no Disallow /landing/, sitemap loc is /landing/", () => {
    const robots = buildRobotsTxt({
      enabled: true,
      origin: ORIGIN,
      base: "/",
    });
    const sitemap = buildSitemapXml({
      enabled: true,
      origin: ORIGIN,
      base: "/",
    });

    assert.match(robots, /^Allow: \/landing\/$/m);
    assert.doesNotMatch(robots, /^Disallow: \/landing\/$/m);
    assert.doesNotMatch(robots, /^Disallow: \/$/m);
    assert.match(
      sitemap,
      /<loc>https:\/\/obratka\.net\/landing\/<\/loc>/,
    );
  });

  it("always Disallows SPA prefixes, not nested paths or root", () => {
    for (const enabled of [false, true]) {
      const robots = buildRobotsTxt({
        enabled,
        origin: ORIGIN,
        base: "/",
      });
      for (const path of SPA_PREFIXES) {
        assert.match(
          robots,
          new RegExp(`^Disallow: ${path.replaceAll("/", "\\/")}$`, "m"),
          `missing Disallow ${path} (enabled=${enabled})`,
        );
      }
      assert.doesNotMatch(robots, /^Disallow: \/registration\/code$/m);
      assert.doesNotMatch(robots, /^Disallow: \/quiz\/done$/m);
      assert.doesNotMatch(robots, /^Disallow: \/$/m);
    }
  });

  it("applies Vite base to robots, sitemap loc, and Sitemap header", () => {
    const robots = buildRobotsTxt({
      enabled: true,
      origin: ORIGIN,
      base: "/obratka/",
    });
    const sitemap = buildSitemapXml({
      enabled: true,
      origin: ORIGIN,
      base: "/obratka/",
    });

    assert.match(robots, /^Allow: \/obratka\/landing\/$/m);
    assert.match(robots, /^Disallow: \/obratka\/home$/m);
    assert.match(
      robots,
      /^Sitemap: https:\/\/obratka\.net\/obratka\/sitemap\.xml$/m,
    );
    assert.match(
      sitemap,
      /<loc>https:\/\/obratka\.net\/obratka\/landing\/<\/loc>/,
    );
  });
});
