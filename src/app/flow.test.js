import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAccessibleRoute, resolveEntryScreen } from "./flow.js";

describe("resolveAccessibleRoute", () => {
  it("sends authCode without gate to referral (email OTP off)", () => {
    assert.equal(
      resolveAccessibleRoute("authCode", {
        hasSession: false,
        referralDone: false,
      }),
      "referral",
    );
  });

  it("maps authCode with gate to auth when email OTP is off", () => {
    assert.equal(
      resolveAccessibleRoute("authCode", {
        hasSession: false,
        referralDone: true,
      }),
      "auth",
    );
  });

  it("sends auth without gate to referral", () => {
    assert.equal(
      resolveAccessibleRoute("auth", {
        hasSession: false,
        referralDone: false,
      }),
      "referral",
    );
  });

  it("keeps auth when the invite gate is passed", () => {
    assert.equal(
      resolveAccessibleRoute("auth", {
        hasSession: false,
        referralDone: true,
      }),
      "auth",
    );
  });

  it("does not bounce a signed-in user from authCode to referral", () => {
    assert.equal(
      resolveAccessibleRoute("authCode", {
        hasSession: true,
        referralDone: false,
        onboardingDone: true,
      }),
      "auth",
    );
  });

  it("keeps banned users on banned from any route", () => {
    assert.equal(
      resolveAccessibleRoute("authCode", { banned: true }),
      "banned",
    );
  });
});

describe("resolveEntryScreen", () => {
  it("starts at referral without session or gate", () => {
    assert.equal(resolveEntryScreen({}), "referral");
  });

  it("starts at auth when the invite gate is passed", () => {
    assert.equal(resolveEntryScreen({ referralDone: true }), "auth");
  });
});
