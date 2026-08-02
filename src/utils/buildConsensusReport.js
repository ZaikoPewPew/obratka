/**
 * Сводный отчёт: тексты агрегатов осей + модель action cards через i18n.
 * L2/L3 per-reviewer сюда не копируем.
 * Тексты осей многострочные (заголовок диапазона + строки голосов).
 */

import {
  GRADE_ORDER,
  aggregatePortfolioReviews,
} from "./aggregatePortfolioReviews.js";
import { formatPlural } from "./plural.js";
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
 * @param {{ locale?: string }} [opts]
 * @returns {ConsensusReport}
 */
export function buildConsensusReport(sheetsOrAnswers, t, opts = {}) {
  const locale = opts.locale || "ru";
  const aggregate = aggregatePortfolioReviews(sheetsOrAnswers);
  const rawCards = resolveActionCards(aggregate);
  const sections = buildConsensusSections(aggregate, t, locale);
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
 * @param {string} [locale]
 * @returns {ConsensusSection[]}
 */
export function buildConsensusSections(aggregate, t, locale = "ru") {
  if (!aggregate || aggregate.n <= 0) return [];

  /** @type {ConsensusSection[]} */
  const sections = [];
  const n = aggregate.n;

  const gradeBody = formatGradeBlock(aggregate, t, locale);
  if (gradeBody) {
    sections.push({
      title: t.reportConsensusGradeTitle ?? t.reportGradeTitle ?? "",
      body: gradeBody,
    });
  }

  const structureBody = formatCategoricalBlock(
    aggregate.structure.counts,
    n,
    t,
    locale,
    (value) => labelForStructure(value, t),
  );
  if (structureBody) {
    sections.push({
      title: t.reportConsensusStructureTitle ?? t.reportStructureTitle ?? "",
      body: structureBody,
    });
  }

  const metricsBody = formatCategoricalBlock(
    aggregate.metrics.counts,
    n,
    t,
    locale,
    (value) => labelForMetrics(value, t),
  );
  if (metricsBody) {
    sections.push({
      title: t.reportConsensusMetricsTitle ?? t.reportMetricsTitle ?? "",
      body: metricsBody,
    });
  }

  const contextBody = formatScaleBlock(
    aggregate.context,
    n,
    t,
    locale,
    "context",
  );
  if (contextBody) {
    sections.push({
      title: t.reportConsensusContextTitle ?? t.reportContextTitle ?? "",
      body: contextBody,
    });
  }

  const visualBody = formatScaleBlock(aggregate.visual, n, t, locale, "visual");
  if (visualBody) {
    sections.push({
      title: t.reportConsensusVisualTitle ?? t.reportVisualTitle ?? "",
      body: visualBody,
    });
  }

  const painBody = formatPainBlock(aggregate.pain.counts, n, t, locale);
  if (painBody) {
    sections.push({
      title: t.reportConsensusPainTitle ?? t.reportPainTitle ?? "",
      body: painBody,
    });
  }

  const tierBody = formatCategoricalBlock(
    aggregate.tier.counts,
    n,
    t,
    locale,
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
 * @param {string} locale
 * @returns {string}
 */
function formatGradeBlock(aggregate, t, locale) {
  const n = aggregate.n;
  const { min, max, counts } = aggregate.grade;
  const votes = formatVoteLines(counts, t, locale, (value) =>
    labelForGrade(value, t),
  );
  if (!min || !max) {
    return joinBlockLines([
      formatString(t.reportConsensusCountHeader ?? "({n} из {n})", { n }),
      ...votes,
    ]);
  }
  const header =
    min === max
      ? formatString(t.reportConsensusGradeSame ?? "«{grade}» ({n} из {n})", {
          grade: labelForGrade(min, t),
          n,
        })
      : formatString(
          t.reportConsensusGradeRange ??
            "От «{from}» до «{to}» ({n} из {n})",
          {
            from: labelForGrade(min, t),
            to: labelForGrade(max, t),
            n,
          },
        );
  return joinBlockLines([header, ...votes]);
}

/**
 * @param {Record<string, number>} counts
 * @param {number} n
 * @param {Record<string, string>} t
 * @param {string} locale
 * @param {(value: string) => string} labelFn
 * @returns {string}
 */
function formatCategoricalBlock(counts, n, t, locale, labelFn) {
  const entries = sortedCountEntries(counts);
  if (entries.length === 0) return "";

  const votes = formatVoteLines(counts, t, locale, labelFn);
  const [topValue, topCount] = entries[0];
  const header =
    entries.length === 1 || topCount > n / 2
      ? formatString(
          t.reportConsensusAxisMajority ?? "«{label}» ({count} из {n})",
          {
            label: labelFn(topValue),
            count: topCount,
            n,
          },
        )
      : formatString(t.reportConsensusCountHeader ?? "({n} из {n})", { n });
  return joinBlockLines([header, ...votes]);
}

/**
 * @param {{ counts: Record<string, number>; min: number | null; max: number | null }} scale
 * @param {number} n
 * @param {Record<string, string>} t
 * @param {string} locale
 * @param {"context" | "visual"} axis
 * @returns {string}
 */
function formatScaleBlock(scale, n, t, locale, axis) {
  const { min, max, counts } = scale;
  if (min == null || max == null) return "";
  const votes = formatVoteLines(counts, t, locale, (value) =>
    labelForScale(axis, value, t),
  );
  const header =
    min === max
      ? formatString(t.reportConsensusScaleSame ?? "«{value}» ({n} из {n})", {
          value: labelForScale(axis, String(min), t),
          n,
        })
      : formatString(
          t.reportConsensusScaleRange ??
            "От «{from}» до «{to}» ({n} из {n})",
          {
            from: labelForScale(axis, String(min), t),
            to: labelForScale(axis, String(max), t),
            n,
          },
        );
  return joinBlockLines([header, ...votes]);
}

/**
 * @param {Record<string, number>} counts
 * @param {number} n
 * @param {Record<string, string>} t
 * @param {string} locale
 * @returns {string}
 */
function formatPainBlock(counts, n, t, locale) {
  const known = PAIN_PRIORITY.filter((tag) => (counts[tag] || 0) > 0);
  if (known.length === 0) {
    return t.reportConsensusPainNone ?? "";
  }
  const filtered = Object.fromEntries(
    known.map((tag) => [tag, counts[tag] || 0]),
  );
  const votes = formatVoteLines(filtered, t, locale, (value) =>
    labelForPain(value, t),
  );
  return joinBlockLines([
    formatString(t.reportConsensusCountHeader ?? "({n} из {n})", { n }),
    ...votes,
  ]);
}

/**
 * @param {string[]} lines
 * @returns {string}
 */
function joinBlockLines(lines) {
  return lines.map((line) => String(line || "").trim()).filter(Boolean).join("\n");
}

/**
 * @param {Record<string, number>} counts
 * @returns {[string, number][]}
 */
function sortedCountEntries(counts) {
  return Object.entries(counts || {}).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const ai = GRADE_ORDER.indexOf(/** @type {*} */ (a[0]));
    const bi = GRADE_ORDER.indexOf(/** @type {*} */ (b[0]));
    if (ai >= 0 && bi >= 0) return ai - bi;
    const aNum = Number(a[0]);
    const bNum = Number(b[0]);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return bNum - aNum;
    return a[0].localeCompare(b[0]);
  });
}

/**
 * @param {Record<string, number>} counts
 * @param {Record<string, string>} t
 * @param {string} locale
 * @param {(value: string) => string} labelFn
 * @returns {string[]}
 */
function formatVoteLines(counts, t, locale, labelFn) {
  return sortedCountEntries(counts).map(([value, count]) =>
    formatPlural(
      {
        one: t.reportConsensusVoteOne,
        few: t.reportConsensusVoteFew,
        many: t.reportConsensusVoteMany,
        other: t.reportConsensusVoteOther,
      },
      count,
      { count, label: labelFn(value) },
      locale,
    ),
  );
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
