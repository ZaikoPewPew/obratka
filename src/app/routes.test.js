import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hrefForRoute,
  normalizePathname,
  pathForRoute,
  routeIdFromPathname,
} from "./routes.js";

describe("routes", () => {
  it("maps ids to paths", () => {
    assert.equal(pathForRoute("referral"), "/referral");
    assert.equal(pathForRoute("auth"), "/registration");
    assert.equal(pathForRoute("url"), "/portfolio");
    assert.equal(pathForRoute("review"), "/review");
    assert.equal(pathForRoute("quiz"), "/quiz");
    assert.equal(pathForRoute("done"), "/done");
  });

  it("parses pathname with base", () => {
    assert.equal(routeIdFromPathname("/referral"), "referral");
    assert.equal(routeIdFromPathname("/registration"), "auth");
    assert.equal(routeIdFromPathname("/obratka/portfolio", "/obratka/"), "url");
    assert.equal(routeIdFromPathname("/obratka/review", "/obratka/"), "review");
    assert.equal(routeIdFromPathname("/obratka/done", "/obratka/"), "done");
    assert.equal(routeIdFromPathname("/obratka/", "/obratka/"), null);
    assert.equal(routeIdFromPathname("/unknown"), null);
  });

  it("normalizes trailing slash and base", () => {
    assert.equal(normalizePathname("/referral/"), "/referral");
    assert.equal(normalizePathname("/obratka/home/", "/obratka/"), "/home");
  });

  it("builds href with base and search", () => {
    assert.equal(hrefForRoute("referral"), "/referral");
    assert.equal(
      hrefForRoute("referral", { search: { ref: "ABC" } }),
      "/referral?ref=ABC",
    );
    assert.equal(
      hrefForRoute("auth", { baseUrl: "/obratka/" }),
      "/obratka/registration",
    );
  });
});
