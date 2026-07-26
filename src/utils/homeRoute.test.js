import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHomeSearch,
  isCanonicalHomeSearch,
  parseHomeView,
} from "./homeRoute.js";

describe("parseHomeView", () => {
  it("falls back to feed/active", () => {
    assert.deepEqual(parseHomeView(""), { tab: "feed", filter: "active" });
    assert.deepEqual(parseHomeView(null), { tab: "feed", filter: "active" });
    assert.deepEqual(parseHomeView("?tab=junk"), {
      tab: "feed",
      filter: "active",
    });
  });

  it("reads known tabs", () => {
    assert.equal(parseHomeView("?tab=mine").tab, "mine");
    assert.equal(parseHomeView("?tab=rating").tab, "rating");
    assert.equal(parseHomeView("?tab=MINE").tab, "mine");
  });

  it("reads filter only on mine", () => {
    assert.deepEqual(parseHomeView("?tab=mine&filter=completed"), {
      tab: "mine",
      filter: "completed",
    });
    assert.deepEqual(parseHomeView("?tab=feed&filter=completed"), {
      tab: "feed",
      filter: "active",
    });
    assert.deepEqual(parseHomeView("?tab=rating&filter=completed"), {
      tab: "rating",
      filter: "active",
    });
  });

  it("ignores unknown filter", () => {
    assert.equal(parseHomeView("?tab=mine&filter=junk").filter, "active");
  });

  it("accepts URLSearchParams", () => {
    const params = new URLSearchParams({ tab: "mine", filter: "completed" });
    assert.deepEqual(parseHomeView(params), {
      tab: "mine",
      filter: "completed",
    });
  });
});

describe("buildHomeSearch", () => {
  it("omits defaults", () => {
    assert.deepEqual(buildHomeSearch(), {});
    assert.deepEqual(buildHomeSearch({ tab: "feed" }), {});
    assert.deepEqual(buildHomeSearch({ tab: "feed", filter: "completed" }), {});
    assert.deepEqual(buildHomeSearch({ tab: "mine", filter: "active" }), {
      tab: "mine",
    });
  });

  it("writes non-default view", () => {
    assert.deepEqual(buildHomeSearch({ tab: "mine" }), { tab: "mine" });
    assert.deepEqual(buildHomeSearch({ tab: "mine", filter: "completed" }), {
      tab: "mine",
      filter: "completed",
    });
    assert.deepEqual(buildHomeSearch({ tab: "rating" }), { tab: "rating" });
  });

  it("drops filter outside mine", () => {
    assert.deepEqual(buildHomeSearch({ tab: "rating", filter: "completed" }), {
      tab: "rating",
    });
  });
});

describe("isCanonicalHomeSearch", () => {
  it("matches canonical query", () => {
    assert.equal(isCanonicalHomeSearch("", { tab: "feed" }), true);
    assert.equal(
      isCanonicalHomeSearch("?tab=mine", { tab: "mine", filter: "active" }),
      true,
    );
    assert.equal(
      isCanonicalHomeSearch("?tab=mine&filter=completed", {
        tab: "mine",
        filter: "completed",
      }),
      true,
    );
  });

  it("rejects stale or redundant query", () => {
    assert.equal(isCanonicalHomeSearch("?tab=mine", { tab: "feed" }), false);
    assert.equal(
      isCanonicalHomeSearch("?tab=mine&filter=active", { tab: "mine" }),
      false,
    );
    assert.equal(
      isCanonicalHomeSearch("?tab=junk", { tab: "feed" }),
      false,
    );
  });
});
