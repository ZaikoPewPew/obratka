import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHomeSearch,
  isCanonicalHomeSearch,
  parseHomeView,
} from "./homeRoute.js";

describe("homeRoute", () => {
  it("defaults to feed", () => {
    assert.deepEqual(parseHomeView(""), { tab: "feed" });
    assert.deepEqual(parseHomeView(null), { tab: "feed" });
    assert.deepEqual(parseHomeView("?"), { tab: "feed" });
  });

  it("reads tab=mine", () => {
    assert.deepEqual(parseHomeView("?tab=mine"), { tab: "mine" });
  });

  it("ignores legacy filter param", () => {
    assert.deepEqual(parseHomeView("?tab=mine&filter=completed"), {
      tab: "mine",
    });
    assert.deepEqual(parseHomeView("?filter=completed"), { tab: "feed" });
    assert.deepEqual(parseHomeView("?tab=feed&filter=completed"), {
      tab: "feed",
    });
  });

  it("remaps rating to feed when RATING_TAB_ENABLED is false", () => {
    assert.deepEqual(parseHomeView("?tab=rating"), { tab: "feed" });
    assert.deepEqual(parseHomeView("?tab=rating&filter=completed"), {
      tab: "feed",
    });
  });

  it("ignores unknown tab", () => {
    assert.deepEqual(parseHomeView("?tab=junk"), { tab: "feed" });
  });

  it("accepts URLSearchParams", () => {
    const params = new URLSearchParams({ tab: "mine", filter: "completed" });
    assert.deepEqual(parseHomeView(params), { tab: "mine" });
  });

  it("buildHomeSearch omits defaults and filter", () => {
    assert.deepEqual(buildHomeSearch({ tab: "feed" }), {});
    assert.deepEqual(buildHomeSearch({ tab: "mine" }), { tab: "mine" });
    assert.deepEqual(buildHomeSearch({}), {});
  });

  it("buildHomeSearch remaps disabled rating", () => {
    assert.deepEqual(buildHomeSearch({ tab: "rating" }), {});
  });

  it("isCanonicalHomeSearch", () => {
    assert.equal(isCanonicalHomeSearch("", { tab: "feed" }), true);
    assert.equal(isCanonicalHomeSearch("?tab=mine", { tab: "mine" }), true);
    assert.equal(
      isCanonicalHomeSearch("?tab=mine&filter=completed", { tab: "mine" }),
      false,
    );
    assert.equal(isCanonicalHomeSearch("?filter=completed", { tab: "feed" }), false);
  });
});
