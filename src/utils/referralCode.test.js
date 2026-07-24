import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReferralShareUrl,
  normalizeReferralCode,
  REFERRAL_MAX_USES,
} from "../utils/referralCode.js";

describe("normalizeReferralCode", () => {
  it("trims and uppercases", () => {
    assert.equal(normalizeReferralCode("  ab12cd  "), "AB12CD");
  });

  it("extracts ?ref= from absolute URL", () => {
    assert.equal(
      normalizeReferralCode("https://example.com/obratka/referral?ref=YTHWKPDWAK"),
      "YTHWKPDWAK",
    );
  });

  it("extracts ref from query-ish string", () => {
    assert.equal(normalizeReferralCode("/referral?ref=hello123"), "HELLO123");
  });

  it("returns null for empty", () => {
    assert.equal(normalizeReferralCode("   "), null);
  });
});

describe("referral constants", () => {
  it("caps user invites at 2", () => {
    assert.equal(REFERRAL_MAX_USES, 2);
  });
});

describe("buildReferralShareUrl", () => {
  it("builds path with ref", () => {
    const href = buildReferralShareUrl("AbC");
    assert.match(href, /ref=ABC/);
    assert.match(href, /referral/);
  });
});
