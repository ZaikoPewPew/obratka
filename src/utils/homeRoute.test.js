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
    // RATING_TAB_ENABLED = false → rating remaps to feed.
    // When enabled, expect tab === "rating" again.
    assert.equal(parseHomeView("?tab=rating").tab, "feed");
    assert.equal(parseHomeView("?tab=MINE").tab, "mine");
  });

  it("reads filter on feed and mine", () => {
    assert.deepEqual(parseHomeView("?tab=mine&filter=completed"), {
      tab: "mine",
      filter: "completed",
    });
    assert.deepEqual(parseHomeView("?tab=feed&filter=completed"), {
      tab: "feed",
      filter: "completed",
    });
    assert.deepEqual(parseHomeView("?filter=completed"), {
      tab: "feed",
      filter: "completed",
    });
    // RATING_TAB_ENABLED = false → rating → feed; filter ignored on rating remap.
    assert.deepEqual(parseHomeView("?tab=rating&filter=completed"), {
      tab: "feed",
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
    assert.deepEqual(buildHomeSearch({ tab: "feed", filter: "active" }), {});
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
    assert.deepEqual(buildHomeSearch({ tab: "feed", filter: "completed" }), {
      filter: "completed",
    });
    // RATING_TAB_ENABLED = false → rating remaps to feed → omit from search.
    // When enabled, expect { tab: "rating" }.
    assert.deepEqual(buildHomeSearch({ tab: "rating" }), {});
  });

  it("drops filter outside feed/mine", () => {
    // RATING_TAB_ENABLED = false → rating → feed; filter dropped with remap.
    // When enabled, expect { tab: "rating" } (filter still dropped on rating).
    assert.deepEqual(buildHomeSearch({ tab: "rating", filter: "completed" }), {});
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
    assert.equal(
      isCanonicalHomeSearch("?filter=completed", {
        tab: "feed",
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
