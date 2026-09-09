/**
 * Сводный отчёт: тексты агрегатов осей + модель action cards через i18n.
 * Вердикт / strengths / cards считаются по первым `sheetLimit` листам.
 * Tallies в секциях — по всем листам (overshoot виден в голосах).
 */

import {
  GRADE_ORDER,
  aggregatePortfolioReviews,
  hasMajority,
} from "./aggregatePortfolioReviews.js";
import { formatPlural } from "./plural.js";
import {
  DEFAULT_CARD_SHEET_LIMIT,
  resolveActionCards,
} from "./resolveActionCards.js";
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
 *   confirmations: string;
 *   support: number;
 *   n: number;
 * }} ConsensusActionCard
 *
 * @typedef {{
 *   id: string;
 *   label: string;
 * }} ConsensusStrength
 *
 * @typedef {{
 *   title: string;
 *   body: string;
 * }} ConsensusVerdict
 *
 * @typedef {{
 *   aggregate: import("./aggregatePortfolioReviews.js").PortfolioReviewAggregate;
 *   cardAggregate: import("./aggregatePortfolioReviews.js").PortfolioReviewAggregate;
 *   verdict: ConsensusVerdict | null;
 *   strengths: ConsensusStrength[];
 *   sections: ConsensusSection[];
 *   actionCards: ConsensusActionCard[];
 *   adviceList: { reviewerName: string; text: string }[];
 *   dictationList: { reviewerName: string; text: string }[];
 * }} ConsensusReport
 */

/**
 * @param {unknown[]} sheetsOrAnswers
 * @param {Record<string, string>} t
 * @param {{ locale?: string; sheetLimit?: number }} [opts]
 * @returns {ConsensusReport}
 */
export function buildConsensusReport(sheetsOrAnswers, t, opts = {}) {
  const locale = opts.locale || "ru";
  const sheetLimit =
    typeof opts.sheetLimit === "number" && Number.isFinite(opts.sheetLimit)
      ? Math.max(1, Math.floor(opts.sheetLimit))
      : DEFAULT_CARD_SHEET_LIMIT;
  const aggregate = aggregatePortfolioReviews(sheetsOrAnswers);
  const cardAggregate = aggregatePortfolioReviews(sheetsOrAnswers, {
    limit: sheetLimit,
  });
  const rawCards = resolveActionCards(cardAggregate);
  const sections = buildConsensusSections(aggregate, t, locale);
  const actionCards = rawCards
    .map((card) => localizeActionCard(card, t, locale))
    .filter(Boolean);
  const diagnosis = buildConsensusDiagnosis(cardAggregate, t);

  return {
    aggregate,
    cardAggregate,
    verdict: diagnosis.verdict,
    strengths: diagnosis.strengths,
    sections,
    actionCards: /** @type {ConsensusActionCard[]} */ (actionCards),
    adviceList: aggregate.adviceList.slice(),
    dictationList: aggregate.dictationList.slice(),
  };
}

/**
 * Главный вывод + что работает — по card-aggregate (первые target листы).
 *
 * @param {import("./aggregatePortfolioReviews.js").PortfolioReviewAggregate} aggregate
 * @param {Record<string, string>} t
 * @returns {{ verdict: ConsensusVerdict | null; strengths: ConsensusStrength[] }}
 */
