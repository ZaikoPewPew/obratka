import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findPlatformBrandIcon,
  resolvePlatformIcon,
  simpleIconsUrl,
} from "./platformBrandIcon.js";
import {
  duckDuckGoFaviconUrl,
  googleFaviconUrl,
} from "./portfolioMeta.js";

describe("simpleIconsUrl", () => {
  it("pins jsDelivr simple-icons path", () => {
    assert.equal(
      simpleIconsUrl("behance"),
      "https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/behance.svg",
    );
  });
});

describe("findPlatformBrandIcon", () => {
  it("matches Behance and Framer published hosts", () => {
    assert.equal(findPlatformBrandIcon("www.behance.net")?.slug, "behance");
    assert.equal(
      findPlatformBrandIcon("cool-case.framer.website")?.slug,
      "framer",
    );
    assert.equal(
      findPlatformBrandIcon("dsgn-thinking.framer.ai")?.slug,
      "framer",
    );
  });

  it("does not treat personal / GitHub Pages as brand logos", () => {
    assert.equal(findPlatformBrandIcon("janelle.page"), null);
    assert.equal(
      findPlatformBrandIcon("narinkalubluleshku-cmyk.github.io"),
      null,
    );
    assert.equal(findPlatformBrandIcon("dprofile.ru"), null);
  });
});

describe("resolvePlatformIcon", () => {
  it("returns Simple Icons for Behance with favicon fallbacks", () => {
    const icon = resolvePlatformIcon(
      "https://www.behance.net/gallery/123/Case",
    );
    assert.ok(icon);
    assert.equal(icon.kind, "brand");
    assert.equal(icon.src, simpleIconsUrl("behance"));
    assert.deepEqual(icon.fallbacks, [
      googleFaviconUrl("behance.net"),
      duckDuckGoFaviconUrl("behance.net"),
    ]);
  });

  it("returns Framer brand for framer.website hosts", () => {
    const icon = resolvePlatformIcon("https://cool-case.framer.website/");
    assert.ok(icon);
    assert.equal(icon.kind, "brand");
    assert.equal(icon.src, simpleIconsUrl("framer"));
  });

  it("returns site favicon for personal domains", () => {
    const icon = resolvePlatformIcon("https://janelle.page/work");
    assert.ok(icon);
    assert.equal(icon.kind, "favicon");
    assert.equal(icon.src, googleFaviconUrl("janelle.page"));
    assert.deepEqual(icon.fallbacks, [duckDuckGoFaviconUrl("janelle.page")]);
  });

  it("returns site favicon for GitHub Pages", () => {
    const icon = resolvePlatformIcon(
      "https://narinkalubluleshku-cmyk.github.io/ux-ui-2-crm-ui/",
    );
    assert.ok(icon);
    assert.equal(icon.kind, "favicon");
    assert.equal(
      icon.src,
      googleFaviconUrl("narinkalubluleshku-cmyk.github.io"),
    );
  });
});
