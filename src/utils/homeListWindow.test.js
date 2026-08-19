import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emptySlotWindowKey,
  listWindowPadding,
  LIST_WINDOW_FALLBACK_VISIBLE,
  LIST_WINDOW_OVERSCAN,
  rangeForScroll,
} from "./homeListWindow.js";

describe("emptySlotWindowKey", () => {
  it("prefixes index", () => {
    assert.equal(emptySlotWindowKey(0), "__empty:0");
    assert.equal(emptySlotWindowKey(2), "__empty:2");
  });
});

describe("rangeForScroll", () => {
  it("returns empty range for empty list", () => {
    assert.deepEqual(rangeForScroll(0, 800, 0, 400), { start: 0, end: 0 });
  });

  it("falls back to a short window when stride is unknown", () => {
    const end = LIST_WINDOW_FALLBACK_VISIBLE + LIST_WINDOW_OVERSCAN * 2;
    assert.deepEqual(rangeForScroll(0, 800, 50, 0), { start: 0, end });
    assert.deepEqual(rangeForScroll(0, 800, 3, 0), { start: 0, end: 3 });
  });

  it("pins to the top with overscan below", () => {
    const stride = 400;
    const viewH = 800;
    const visible = Math.ceil(viewH / stride);
    assert.deepEqual(rangeForScroll(0, viewH, 100, stride), {
      start: 0,
      end: visible + LIST_WINDOW_OVERSCAN,
    });
  });

  it("shifts with scroll and keeps overscan on both sides", () => {
    const stride = 400;
    const viewH = 800;
    const visible = Math.ceil(viewH / stride);
    const firstVisible = 10;
    assert.deepEqual(
      rangeForScroll(firstVisible * stride, viewH, 100, stride),
      {
        start: firstVisible - LIST_WINDOW_OVERSCAN,
        end: firstVisible + visible + LIST_WINDOW_OVERSCAN,
      },
    );
  });

  it("clamps to the last items", () => {
    const stride = 400;
    const viewH = 800;
    const count = 20;
    const firstVisible = 18;
    assert.deepEqual(
      rangeForScroll(firstVisible * stride, viewH, count, stride),
      {
        start: firstVisible - LIST_WINDOW_OVERSCAN,
        end: count,
      },
    );
  });
});

describe("listWindowPadding", () => {
  it("is zero when the window covers the list", () => {
    assert.deepEqual(listWindowPadding(0, 6, 6, 400), {
      paddingTop: 0,
      paddingBottom: 0,
    });
  });

  it("uses stride times unmounted rows", () => {
    assert.deepEqual(listWindowPadding(6, 16, 100, 400), {
      paddingTop: 6 * 400,
      paddingBottom: 84 * 400,
    });
  });

  it("is zero without stride or items", () => {
    assert.deepEqual(listWindowPadding(0, 10, 0, 400), {
      paddingTop: 0,
      paddingBottom: 0,
    });
    assert.deepEqual(listWindowPadding(0, 10, 50, 0), {
      paddingTop: 0,
      paddingBottom: 0,
    });
  });
});