export function buildConsensusDiagnosis(aggregate, t) {
  if (!aggregate || aggregate.n <= 0) {
    return { verdict: null, strengths: [] };
  }

  const n = aggregate.n;
  const gradeZoneName = majorityGradeZone(aggregate.grade.counts, n);
  const tierValue = majorityKey(aggregate.tier.counts, n);
  const title = t.reportConsensusVerdictTitle ?? "";
  let body = "";

  if (gradeZoneName && tierValue) {
    const key = `reportSummary${cap(tierValue)}${gradeZoneName}0`;
    const summary = t[key] ?? "";
    const lead = t.reportSummaryLead ?? "";
    body = joinBlockLines([lead, summary]);
  } else if (
    aggregate.grade.min &&
    aggregate.grade.max &&
    aggregate.grade.min !== aggregate.grade.max
  ) {
    body = formatString(t.reportConsensusVerdictSpread ?? "", {
      from: labelForGrade(aggregate.grade.min, t),
      to: labelForGrade(aggregate.grade.max, t),
      n,
    });
  } else {
    body = t.reportConsensusVerdictFallback ?? "";
  }

  const verdict = body ? { title, body } : null;

  /** @type {ConsensusStrength[]} */
  const strengths = [];
  const structureClear = aggregate.structure.counts.clear || 0;
  if (hasMajority(structureClear, n)) {
    strengths.push({
      id: "structure",
      label: t.reportConsensusStrengthStructure ?? "",
    });
  }
  const metricsGood =
    (aggregate.metrics.counts.solid || 0) +
    (aggregate.metrics.counts.strong || 0);
  if (hasMajority(metricsGood, n)) {
    strengths.push({
      id: "metrics",
      label: t.reportConsensusStrengthMetrics ?? "",
    });
  }
  if (hasMajority(sumScale(aggregate.context.counts, (value) => value >= 4), n)) {
    strengths.push({
      id: "context",
      label: t.reportConsensusStrengthContext ?? "",
    });
  }
  if (hasMajority(sumScale(aggregate.visual.counts, (value) => value >= 4), n)) {
    strengths.push({
      id: "visual",
      label: t.reportConsensusStrengthVisual ?? "",
    });
  }
  const highTier =
    (aggregate.tier.counts.strong || 0) + (aggregate.tier.counts.top || 0);
  if (
    hasMajority(sumScale(aggregate.context.counts, (value) => value >= 4), n) &&
    hasMajority(aggregate.metrics.counts.strong || 0, n) &&
    hasMajority(sumScale(aggregate.visual.counts, (value) => value >= 4), n) &&
    hasMajority(highTier, n)
  ) {
    strengths.push({
      id: "thinking",
      label: t.reportConsensusStrengthThinking ?? "",
    });
  }

  return { verdict, strengths: strengths.filter((item) => item.label) };
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
 * @param {string} [locale]
 * @returns {ConsensusActionCard | null}
 */
export function localizeActionCard(card, t, locale = "ru") {
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

  const links = (card.links || []).map((link) => ({
    label: pickLocalizedText(link.title, locale) || link.url,
    url: link.url,
    type: link.type,
  }));

  /** @type {ConsensusCardLink | null} */
  let example = null;
  if (card.example?.url) {
    example = {
      label:
        pickLocalizedText(card.example.title, locale) || card.example.url,
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
    confirmations: formatString(
      t.reportActionConfirmations ?? "{count} из {n}",
      { count: card.support ?? 0, n: card.n ?? 0 },
    ),
    support: card.support ?? 0,
    n: card.n ?? 0,
  };
}

/**
 * @param {string | Record<string, string> | undefined} value
 * @param {string} locale
 * @returns {string}
 */
function pickLocalizedText(value, locale) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return (
    value[locale] ||
    value.ru ||
    value.en ||
    Object.values(value).find((item) => typeof item === "string" && item) ||
    ""
  );
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

/**
 * @param {string} value
 */
function cap(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * @param {Record<string, number>} counts
 * @param {number} n
 * @returns {string | null}
 */
function majorityKey(counts, n) {
  let best = null;
  let bestCount = 0;
  let tied = false;
  for (const [key, count] of Object.entries(counts || {})) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
      tied = false;
    } else if (count === bestCount && count > 0) {
      tied = true;
    }
  }
  if (!best || tied || !hasMajority(bestCount, n)) return null;
  return best;
}

/**
 * @param {string} grade
 * @returns {"Junior" | "Mid" | "SeniorPlus"}
 */
function zoneForGrade(grade) {
  if (grade === "junior") return "Junior";
  if (grade === "mid") return "Mid";
  return "SeniorPlus";
}

/**
 * @param {Record<string, number>} counts
 * @param {number} n
 * @returns {"Junior" | "Mid" | "SeniorPlus" | null}
 */
function majorityGradeZone(counts, n) {
  /** @type {Record<string, number>} */
  const zones = { Junior: 0, Mid: 0, SeniorPlus: 0 };
  for (const [grade, count] of Object.entries(counts || {})) {
    zones[zoneForGrade(grade)] += count;
  }
  const key = majorityKey(zones, n);
  if (key === "Junior" || key === "Mid" || key === "SeniorPlus") return key;
  return null;
}

/**
 * @param {Record<string, number>} counts
 * @param {(value: number) => boolean} pred
 */
function sumScale(counts, pred) {
  let sum = 0;
  for (const [key, count] of Object.entries(counts || {})) {
    const value = Number(key);
    if (Number.isFinite(value) && pred(value)) sum += count;
  }
  return sum;
}
