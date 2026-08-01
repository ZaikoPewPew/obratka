import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPLAINT_WINDOW_MS,
  canComplainAboutReview,
  complaintOpenUntil,
  resolveComplaintWindowStart,
} from "./complaintWindow.js";

const HOUR = 60 * 60 * 1000;

describe("resolveComplaintWindowStart", () => {
  it("prefers portfolios.completed_at", () => {
    const start = resolveComplaintWindowStart({
      completedAt: "2026-08-01T10:00:00.000Z",
      targetReviews: 3,
      reviewCreatedAts: [
        "2026-08-01T08:00:00.000Z",
        "2026-08-01T09:00:00.000Z",
        "2026-08-01T09:30:00.000Z",
      ],
    });
    assert.equal(start, "2026-08-01T10:00:00.000Z");
  });

  it("falls back to N-th review when completed_at is missing", () => {
    const start = resolveComplaintWindowStart({
      completedAt: null,
      targetReviews: 3,
      reviewCreatedAts: [
        "2026-08-01T08:00:00.000Z",
        "2026-08-01T09:00:00.000Z",
        "2026-08-01T09:30:00.000Z",
        "2026-08-01T11:00:00.000Z",
      ],
    });
    assert.equal(start, "2026-08-01T09:30:00.000Z");
  });

  it("returns null until target reviews exist", () => {
    const start = resolveComplaintWindowStart({
      completedAt: null,
      targetReviews: 3,
      reviewCreatedAts: [
        "2026-08-01T08:00:00.000Z",
        "2026-08-01T09:00:00.000Z",
      ],
    });
    assert.equal(start, null);
  });

  it("rejects invalid completed_at", () => {
    const start = resolveComplaintWindowStart({
      completedAt: "not-a-date",
      reviewCreatedAts: [],
    });
    assert.equal(start, null);
  });
});

describe("canComplainAboutReview", () => {
  const now = Date.parse("2026-08-01T12:00:00.000Z");

  it("allows complaint inside 6h window from completed_at", () => {
    assert.equal(
      canComplainAboutReview(
        {
          completedAt: "2026-08-01T10:00:00.000Z",
          complained: false,
        },
        now,
      ),
      true,
    );
  });

  it("hides complaint after window closes", () => {
    assert.equal(
      canComplainAboutReview(
        {
          completedAt: "2026-08-01T05:00:00.000Z",
          complained: false,
        },
        now,
      ),
      false,
    );
  });

  it("restores availability via N-th review fallback", () => {
    assert.equal(
      canComplainAboutReview(
        {
          completedAt: null,
          complained: false,
          targetReviews: 3,
          reviewCreatedAts: [
            "2026-08-01T08:00:00.000Z",
            "2026-08-01T09:00:00.000Z",
            "2026-08-01T10:00:00.000Z",
          ],
        },
        now,
      ),
      true,
    );
  });

  it("stays hidden when already complained", () => {
    assert.equal(
      canComplainAboutReview(
        {
          completedAt: "2026-08-01T10:00:00.000Z",
          complained: true,
        },
        now,
      ),
      false,
    );
  });

  it("exposes open-until as completed_at + 6h", () => {
    const until = complaintOpenUntil("2026-08-01T10:00:00.000Z");
    assert.equal(
      Date.parse(until),
      Date.parse("2026-08-01T10:00:00.000Z") + COMPLAINT_WINDOW_MS,
    );
    assert.equal(COMPLAINT_WINDOW_MS, 6 * HOUR);
  });
});
