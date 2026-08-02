import assert from "node:assert/strict";
import { aggregatePortfolioReviews, hasMajority } from "./aggregatePortfolioReviews.js";
import {
  pickProblemValue,
  resolveActionCards,
} from "./resolveActionCards.js";
import { buildConsensusReport } from "./buildConsensusReport.js";

/**
 * @param {Partial<import("./reviewReport.js").ReviewAnswers>} patch
 * @returns {import("./reviewReport.js").ReviewAnswers}
 */
function answers(patch = {}) {
  return {
    grade: "mid",
    context: 4,
    structure: "clear",
    metrics: "solid",
    visual: 4,
    tier: "mid",
    advice: "Advice text long enough for a sheet.",
    pain: [],
    ...patch,
  };
}

// --- majority ---
assert.equal(hasMajority(2, 3), true);
assert.equal(hasMajority(1, 3), false);
assert.equal(hasMajority(3, 4), true);
assert.equal(hasMajority(2, 4), false);
assert.equal(hasMajority(3, 5), true);
assert.equal(hasMajority(2, 5), false);

// --- aggregate all valid sheets ---
const agg = aggregatePortfolioReviews([
  answers({ grade: "junior", structure: "mess", metrics: "none", context: 1 }),
  answers({ grade: "senior", structure: "dump", metrics: "vanity", context: 2 }),
  answers({
    grade: "mid",
    structure: "mess",
    metrics: "none",
    context: 1,
    advice: "Second advice",
  }),
  { answers: answers({ grade: "lead", structure: "clear" }), reviewerName: "Ada" },
  { grade: "not-a-grade" }, // invalid — skip
]);

assert.equal(agg.n, 4);
assert.equal(agg.grade.min, "junior");
assert.equal(agg.grade.max, "lead");
assert.equal(agg.structure.counts.mess, 2);
assert.equal(agg.structure.counts.dump, 1);
assert.equal(agg.adviceList.length, 4);
assert.equal(agg.adviceList[3].reviewerName, "Ada");
assert.equal(
  agg.adviceList.every((item) => !("dictation" in item)),
  true,
);

// --- categorical majority nuance (mess vs dump) ---
assert.equal(
  pickProblemValue({ mess: 1, dump: 1, clear: 1 }, ["mess", "dump"], 3),
  "mess",
);
assert.equal(
  pickProblemValue({ mess: 2, dump: 0, clear: 1 }, ["mess", "dump"], 3),
  "mess",
);
assert.equal(
  pickProblemValue({ mess: 1, dump: 0, clear: 2 }, ["mess", "dump"], 3),
  null,
);
assert.equal(
  pickProblemValue({ none: 1, vanity: 1, solid: 1 }, ["none", "vanity"], 3),
  "none",
);

// --- resolve: order structure → metrics → context → pain; max 3 ---
const problemHeavy = aggregatePortfolioReviews([
  answers({
    structure: "mess",
    metrics: "none",
    context: 1,
    visual: 1,
    pain: ["overloaded", "contrast", "composition"],
  }),
  answers({
    structure: "dump",
    metrics: "vanity",
    context: 2,
    visual: 1,
    pain: ["overloaded", "contrast"],
  }),
  answers({
    structure: "mess",
    metrics: "none",
    context: 1,
    visual: 2,
    pain: ["overloaded", "composition"],
  }),
]);

const cards = resolveActionCards(problemHeavy);
assert.equal(cards.length, 3);
assert.deepEqual(
  cards.map((card) => card.id),
  ["structure_mess", "metrics_none", "context_low"],
);

// pain alone when higher axes clean
const painOnly = aggregatePortfolioReviews([
  answers({
    structure: "clear",
    metrics: "solid",
    context: 4,
    visual: 1,
    pain: ["overloaded"],
  }),
  answers({
    structure: "outline",
    metrics: "nominal",
    context: 5,
    visual: 2,
    pain: ["overloaded", "composition"],
  }),
  answers({
    structure: "clear",
    metrics: "strong",
    context: 4,
    visual: 1,
    pain: ["overloaded"],
  }),
]);
const painCards = resolveActionCards(painOnly);
assert.equal(painCards.length, 1);
assert.equal(painCards[0].id, "pain_overloaded");

// pain priority order when several tags pass majority
const painOrder = aggregatePortfolioReviews([
  answers({
    structure: "clear",
    metrics: "solid",
    context: 4,
    pain: ["composition", "contrast", "overloaded"],
  }),
  answers({
    structure: "clear",
    metrics: "solid",
    context: 5,
    pain: ["composition", "contrast", "overloaded"],
  }),
  answers({
    structure: "outline",
    metrics: "nominal",
    context: 4,
    pain: ["composition", "contrast", "overloaded", "components"],
  }),
]);
assert.deepEqual(
  resolveActionCards(painOrder).map((card) => card.id),
  ["pain_overloaded", "pain_contrast", "pain_composition"],
);

