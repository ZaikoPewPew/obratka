/**
 * Сводный отчёт: тексты агрегатов осей + модель action cards через i18n.
 * L2/L3 per-reviewer сюда не копируем.
 */

import {
  GRADE_ORDER,
  aggregatePortfolioReviews,
} from "./aggregatePortfolioReviews.js";
import { resolveActionCards } from "./resolveActionCards.js";
import { PAIN_PRIORITY } from "./reviewReport.js";

/**
 * Локальная копия formatString — без импорта i18n (Node unit-тесты не тянут locales.json).
 * @param {string} template
 * @param {Record<string, unknown>} [vars]
 * @returns {string}
 */
function formatString(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] == null ? "" : String(vars[key]),
  );
}

/**
 * @typedef {{ title: string; body: string }} ConsensusSection
 *
 * @typedef {{
 *   label: string;
 *   url: string;
 *   type?: string;
 * }} ConsensusCardLink
 *
 * @typedef {{
 *   id: string;
 *   category: string;
 *   categoryLabel: string;
 *   title: string;
 *   problem: string;
 *   steps: string[];
 *   links: ConsensusCardLink[];
 *   example: ConsensusCardLink | null;
 * }} ConsensusActionCard
 *
 * @typedef {{
 *   aggregate: import("./aggregatePortfolioReviews.js").PortfolioReviewAggregate;
 *   sections: ConsensusSection[];
 *   actionCards: ConsensusActionCard[];
 *   adviceList: { reviewerName: string; text: string }[];
 * }} ConsensusReport
 */

/**
 * @param {unknown[]} sheetsOrAnswers
 * @param {Record<string, string>} t
 * @returns {ConsensusReport}
 */
export function buildConsensusReport(sheetsOrAnswers, t) {
  const aggregate = aggregatePortfolioReviews(sheetsOrAnswers);
  const rawCards = resolveActionCards(aggregate);
  const sections = buildConsensusSections(aggregate, t);
  const actionCards = rawCards
    .map((card) => localizeActionCard(card, t))
    .filter(Boolean);

  return {
    aggregate,
    sections,
    actionCards: /** @type {ConsensusActionCard[]} */ (actionCards),
    adviceList: aggregate.adviceList.slice(),
  };
}

/**
 * @param {import("./aggregatePortfolioReviews.js").PortfolioReviewAggregate} aggregate
 * @param {Record<string, string>} t
 * @returns {ConsensusSection[]}
 */
export function buildConsensusSections(aggregate, t) {
  if (!aggregate || aggregate.n <= 0) return [];

  /** @type {ConsensusSection[]} */
  const sections = [];
  const n = aggregate.n;

  const gradeBody = formatGradeLine(aggregate, t);
  if (gradeBody) {
    sections.push({
      title: t.reportConsensusGradeTitle ?? t.reportGradeTitle ?? "",
      body: gradeBody,
    });
  }

  const structureBody = formatCategoricalLine(
    aggregate.structure.counts,
    n,
    t,
    "structure",
    (value) => labelForStructure(value, t),
  );
  if (structureBody) {
    sections.push({
      title: t.reportConsensusStructureTitle ?? t.reportStructureTitle ?? "",
      body: structureBody,
    });
  }

  const metricsBody = formatCategoricalLine(
    aggregate.metrics.counts,
    n,
    t,
    "metrics",
    (value) => labelForMetrics(value, t),
  );
  if (metricsBody) {
    sections.push({
      title: t.reportConsensusMetricsTitle ?? t.reportMetricsTitle ?? "",
      body: metricsBody,
    });
  }

  const contextBody = formatScaleLine(aggregate.context, n, t, "context");
  if (contextBody) {
    sections.push({
      title: t.reportConsensusContextTitle ?? t.reportContextTitle ?? "",
      body: contextBody,
    });
  }

  const visualBody = formatScaleLine(aggregate.visual, n, t, "visual");
  if (visualBody) {
    sections.push({
      title: t.reportConsensusVisualTitle ?? t.reportVisualTitle ?? "",
      body: visualBody,
    });
  }

  const painBody = formatPainLine(aggregate.pain.counts, n, t);
  if (painBody) {
    sections.push({
      title: t.reportConsensusPainTitle ?? t.reportPainTitle ?? "",
      body: painBody,
    });
  }

  const tierBody = formatCategoricalLine(
    aggregate.tier.counts,
    n,
    t,
    "tier",
    (value) => labelForTier(value, t),
  );
  if (tierBody) {
    sections.push({
      title: t.reportConsensusTierTitle ?? t.reportTierTitle ?? "",
      body: tierBody,
    });
  }

  return sections;
}

