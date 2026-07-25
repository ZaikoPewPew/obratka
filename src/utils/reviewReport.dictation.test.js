import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildReportSections,
  parseReviewAnswers,
} from "./reviewReport.js";

const base = {
  grade: "mid",
  context: 4,
  structure: "clear",
  metrics: "solid",
  visual: 8,
  hire: "yes",
  advice: "Tighten the metrics story.",
};

describe("parseReviewAnswers dictation", () => {
  it("keeps optional dictation", () => {
    const parsed = parseReviewAnswers({
      ...base,
      dictation: "  Hierarchy is weak on the hero.  ",
    });
    assert.equal(parsed?.dictation, "Hierarchy is weak on the hero.");
  });

  it("omits empty dictation", () => {
    const parsed = parseReviewAnswers({ ...base, dictation: "   " });
    assert.equal(parsed?.dictation, undefined);
  });
});

describe("buildReportSections dictation", () => {
  it("appends notes section after advice", () => {
    const t = {
      reportGradeTitle: "g",
      reportGradeMid: "mid",
      reportContextTitle: "c",
      reportContextHigh: "ch",
      reportContextLow: "cl",
      reportStructureTitle: "s",
      reportStructureClear: "sc",
      reportMetricsTitle: "m",
      reportMetricsSolid: "ms",
      reportVisualTitle: "v",
      reportVisualHigh: "vh",
      reportVisualLow: "vl",
      reportHireTitle: "h",
      reportHireYes: "hy",
      reportAdviceTitle: "Advice",
      reportDictationTitle: "Notes",
    };
    const sections = buildReportSections(
      { ...base, dictation: "Raw voice notes here." },
      t,
    );
    const titles = sections.map((s) => s.title);
    assert.ok(titles.includes("Advice"));
    assert.ok(titles.includes("Notes"));
    assert.equal(
      titles.indexOf("Notes") > titles.indexOf("Advice"),
      true,
    );
  });
});
