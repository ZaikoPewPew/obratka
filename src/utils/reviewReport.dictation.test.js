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
  visual: 4,
  tier: "strong",
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

  it("rejects legacy hire payload", () => {
    const parsed = parseReviewAnswers({
      ...base,
      tier: undefined,
      hire: "yes",
    });
    assert.equal(parsed, null);
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
      reportVisualStrong: "vs",
      reportVisualGood: "vg",
      reportTierTitle: "tier",
      reportTierStrong: "ts",
      reportSummaryTitle: "Summary",
      reportSummaryLead: "Lead.",
      reportSummaryStrongMid0: "Strong mid verdict.",
      reportAdviceTitle: "Advice",
      reportDictationTitle: "Notes",
      reportCrossTitle: "Cross",
      reportCrossTitle2: "Cross2",
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
