import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canFrameFromCsp,
  canFrameFromXfo,
  resolveFramePolicy,
} from "./framePolicy.js";

describe("canFrameFromXfo", () => {
  it("denies DENY / SAMEORIGIN", () => {
    assert.equal(canFrameFromXfo("DENY"), false);
    assert.equal(canFrameFromXfo("sameorigin"), false);
  });

  it("is null when missing", () => {
    assert.equal(canFrameFromXfo(null), null);
    assert.equal(canFrameFromXfo(""), null);
  });
});

describe("canFrameFromCsp", () => {
  it("denies frame-ancestors none / self-only", () => {
    assert.equal(
      canFrameFromCsp("frame-ancestors 'none'", "https://zaikopewpew.github.io"),
      false,
    );
    assert.equal(
      canFrameFromCsp("default-src 'self'; frame-ancestors 'self'", "https://zaikopewpew.github.io"),
      false,
    );
  });

  it("allows * and explicit embedder", () => {
    assert.equal(
      canFrameFromCsp("frame-ancestors *", "https://zaikopewpew.github.io"),
      true,
    );
    assert.equal(
      canFrameFromCsp(
        "frame-ancestors https://zaikopewpew.github.io",
        "https://zaikopewpew.github.io",
      ),
      true,
    );
  });
});

describe("resolveFramePolicy", () => {
  it("blocks Readymag-style XFO DENY", () => {
    const r = resolveFramePolicy(
      { xFrameOptions: "DENY" },
      "https://zaikopewpew.github.io",
    );
    assert.equal(r.canFrame, false);
    assert.equal(r.reason, "xfo");
  });

  it("allows missing framing headers", () => {
    const r = resolveFramePolicy({}, "https://zaikopewpew.github.io");
    assert.equal(r.canFrame, true);
  });
});