// no problems → empty plan
const clean = aggregatePortfolioReviews([
  answers({ structure: "clear", metrics: "strong", context: 5, pain: [] }),
  answers({ structure: "outline", metrics: "solid", context: 4, pain: [] }),
  answers({ structure: "clear", metrics: "nominal", context: 5, pain: [] }),
]);
assert.deepEqual(resolveActionCards(clean), []);

const consensus = buildConsensusReport(
  [
    {
      answers: answers({
        structure: "mess",
        metrics: "none",
        context: 1,
        advice: "Fix structure first",
      }),
      reviewerName: "Bob",
    },
    answers({ structure: "mess", metrics: "none", context: 2 }),
    answers({ structure: "dump", metrics: "vanity", context: 1 }),
  ],
  {
    reportConsensusGradeTitle: "Grade",
    reportConsensusStructureTitle: "Structure",
    reportConsensusMetricsTitle: "Metrics",
    reportConsensusContextTitle: "Context",
    reportConsensusVisualTitle: "Visual",
    reportConsensusPainTitle: "Pain",
    reportConsensusTierTitle: "Tier",
    reportConsensusGradeSame: "“{grade}” ({n} of {n})",
    reportConsensusGradeRange: "From “{from}” to “{to}” ({n} of {n})",
    reportConsensusAxisMajority: "“{label}” ({count} of {n})",
    reportConsensusScaleSame: "“{value}” ({n} of {n})",
    reportConsensusScaleRange: "From “{from}” to “{to}” ({n} of {n})",
    reportConsensusCountHeader: "({n} of {n})",
    reportConsensusPainNone: "None",
    reportConsensusVoteOne: "{count} vote “{label}”",
    reportConsensusVoteFew: "{count} votes “{label}”",
    reportConsensusVoteMany: "{count} votes “{label}”",
    reportConsensusVoteOther: "{count} votes “{label}”",
    reviewGradeJunior: "Junior",
    reviewGradeMid: "Mid",
    reviewGradeSenior: "Senior",
    reviewGradeStaff: "Staff",
    reviewGradeLead: "Lead",
    reviewGradeHead: "Head",
    reviewStructureMess: "Mess",
    reviewStructureDump: "Dump",
    reviewStructureOutline: "Outline",
    reviewStructureClear: "Clear",
    reviewMetricsNone: "None",
    reviewMetricsVanity: "Vanity",
    reviewMetricsNominal: "Nominal",
    reviewMetricsSolid: "Solid",
    reviewMetricsStrong: "Strong",
    reviewTierEarly: "Early",
    reviewTierMid: "Mid market",
    reviewTierStrong: "Strong",
    reviewTierTop: "Top",
    reviewContextValue1: "C1",
    reviewContextValue2: "C2",
    reviewContextValue3: "C3",
    reviewContextValue4: "C4",
    reviewContextValue5: "C5",
    reviewVisualValue1: "V1",
    reviewVisualValue2: "V2",
    reviewVisualValue3: "V3",
    reviewVisualValue4: "V4",
    reviewVisualValue5: "V5",
    reviewPainComposition: "Composition",
    reviewPainContrast: "Contrast",
    reviewPainComponents: "Components",
    reviewPainOverloaded: "Overloaded",
    reportActionCategoryStructure: "Structure",
    reportActionCategoryMetrics: "Metrics",
    reportActionCategoryContext: "Context",
    reportActionCategoryPain: "Interface",
    reportActionStructureMessTitle: "Mess title",
    reportActionStructureMessProblem: "Mess problem",
    reportActionStructureMessStep1: "Step 1",
    reportActionStructureMessLink1: "Link 1",
    reportActionStructureMessLink2: "Link 2",
    reportActionStructureMessExample: "Example",
    reportActionMetricsNoneTitle: "Metrics title",
    reportActionMetricsNoneProblem: "Metrics problem",
    reportActionMetricsNoneStep1: "M step 1",
    reportActionMetricsNoneLink1: "M link",
    reportActionContextLowTitle: "Context title",
    reportActionContextLowProblem: "Context problem",
    reportActionContextLowStep1: "C step 1",
    reportActionContextLowLink1: "C link",
  },
  { locale: "en" },
);

assert.equal(consensus.aggregate.n, 3);
assert.equal(consensus.actionCards.length, 3);
assert.deepEqual(
  consensus.actionCards.map((card) => card.id),
  ["structure_mess", "metrics_none", "context_low"],
);
assert.equal(consensus.actionCards[0].title, "Mess title");
assert.ok(consensus.sections.length >= 3);
const contextSection = consensus.sections.find((s) => s.title === "Context");
assert.ok(contextSection);
assert.match(
  contextSection.body,
  /From “C1” to “C2” \(3 of 3\)\n2 votes “C1”\n1 vote “C2”/,
);
assert.equal(consensus.adviceList[0].reviewerName, "Bob");
assert.equal(consensus.adviceList[0].text, "Fix structure first");

console.log("consensusActionCards: ok");
