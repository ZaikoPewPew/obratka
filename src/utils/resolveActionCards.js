/**
 * Majority → до 3 статичных action cards.
 * Порядок осей: structure → metrics → context → pain
 * (внутри pain — PAIN_PRIORITY).
 */

import actionCardsDb from "../data/actionCards.json" with { type: "json" };
import { hasMajority } from "./aggregatePortfolioReviews.js";
import { PAIN_PRIORITY } from "./reviewReport.js";

const STRUCTURE_PROBLEMS = /** @type {const} */ (["mess", "dump"]);
const METRICS_PROBLEMS = /** @type {const} */ (["none", "vanity"]);
const CONTEXT_PROBLEMS = /** @type {const} */ (["1", "2"]);

const MAX_ACTION_CARDS = 3;

/**
 * @typedef {{
 *   id: string;
 *   category: string;
 *   trigger: string;
 *   priority: number;
 *   links: { url: string; type?: string }[];
 *   example?: { url: string } | null;
 * }} ActionCardRecord
 */

/**
 * @param {import("./aggregatePortfolioReviews.js").PortfolioReviewAggregate} aggregate
 * @returns {ActionCardRecord[]}
 */
export function resolveActionCards(aggregate) {
  if (!aggregate || !aggregate.n || aggregate.n <= 0) return [];

  const n = aggregate.n;
  /** @type {ActionCardRecord[]} */
  const selected = [];

  const structureValue = pickProblemValue(
    aggregate.structure?.counts || {},
    STRUCTURE_PROBLEMS,
    n,
  );
  if (structureValue) {
    pushCard(selected, `structure_${structureValue}`);
  }

  const metricsValue = pickProblemValue(
    aggregate.metrics?.counts || {},
    METRICS_PROBLEMS,
    n,
  );
  if (metricsValue) {
    pushCard(selected, `metrics_${metricsValue}`);
  }

  if (hasProblemMajority(aggregate.context?.counts || {}, CONTEXT_PROBLEMS, n)) {
    pushCard(selected, "context_low");
  }

  const painCounts = aggregate.pain?.counts || {};
  for (const tag of PAIN_PRIORITY) {
    if (hasMajority(painCounts[tag] || 0, n)) {
      pushCard(selected, `pain_${tag}`);
    }
  }

  return selected.slice(0, MAX_ACTION_CARDS);
}

/**
 * Categorical majority: одиночное problem-value с majority,
 * иначе sum(problem) > N/2 → value с max count среди проблемных.
 *
 * @param {Record<string, number>} counts
 * @param {readonly string[]} problemValues
 * @param {number} n
 * @returns {string | null}
 */
export function pickProblemValue(counts, problemValues, n) {
  if (!n || n <= 0) return null;

  /** @type {string | null} */
  let best = null;
  let bestCount = 0;
  let problemSum = 0;

  for (const value of problemValues) {
    const count = counts[value] || 0;
    problemSum += count;
    if (count > bestCount) {
      bestCount = count;
      best = value;
    }
  }

  if (best && hasMajority(bestCount, n)) return best;
  if (best && hasMajority(problemSum, n) && bestCount > 0) return best;
  return null;
}

/**
 * @param {Record<string, number>} counts
 * @param {readonly string[]} problemValues
 * @param {number} n
 * @returns {boolean}
 */
export function hasProblemMajority(counts, problemValues, n) {
  return pickProblemValue(counts, problemValues, n) != null;
}

/**
 * @param {ActionCardRecord[]} selected
 * @param {string} id
 */
function pushCard(selected, id) {
  if (selected.some((card) => card.id === id)) return;
  const raw = /** @type {Record<string, ActionCardRecord>} */ (actionCardsDb)[
    id
  ];
  if (!raw || typeof raw !== "object") return;
  selected.push({
    id: raw.id || id,
    category: raw.category || "",
    trigger: raw.trigger || "",
    priority: Number(raw.priority) || 99,
    links: Array.isArray(raw.links)
      ? raw.links
          .filter((link) => link && typeof link.url === "string" && link.url)
          .map((link) => ({
            url: link.url,
            type: typeof link.type === "string" ? link.type : undefined,
          }))
      : [],
    example:
      raw.example && typeof raw.example.url === "string" && raw.example.url
        ? { url: raw.example.url }
        : null,
  });
}
