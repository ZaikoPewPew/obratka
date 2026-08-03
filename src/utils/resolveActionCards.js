/**
 * Majority → до 3 статичных action cards.
 * Ссылки подтягиваются из actionResources по covers.
 * Порядок осей: structure → metrics → context → pain
 * (внутри pain — PAIN_PRIORITY).
 */

import actionCardsDb from "../data/actionCards.json" with { type: "json" };
import actionResourcesDb from "../data/actionResources.json" with { type: "json" };
import { hasMajority } from "./aggregatePortfolioReviews.js";
import { PAIN_PRIORITY } from "./reviewReport.js";

const STRUCTURE_PROBLEMS = /** @type {const} */ (["mess", "dump"]);
const METRICS_PROBLEMS = /** @type {const} */ (["none", "vanity"]);
const CONTEXT_PROBLEMS = /** @type {const} */ (["1", "2"]);

const MAX_ACTION_CARDS = 3;
const MAX_LINKS_PER_CARD = 2;

/**
 * @typedef {{
 *   id: string;
 *   url: string;
 *   types: string[];
 *   tags: string[];
 *   covers: string[];
 *   title: string | Record<string, string>;
 *   description?: string | Record<string, string>;
 * }} ActionResourceRecord
 *
 * @typedef {{
 *   id: string;
 *   url: string;
 *   type?: string;
 *   types: string[];
 *   tags: string[];
 *   title: string | Record<string, string>;
 *   description?: string | Record<string, string>;
 * }} ActionCardLink
 *
 * @typedef {{
 *   id: string;
 *   category: string;
 *   trigger: string;
 *   priority: number;
 *   links: ActionCardLink[];
 *   example?: ActionCardLink | null;
 * }} ActionCardRecord
 */

/** @type {ActionResourceRecord[]} */
const ALL_RESOURCES = Object.values(
  /** @type {Record<string, ActionResourceRecord>} */ (actionResourcesDb),
).filter((resource) => resource && typeof resource.url === "string" && resource.url);

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
 * Источники, которые закрывают card id (для тестов / отладки).
 * @param {string} cardId
 * @returns {ActionResourceRecord[]}
 */
export function listResourcesForCard(cardId) {
  return ALL_RESOURCES.filter((resource) =>
    Array.isArray(resource.covers) ? resource.covers.includes(cardId) : false,
  );
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

  const attached = attachResources(id);
  selected.push({
    id: raw.id || id,
    category: raw.category || "",
    trigger: raw.trigger || "",
    priority: Number(raw.priority) || 99,
    links: attached.links,
    example: attached.example,
  });
}

/**
 * На карточку: до MAX_LINKS_PER_CARD обычных источников + 1 example.
 * Сначала более узкие covers (специфичнее), затем порядок в DB.
 *
 * @param {string} cardId
 * @returns {{ links: ActionCardLink[]; example: ActionCardLink | null }}
 */
function attachResources(cardId) {
  const matching = listResourcesForCard(cardId).slice().sort((a, b) => {
    const coversA = Array.isArray(a.covers) ? a.covers.length : 99;
    const coversB = Array.isArray(b.covers) ? b.covers.length : 99;
    if (coversA !== coversB) return coversA - coversB;
    return String(a.id).localeCompare(String(b.id));
  });

  /** @type {ActionCardLink[]} */
  const links = [];
  /** @type {ActionCardLink | null} */
  let example = null;

  for (const resource of matching) {
    const link = toCardLink(resource);
    if (!link) continue;
    if (isExampleResource(resource)) {
      if (!example) example = link;
      continue;
    }
    if (links.length < MAX_LINKS_PER_CARD) {
      links.push(link);
    }
  }

  return { links, example };
}

/**
 * @param {ActionResourceRecord} resource
 * @returns {boolean}
 */
function isExampleResource(resource) {
  return Array.isArray(resource.types) && resource.types.includes("example");
}

/**
 * @param {ActionResourceRecord} resource
 * @returns {ActionCardLink | null}
 */
function toCardLink(resource) {
  if (!resource?.url || typeof resource.url !== "string") return null;
  const types = Array.isArray(resource.types)
    ? resource.types.filter((type) => typeof type === "string" && type)
    : [];
  return {
    id: resource.id || "",
    url: resource.url,
    type: types[0],
    types,
    tags: Array.isArray(resource.tags)
      ? resource.tags.filter((tag) => typeof tag === "string" && tag)
      : [],
    title: resource.title,
    description: resource.description,
  };
}
