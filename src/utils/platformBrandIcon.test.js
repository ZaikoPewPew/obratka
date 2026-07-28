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

  it("matches new portfolio builders and published hosts", () => {
    assert.equal(
      findPlatformBrandIcon("name.myportfolio.com")?.label,
      "Adobe Portfolio",
    );
    assert.equal(
      findPlatformBrandIcon("portfolio.adobe.com")?.label,
      "Adobe Portfolio",
    );
    assert.equal(
      findPlatformBrandIcon("studio.squarespace.com")?.slug,
      "squarespace",
    );
    assert.equal(findPlatformBrandIcon("user.wixsite.com")?.slug, "wix");
    assert.equal(findPlatformBrandIcon("www.wix.com")?.slug, "wix");
    assert.equal(
      findPlatformBrandIcon("site.elementor.cloud")?.slug,
      "elementor",
    );
    assert.equal(findPlatformBrandIcon("www.pixpa.com")?.label, "Pixpa");
    assert.equal(findPlatformBrandIcon("studio.cargo.site")?.label, "Cargo");
    assert.equal(
      findPlatformBrandIcon("user.cargocollective.com")?.label,
      "Cargo",
    );
    assert.equal(findPlatformBrandIcon("my-site.webflow.io")?.slug, "webflow");
    assert.equal(
      findPlatformBrandIcon("name-portfolio.my.canva.site")?.slug,
      "canva",
    );
    assert.equal(findPlatformBrandIcon("www.canva.com")?.slug, "canva");
    assert.equal(
      findPlatformBrandIcon("name.carbonmade.com")?.label,
      "Carbonmade",
    );
    assert.equal(findPlatformBrandIcon("name.format.com")?.label, "Format");
    assert.equal(
      findPlatformBrandIcon("name.journoportfolio.com")?.label,
      "Journo Portfolio",
    );
    assert.equal(findPlatformBrandIcon("contra.com")?.label, "Contra");
    assert.equal(findPlatformBrandIcon("read.cv")?.label, "Read.cv");
  });

  it("does not treat personal / GitHub Pages as brand logos", () => {
    assert.equal(findPlatformBrandIcon("janelle.page"), null);
    assert.equal(
      findPlatformBrandIcon("narinkalubluleshku-cmyk.github.io"),
      null,
    );
    assert.equal(findPlatformBrandIcon("dprofile.ru"), null);
  });

  it("matches Designfolio favicon brand (no Simple Icons slug)", () => {
    const brand = findPlatformBrandIcon("www.designfolio.me");
    assert.ok(brand);
    assert.equal(brand.suffix, "designfolio.me");
    assert.equal(brand.slug, undefined);
    assert.equal(brand.label, "Designfolio");
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
    assert.equal(icon.label, "Behance");
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

  it("returns Webflow brand for published webflow.io hosts", () => {
    const icon = resolvePlatformIcon("https://my-site.webflow.io/");
    assert.ok(icon);
    assert.equal(icon.kind, "brand");
    assert.equal(icon.src, simpleIconsUrl("webflow"));
    assert.equal(icon.label, "Webflow");
    assert.deepEqual(icon.fallbacks, [
      googleFaviconUrl("webflow.com"),
      duckDuckGoFaviconUrl("webflow.com"),
    ]);
  });

  it("returns Wix brand for wixsite hosts via wix faviconHost", () => {
    const icon = resolvePlatformIcon("https://user.wixsite.com/portfolio");
    assert.ok(icon);
    assert.equal(icon.kind, "brand");
    assert.equal(icon.src, simpleIconsUrl("wix"));
    assert.equal(icon.label, "Wix");
    assert.deepEqual(icon.fallbacks, [
      googleFaviconUrl("wix.com"),
      duckDuckGoFaviconUrl("wix.com"),
    ]);
  });

  it("returns Adobe Portfolio favicon brand for myportfolio hosts", () => {
    const icon = resolvePlatformIcon("https://name.myportfolio.com/");
    assert.ok(icon);
    assert.equal(icon.kind, "brand");
    assert.equal(icon.src, googleFaviconUrl("myportfolio.com"));
    assert.equal(icon.label, "Adobe Portfolio");
    assert.deepEqual(icon.fallbacks, [
      duckDuckGoFaviconUrl("myportfolio.com"),
      "https://myportfolio.com/favicon.ico",
    ]);
  });

  it("returns Designfolio favicon brand without Simple Icons", () => {
    const icon = resolvePlatformIcon("https://www.designfolio.me/u/demo");
    assert.ok(icon);
    assert.equal(icon.kind, "brand");
    assert.equal(icon.src, googleFaviconUrl("designfolio.me"));
    assert.deepEqual(icon.fallbacks, [
      duckDuckGoFaviconUrl("designfolio.me"),
      "https://designfolio.me/favicon.ico",
    ]);
  });

  it("returns web letter mark for personal domains", () => {
    const icon = resolvePlatformIcon("https://janelle.page/work");
    assert.ok(icon);
    assert.equal(icon.kind, "web");
    assert.equal(icon.label, null);
  });

  it("returns web letter mark for GitHub Pages", () => {
    const icon = resolvePlatformIcon(
      "https://narinkalubluleshku-cmyk.github.io/ux-ui-2-crm-ui/",
    );
    assert.ok(icon);
    assert.equal(icon.kind, "web");
  });
});
