/**
 * Агрегация ответов всех листов ревью по портфолио.
 * Dictation в сводке — цитаты-мнения, не факты (отдельный список).
 */

import { parseReviewAnswers } from "./reviewReport.js";

/** @type {import("./reviewReport.js").Grade[]} */
export const GRADE_ORDER = [
  "junior",
  "mid",
  "senior",
  "staff",
  "lead",
  "head",
];

/**
 * @typedef {{
 *   answers: import("./reviewReport.js").ReviewAnswers;
 *   reviewerName?: string;
 * }} AggregateSheetInput
 *
 * @typedef {{
 *   n: number;
 *   grade: { counts: Record<string, number>; min: string | null; max: string | null };
 *   structure: { counts: Record<string, number> };
 *   metrics: { counts: Record<string, number> };
 *   context: { counts: Record<string, number>; min: number | null; max: number | null };
 *   visual: { counts: Record<string, number>; min: number | null; max: number | null };
 *   tier: { counts: Record<string, number> };
 *   pain: { counts: Record<string, number> };
 *   adviceList: { reviewerName: string; text: string }[];
 *   dictationList: { reviewerName: string; text: string }[];
 * }} PortfolioReviewAggregate
 */

/**
 * @param {unknown[]} sheetsOrAnswers
 *   Массив `ReviewAnswers`, либо `{ answers, reviewerName? }`, либо сырой jsonb.
 * @param {{ limit?: number }} [opts]
 *   `limit` — взять первые N валидных листов (порядок входа / created_at).
 * @returns {PortfolioReviewAggregate}
 */
export function aggregatePortfolioReviews(sheetsOrAnswers, opts = {}) {
  /** @type {import("./reviewReport.js").ReviewAnswers[]} */
  const rows = [];
  /** @type {(string | undefined)[]} */
  const names = [];

  for (const item of Array.isArray(sheetsOrAnswers) ? sheetsOrAnswers : []) {
    if (!item || typeof item !== "object") continue;

    if ("answers" in /** @type {object} */ (item)) {
      const wrap = /** @type {AggregateSheetInput} */ (item);
      const parsed = parseReviewAnswers(wrap.answers);
      if (!parsed) continue;
      rows.push(parsed);
      names.push(
        typeof wrap.reviewerName === "string" ? wrap.reviewerName : undefined,
      );
      continue;
    }

    const parsed = parseReviewAnswers(item);
    if (!parsed) continue;
    rows.push(parsed);
    names.push(undefined);
  }

  /** @type {PortfolioReviewAggregate} */
  const empty = {
    n: 0,
    grade: { counts: {}, min: null, max: null },
    structure: { counts: {} },
    metrics: { counts: {} },
    context: { counts: {}, min: null, max: null },
    visual: { counts: {}, min: null, max: null },
    tier: { counts: {} },
    pain: { counts: {} },
    adviceList: [],
    dictationList: [],
  };
  const limit =
    typeof opts.limit === "number" && Number.isFinite(opts.limit)
      ? Math.max(0, Math.floor(opts.limit))
      : 0;
  if (limit > 0 && rows.length > limit) {
    rows.length = limit;
    names.length = limit;
  }
  const nLimited = rows.length;
  if (nLimited === 0) return empty;
  const n = nLimited;

  /** @type {Record<string, number>} */
  const gradeCounts = {};
  /** @type {Record<string, number>} */
  const structureCounts = {};
  /** @type {Record<string, number>} */
  const metricsCounts = {};
  /** @type {Record<string, number>} */
  const contextCounts = {};
  /** @type {Record<string, number>} */
  const visualCounts = {};
  /** @type {Record<string, number>} */
  const tierCounts = {};
  /** @type {Record<string, number>} */
  const painCounts = {};
  /** @type {{ reviewerName: string; text: string }[]} */
  const adviceList = [];
  /** @type {{ reviewerName: string; text: string }[]} */
  const dictationList = [];

  let contextMin = Infinity;
  let contextMax = -Infinity;
  let visualMin = Infinity;
  let visualMax = -Infinity;
  let gradeMinIdx = Infinity;
  let gradeMaxIdx = -Infinity;
  /** @type {string | null} */
  let gradeMin = null;
  /** @type {string | null} */
  let gradeMax = null;

  rows.forEach((answers, index) => {
    bump(gradeCounts, answers.grade);
    bump(structureCounts, answers.structure);
    bump(metricsCounts, answers.metrics);
    bump(tierCounts, answers.tier);
    bump(contextCounts, String(answers.context));
    bump(visualCounts, String(answers.visual));

    contextMin = Math.min(contextMin, answers.context);
    contextMax = Math.max(contextMax, answers.context);
    visualMin = Math.min(visualMin, answers.visual);
    visualMax = Math.max(visualMax, answers.visual);

    const gIdx = GRADE_ORDER.indexOf(answers.grade);
    if (gIdx >= 0) {
      if (gIdx < gradeMinIdx) {
        gradeMinIdx = gIdx;
        gradeMin = answers.grade;
      }
      if (gIdx > gradeMaxIdx) {
        gradeMaxIdx = gIdx;
        gradeMax = answers.grade;
      }
    }

    const pain = Array.isArray(answers.pain) ? answers.pain : [];
    for (const tag of pain) {
      if (!tag) continue;
      bump(painCounts, tag);
    }

    const rawName = names[index];
    const reviewerName =
      typeof rawName === "string" && rawName.trim() ? rawName.trim() : "";

    const advice = typeof answers.advice === "string" ? answers.advice.trim() : "";
    if (advice) {
      adviceList.push({ reviewerName, text: advice });
    }

    const dictation =
      typeof answers.dictation === "string" ? answers.dictation.trim() : "";
    if (dictation) {
      dictationList.push({ reviewerName, text: dictation });
    }
  });

  return {
    n,
    grade: { counts: gradeCounts, min: gradeMin, max: gradeMax },
    structure: { counts: structureCounts },
    metrics: { counts: metricsCounts },
    context: {
      counts: contextCounts,
      min: Number.isFinite(contextMin) ? contextMin : null,
      max: Number.isFinite(contextMax) ? contextMax : null,
    },
    visual: {
      counts: visualCounts,
      min: Number.isFinite(visualMin) ? visualMin : null,
      max: Number.isFinite(visualMax) ? visualMax : null,
    },
    tier: { counts: tierCounts },
    pain: { counts: painCounts },
    adviceList,
    dictationList,
  };
}

/**
 * Большинство = count > N/2.
 * @param {number} count
 * @param {number} n
 * @returns {boolean}
 */
export function hasMajority(count, n) {
  if (!Number.isFinite(count) || !Number.isFinite(n) || n <= 0) return false;
  return count > n / 2;
}

/**
 * @param {Record<string, number>} counts
 * @param {string} key
 * @returns {void}
 */
function bump(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}