/**
 * @param {import("./resolveActionCards.js").ActionCardRecord} card
 * @param {Record<string, string>} t
 * @returns {ConsensusActionCard | null}
 */
export function localizeActionCard(card, t) {
  if (!card?.id) return null;
  const prefix = `reportAction${idToPascal(card.id)}`;
  const title = t[`${prefix}Title`] ?? "";
  const problem = t[`${prefix}Problem`] ?? "";
  if (!title && !problem) return null;

  /** @type {string[]} */
  const steps = [];
  for (let i = 1; i <= 6; i += 1) {
    const step = t[`${prefix}Step${i}`];
    if (!step) break;
    steps.push(step);
  }

  const links = (card.links || []).map((link, index) => ({
    label: t[`${prefix}Link${index + 1}`] ?? link.url,
    url: link.url,
    type: link.type,
  }));

  /** @type {ConsensusCardLink | null} */
  let example = null;
  if (card.example?.url) {
    example = {
      label: t[`${prefix}Example`] ?? card.example.url,
      url: card.example.url,
    };
  }

  return {
    id: card.id,
    category: card.category,
    categoryLabel: categoryLabel(card.category, t),
    title,
    problem,
    steps,
    links,
    example,
  };
}

/**
 * @param {string} id
 * @returns {string}
 */
function idToPascal(id) {
  return String(id)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * @param {string} category
 * @param {Record<string, string>} t
 * @returns {string}
 */
function categoryLabel(category, t) {
  const key = `reportActionCategory${category.charAt(0).toUpperCase()}${category.slice(1)}`;
  return t[key] ?? category;
}

/**
 * @param {import("./aggregatePortfolioReviews.js").PortfolioReviewAggregate} aggregate
 * @param {Record<string, string>} t
 * @returns {string}
 */
function formatGradeLine(aggregate, t) {
  const n = aggregate.n;
  const { min, max, counts } = aggregate.grade;
  const breakdown = formatBreakdown(counts, n, t, (value) =>
    labelForGrade(value, t),
  );
  if (!min || !max) {
    return formatString(t.reportConsensusOfN ?? "{breakdown} ({n} из {n})", {
      breakdown,
      n,
    });
  }
  if (min === max) {
    return formatString(
      t.reportConsensusGradeSame ?? "{grade} ({n} из {n}). {breakdown}",
      {
        grade: labelForGrade(min, t),
        n,
        breakdown,
      },
    );
  }
  return formatString(
    t.reportConsensusGradeRange ??
      "от {from} до {to} ({n} из {n}). {breakdown}",
    {
      from: labelForGrade(min, t),
      to: labelForGrade(max, t),
      n,
      breakdown,
    },
  );
}

/**
 * @param {Record<string, number>} counts
 * @param {number} n
 * @param {Record<string, string>} t
 * @param {string} _axis
 * @param {(value: string) => string} labelFn
 * @returns {string}
 */
function formatCategoricalLine(counts, n, t, _axis, labelFn) {
  const entries = Object.entries(counts || {}).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  if (entries.length === 0) return "";

  const [topValue, topCount] = entries[0];
  const breakdown = formatBreakdown(counts, n, t, labelFn);

  if (entries.length === 1 || topCount > n / 2) {
    return formatString(
      t.reportConsensusAxisMajority ?? "{label} ({count} из {n}). {breakdown}",
      {
        label: labelFn(topValue),
        count: topCount,
        n,
        breakdown,
      },
    );
  }

  return formatString(
    t.reportConsensusAxisSplit ?? "{breakdown} ({n} из {n}).",
    {
      breakdown,
      n,
    },
  );
}

/**
 * @param {{ counts: Record<string, number>; min: number | null; max: number | null }} scale
 * @param {number} n
 * @param {Record<string, string>} t
 * @param {"context" | "visual"} axis
 * @returns {string}
 */
function formatScaleLine(scale, n, t, axis) {
  const { min, max, counts } = scale;
  if (min == null || max == null) return "";
  const breakdown = formatBreakdown(counts, n, t, (value) =>
    labelForScale(axis, value, t),
  );
  if (min === max) {
    return formatString(
      t.reportConsensusScaleSame ?? "{value} ({n} из {n}). {breakdown}",
      {
        value: labelForScale(axis, String(min), t),
        n,
        breakdown,
      },
    );
  }
  return formatString(
    t.reportConsensusScaleRange ??
      "от {from} до {to} ({n} из {n}). {breakdown}",
    {
      from: labelForScale(axis, String(min), t),
      to: labelForScale(axis, String(max), t),
      n,
      breakdown,
    },
  );
}

/**
 * @param {Record<string, number>} counts
 * @param {number} n
 * @param {Record<string, string>} t
 * @returns {string}
 */
function formatPainLine(counts, n, t) {
  const known = PAIN_PRIORITY.filter((tag) => (counts[tag] || 0) > 0);
  if (known.length === 0) {
    return t.reportConsensusPainNone ?? "";
  }
  const breakdown = formatBreakdown(
    Object.fromEntries(known.map((tag) => [tag, counts[tag] || 0])),
    n,
    t,
    (value) => labelForPain(value, t),
  );
  return formatString(
    t.reportConsensusPainLine ?? "{breakdown} ({n} из {n}).",
    {
      breakdown,
      n,
    },
  );
}

/**
 * @param {Record<string, number>} counts
 * @param {number} _n
 * @param {Record<string, string>} t
 * @param {(value: string) => string} labelFn
 * @returns {string}
 */
function formatBreakdown(counts, _n, t, labelFn) {
  const sep = t.reportConsensusBreakdownSep ?? ", ";
  const itemTpl =
    t.reportConsensusBreakdownItem ?? "{label} — {count}";
  return Object.entries(counts || {})
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const ai = GRADE_ORDER.indexOf(/** @type {*} */ (a[0]));
      const bi = GRADE_ORDER.indexOf(/** @type {*} */ (b[0]));
      if (ai >= 0 && bi >= 0) return ai - bi;
      return a[0].localeCompare(b[0]);
    })
    .map(([value, count]) =>
      formatString(itemTpl, { label: labelFn(value), count }),
    )
    .join(sep);
}

