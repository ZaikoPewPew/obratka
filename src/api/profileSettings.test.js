import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROFILE_DISPLAY_NAME_MAX,
  PROFILE_WORKPLACE_MAX,
  normalizeDisplayName,
  normalizeProfileRole,
  normalizeProfileSettings,
  normalizeTelegramUsername,
  normalizeWorkplace,
} from "../api/profileSettings.js";

describe("normalizeDisplayName", () => {
  it("requires a non-empty name", () => {
    assert.deepEqual(normalizeDisplayName("  "), {
      ok: false,
      error: "display_name_required",
    });
  });

  it("trims and accepts a valid name", () => {
    assert.deepEqual(normalizeDisplayName("  Vlad  "), {
      ok: true,
      value: "Vlad",
    });
  });

  it("rejects overlong names", () => {
    assert.deepEqual(normalizeDisplayName("x".repeat(PROFILE_DISPLAY_NAME_MAX + 1)), {
      ok: false,
      error: "display_name_too_long",
    });
  });
});

describe("normalizeTelegramUsername", () => {
  it("allows empty as null", () => {
    assert.deepEqual(normalizeTelegramUsername(""), {
      ok: true,
      value: null,
    });
  });

  it("strips @ and validates format", () => {
    assert.deepEqual(normalizeTelegramUsername("@Cool_User"), {
      ok: true,
      value: "Cool_User",
    });
  });

  it("rejects invalid usernames", () => {
    assert.deepEqual(normalizeTelegramUsername("@ab"), {
      ok: false,
      error: "invalid_telegram_username",
    });
    assert.deepEqual(normalizeTelegramUsername("bad name"), {
      ok: false,
      error: "invalid_telegram_username",
    });
  });
});

describe("normalizeWorkplace", () => {
  it("allows empty as null", () => {
    assert.deepEqual(normalizeWorkplace("   "), {
      ok: true,
      value: null,
    });
  });

  it("rejects overlong workplace", () => {
    assert.deepEqual(normalizeWorkplace("x".repeat(PROFILE_WORKPLACE_MAX + 1)), {
      ok: false,
      error: "workplace_too_long",
    });
  });
});

describe("normalizeProfileRole", () => {
  it("accepts onboarding role values", () => {
    assert.deepEqual(normalizeProfileRole("product-designer"), {
      ok: true,
      value: "product-designer",
    });
  });

  it("rejects unknown roles", () => {
    assert.deepEqual(normalizeProfileRole("hacker"), {
      ok: false,
      error: "invalid_role",
    });
  });
});

describe("normalizeProfileSettings", () => {
  it("builds an allowlisted patch", () => {
    const result = normalizeProfileSettings({
      display_name: " Vlad ",
      telegram_username: "@design_lab",
      role: "ux-ui-designer",
      workplace: " Obratka ",
      email: "evil@example.com",
      grade: "senior",
      balance: 999,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.patch, {
      display_name: "Vlad",
      telegram_username: "design_lab",
      role: "ux-ui-designer",
      workplace: "Obratka",
    });
    assert.equal("email" in result.patch, false);
    assert.equal("grade" in result.patch, false);
    assert.equal("balance" in result.patch, false);
  });

  it("surfaces the first validation error", () => {
    assert.deepEqual(
      normalizeProfileSettings({
        display_name: "",
        role: "product-designer",
      }),
      { ok: false, error: "display_name_required" },
    );
  });
});