/**
 * @param {string} value
 * @param {Record<string, string>} t
 */
function labelForGrade(value, t) {
  const map = {
    junior: "reviewGradeJunior",
    mid: "reviewGradeMid",
    senior: "reviewGradeSenior",
    staff: "reviewGradeStaff",
    lead: "reviewGradeLead",
    head: "reviewGradeHead",
  };
  return t[map[value]] ?? value;
}

/**
 * @param {string} value
 * @param {Record<string, string>} t
 */
function labelForStructure(value, t) {
  const map = {
    mess: "reviewStructureMess",
    dump: "reviewStructureDump",
    outline: "reviewStructureOutline",
    clear: "reviewStructureClear",
  };
  return t[map[value]] ?? value;
}

/**
 * @param {string} value
 * @param {Record<string, string>} t
 */
function labelForMetrics(value, t) {
  const map = {
    none: "reviewMetricsNone",
    vanity: "reviewMetricsVanity",
    nominal: "reviewMetricsNominal",
    solid: "reviewMetricsSolid",
    strong: "reviewMetricsStrong",
  };
  return t[map[value]] ?? value;
}

/**
 * @param {string} value
 * @param {Record<string, string>} t
 */
function labelForTier(value, t) {
  const map = {
    early: "reviewTierEarly",
    mid: "reviewTierMid",
    strong: "reviewTierStrong",
    top: "reviewTierTop",
  };
  return t[map[value]] ?? value;
}

/**
 * @param {string} value
 * @param {Record<string, string>} t
 */
function labelForPain(value, t) {
  const map = {
    composition: "reviewPainComposition",
    contrast: "reviewPainContrast",
    components: "reviewPainComponents",
    overloaded: "reviewPainOverloaded",
  };
  return t[map[value]] ?? value;
}

/**
 * @param {"context" | "visual"} axis
 * @param {string} value
 * @param {Record<string, string>} t
 */
function labelForScale(axis, value, t) {
  const key =
    axis === "context"
      ? `reviewContextValue${value}`
      : `reviewVisualValue${value}`;
  return t[key] ?? value;
}
