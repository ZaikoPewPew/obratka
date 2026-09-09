/**
 * Majority → до 3 статичных action cards.
 * Ссылки подтягиваются из actionResources по covers.
 *
 * Политики risk-fix v1:
 *  - tie лучших problem-value → нет card;
 *  - sum(problem) > n/2 при уникальном лидере → card;
 *  - majority для cards — по переданному aggregate (caller режет sheetLimit);
 *  - кластеры гасят перекрытые оси;
 *  - scoring, затем pain-reserve в top-3;
 *  - example URL уникален в одном resolve.
 *
 * Ранкинг ссылок: weight ↓ → covers length ↑ → type diversity → id.
 */

import actionCardsDb from "../data/actionCards.json" with { type: "json" };
import actionResourcesDb from "../data/actionResources.json" with { type: "json" };
import { hasMajority } from "./aggregatePortfolioReviews.js";
import { PAIN_PRIORITY } from "./reviewReport.js";

const STRUCTURE_PROBLEMS = /** @type {const} */ (["mess", "dump"]);
const METRICS_PROBLEMS = /** @type {const} */ (["none", "vanity"]);
const CONTEXT_PROBLEMS = /** @type {const} */ (["1", "2"]);

export const DEFAULT_CARD_SHEET_LIMIT = 3;
const MAX_ACTION_CARDS = 3;
const MAX_LINKS_PER_CARD = 2;

/** Вес оси для scoring (не показываем в UI). */
const CATEGORY_WEIGHT = {
  cluster: 6,
  metrics: 5,
  structure: 4,
  visual: 3,
  context: 3,
  pain: 2,
};

const ADVICE_HINTS = {
  cluster: /продуктов|impact|что сделал|история кейса|не понял|результат/i,
  metrics: /метрик|impact|результат|convers|baseline|outcome|vanity|цифр/i,
  structure: /структур|артефакт|свалк|простын|dump|mess|story|повествов|каркас/i,
  context: /не понял|задач|роль|контекст|кто делал|business|команд/i,
  visual: /визуал|иерарх|контраст|сетк|композ|ui\b|интерфейс/i,
  pain: /перегруз|воздух|shadow|рамк|component|contrast|композиц/i,
};

/**
 * @typedef {{
 *   id: string;
 *   url: string;
 *   types: string[];
 *   tags: string[];
 *   covers: string[];
 *   weight?: number;
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
 *   support: number;
 *   n: number;
 *   score: number;
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
  const adviceBlob = joinAdviceBlob(aggregate);
  /** @type {{ id: string; support: number; suppress?: string[] }[]} */
  const axis = [];

  const structureValue = pickProblemValue(
    aggregate.structure?.counts || {},
    STRUCTURE_PROBLEMS,
    n,
  );
  if (structureValue) {
    axis.push({
      id: `structure_${structureValue}`,
      support: countFor(aggregate.structure?.counts, structureValue),
    });
  }

  const metricsValue = pickProblemValue(
    aggregate.metrics?.counts || {},
    METRICS_PROBLEMS,
    n,
  );
  if (metricsValue) {
    axis.push({
      id: `metrics_${metricsValue}`,
      support: countFor(aggregate.metrics?.counts, metricsValue),
    });
  }

  if (hasProblemMajority(aggregate.context?.counts || {}, CONTEXT_PROBLEMS, n)) {
    axis.push({
      id: "context_low",
      support: sumCounts(aggregate.context?.counts || {}, CONTEXT_PROBLEMS),
    });
  }

  const painCounts = aggregate.pain?.counts || {};
  /** @type {{ id: string; support: number }[]} */
  const painHits = [];
  for (const tag of PAIN_PRIORITY) {
    const support = painCounts[tag] || 0;
    if (hasMajority(support, n)) {
      painHits.push({ id: `pain_${tag}`, support });
    }
  }

  const visualWeak = scaleMajority(aggregate.visual?.counts || {}, n, (value) => value <= 2);
  if (visualWeak && painHits.length === 0) {
    axis.push({
      id: "visual_weak",
      support: sumScale(aggregate.visual?.counts || {}, (value) => value <= 2),
    });
  }

  const clusters = collectClusterCards(aggregate, {
    structureValue,
    metricsValue,
    contextLow: axis.some((card) => card.id === "context_low"),
  });

  const suppressed = new Set();
  for (const cluster of clusters) {
    for (const id of cluster.suppress || []) suppressed.add(id);
  }

  /** @type {{ id: string; support: number }[]} */
  const candidates = [
    ...clusters.map((cluster) => ({ id: cluster.id, support: cluster.support })),
    ...axis.filter((card) => !suppressed.has(card.id)),
    ...painHits,
  ];

  const scored = candidates
    .map((card) => {
      const raw = lookupCard(card.id);
      const category = raw?.category || categoryFromId(card.id);
      const score = scoreCard({
        category,
        support: card.support,
        n,
        adviceBlob,
        cluster: category === "cluster",
      });
      return { ...card, category, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.id.startsWith("pain_") && b.id.startsWith("pain_")) {
        return (
          PAIN_PRIORITY.indexOf(a.id.slice("pain_".length)) -
          PAIN_PRIORITY.indexOf(b.id.slice("pain_".length))
        );
      }
      return a.id.localeCompare(b.id);
    });

  const picked = applyPainReserve(scored, MAX_ACTION_CARDS);
  /** @type {ActionCardRecord[]} */
  const selected = [];
  for (const item of picked) {
    pushCard(selected, item.id, { support: item.support, n, score: item.score });
  }
  dedupeExamples(selected);
  return selected;
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
 * @param {ActionResourceRecord} resource
 * @returns {number}
 */
export function resourceWeight(resource) {
  const value = Number(resource?.weight);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Sort: weight ↓ → covers length ↑ → id.
 * @param {ActionResourceRecord[]} resources
 * @returns {ActionResourceRecord[]}
 */
export function sortResourcesByRank(resources) {
  return resources.slice().sort((a, b) => {
    const weightDiff = resourceWeight(b) - resourceWeight(a);
    if (weightDiff !== 0) return weightDiff;
    const coversA = Array.isArray(a.covers) ? a.covers.length : 99;
    const coversB = Array.isArray(b.covers) ? b.covers.length : 99;
    if (coversA !== coversB) return coversA - coversB;
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Greedy pick preferring unused primary types.
 * @param {ActionResourceRecord[]} ranked
 * @param {number} max
 * @returns {ActionResourceRecord[]}
 */
export function pickDiverseResources(ranked, max) {
  /** @type {ActionResourceRecord[]} */
  const picked = [];
  /** @type {Set<string>} */
  const usedTypes = new Set();
  /** @type {Set<string>} */
  const usedIds = new Set();

  while (picked.length < max) {
    let next =
      ranked.find((resource) => {
        if (usedIds.has(resource.id)) return false;
        const primary = primaryType(resource);
        return primary && !usedTypes.has(primary);
      }) || null;

    if (!next) {
      next =
        ranked.find((resource) => !usedIds.has(resource.id)) || null;
    }
    if (!next) break;

    picked.push(next);
    usedIds.add(next.id);
    const primary = primaryType(next);
    if (primary) usedTypes.add(primary);
  }

  return picked;
}

/**
 * Categorical majority: одиночное problem-value с majority,
 * иначе sum(problem) > N/2 при **уникальном** лидере → это value.
 * Чистый tie лучших problem-value → null.
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
  let tied = false;
  let problemSum = 0;

  for (const value of problemValues) {
    const count = counts[value] || 0;
    problemSum += count;
    if (count > bestCount) {
      bestCount = count;
      best = value;
      tied = false;
    } else if (count === bestCount && count > 0) {
      tied = true;
    }
  }

  if (!best || bestCount <= 0 || tied) return null;
  if (hasMajority(bestCount, n)) return best;
  if (hasMajority(problemSum, n)) return best;
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
 * @param {import("./aggregatePortfolioReviews.js").PortfolioReviewAggregate} aggregate
 * @param {{
 *   structureValue: string | null;
 *   metricsValue: string | null;
 *   contextLow: boolean;
 * }} hits
 * @returns {{ id: string; support: number; suppress: string[] }[]}
 */
function collectClusterCards(aggregate, hits) {
  const n = aggregate.n;
  /** @type {{ id: string; support: number; suppress: string[] }[]} */
  const clusters = [];

  if (hits.metricsValue && (hits.structureValue || hits.contextLow)) {
    const support = Math.max(
      countFor(aggregate.metrics?.counts, hits.metricsValue),
      hits.structureValue
        ? countFor(aggregate.structure?.counts, hits.structureValue)
        : 0,
      hits.contextLow
        ? sumCounts(aggregate.context?.counts || {}, CONTEXT_PROBLEMS)
        : 0,
    );
    const suppress = [];
    if (hits.structureValue) suppress.push(`structure_${hits.structureValue}`);
    if (hits.metricsValue) suppress.push(`metrics_${hits.metricsValue}`);
    if (hits.contextLow) suppress.push("context_low");
    clusters.push({ id: "cluster_impact", support, suppress });
  }

  const seniorCount = sumSeniorPlus(aggregate.grade?.counts || {});
  const lowTierCount = sumCounts(aggregate.tier?.counts || {}, ["early", "mid"]);
  if (hasMajority(seniorCount, n) && hasMajority(lowTierCount, n)) {
    clusters.push({
      id: "cluster_gradeAboveTier",
      support: Math.min(seniorCount, lowTierCount),
      suppress: [],
    });
  }

  const visualHigh = scaleMajority(
    aggregate.visual?.counts || {},
    n,
    (value) => value >= 4,
  );
  if (hits.structureValue && visualHigh) {
    clusters.push({
      id: "cluster_storyLost",
      support: Math.max(
        countFor(aggregate.structure?.counts, hits.structureValue),
        sumScale(aggregate.visual?.counts || {}, (value) => value >= 4),
      ),
      suppress: [`structure_${hits.structureValue}`],
    });
  }

  return clusters;
}

/**
 * @param {{
 *   category: string;
 *   support: number;
 *   n: number;
 *   adviceBlob: string;
 *   cluster: boolean;
 * }} input
 * @returns {number}
 */
function scoreCard(input) {
  const weight = CATEGORY_WEIGHT[input.category] ?? 3;
  const voteShare = input.n > 0 ? input.support / input.n : 0;
  const hint = ADVICE_HINTS[input.category];
  const adviceBoost = hint && hint.test(input.adviceBlob) ? 8 : 0;
  const clusterBoost = input.cluster ? 6 : 0;
  return weight * 10 + voteShare * 20 + adviceBoost + clusterBoost;
}

/**
 * @param {{ id: string; score: number; category?: string }[]} ranked
 * @param {number} max
 */
function applyPainReserve(ranked, max) {
  if (ranked.length <= max) return ranked.slice();
  const top = ranked.slice(0, max);
  const firstPain = ranked.find((card) => card.id.startsWith("pain_"));
  if (!firstPain || top.some((card) => card.id.startsWith("pain_"))) {
    return top;
  }
  let replaceAt = top.length - 1;
  while (replaceAt >= 0 && top[replaceAt].id.startsWith("pain_")) replaceAt -= 1;
  if (replaceAt < 0) return top;
  top[replaceAt] = firstPain;
  const order = new Map(ranked.map((card, index) => [card.id, index]));
  top.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  return top;
}

/**
 * @param {ActionCardRecord[]} selected
 * @param {string} id
 * @param {{ support: number; n: number; score: number }} meta
 */
function pushCard(selected, id, meta) {
  if (selected.some((card) => card.id === id)) return;
  const raw = lookupCard(id);
  if (!raw) return;

  const attached = attachResources(id);
  selected.push({
    id: raw.id || id,
    category: raw.category || "",
    trigger: raw.trigger || "",
    priority: Number(raw.priority) || 99,
    support: meta.support,
    n: meta.n,
    score: meta.score,
    links: attached.links,
    example: attached.example,
  });
}

/**
 * @param {string} id
 * @returns {{ id: string; category: string; trigger: string; priority: number } | null}
 */
function lookupCard(id) {
  const raw = /** @type {Record<string, ActionCardRecord>} */ (actionCardsDb)[id];
  if (!raw || typeof raw !== "object") return null;
  return raw;
}

/**
 * На карточку: до MAX_LINKS_PER_CARD обычных источников + 1 example.
 *
 * @param {string} cardId
 * @returns {{ links: ActionCardLink[]; example: ActionCardLink | null }}
 */
function attachResources(cardId) {
  const matching = listResourcesForCard(cardId);
  const ranked = sortResourcesByRank(matching);

  const nonExamples = ranked.filter((resource) => !isExampleResource(resource));
  const examples = ranked.filter((resource) => isExampleResource(resource));

  const links = pickDiverseResources(nonExamples, MAX_LINKS_PER_CARD)
    .map(toCardLink)
    .filter(Boolean);

  const exampleResource = examples[0] || null;
  const example = exampleResource ? toCardLink(exampleResource) : null;

  return { links: /** @type {ActionCardLink[]} */ (links), example };
}

/**
 * @param {ActionCardRecord[]} selected
 */
function dedupeExamples(selected) {
  /** @type {Set<string>} */
  const used = new Set();
  for (const card of selected) {
    const url = card.example?.url;
    if (!url) continue;
    if (used.has(url)) {
      card.example = null;
      continue;
    }
    used.add(url);
  }
}

/**
 * @param {ActionResourceRecord} resource
 * @returns {string}
 */
function primaryType(resource) {
  const types = Array.isArray(resource.types) ? resource.types : [];
  const first = types.find((type) => typeof type === "string" && type);
  return first || "";
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

/**
 * @param {import("./aggregatePortfolioReviews.js").PortfolioReviewAggregate} aggregate
 */
function joinAdviceBlob(aggregate) {
  const advice = (aggregate.adviceList || []).map((item) => item.text);
  const dictation = (aggregate.dictationList || []).map((item) => item.text);
  return [...advice, ...dictation].join("\n");
}

/**
 * @param {Record<string, number> | undefined} counts
 * @param {string | null} value
 */
function countFor(counts, value) {
  if (!value) return 0;
  return counts?.[value] || 0;
}

/**
 * @param {Record<string, number>} counts
 * @param {readonly string[]} keys
 */
function sumCounts(counts, keys) {
  let sum = 0;
  for (const key of keys) sum += counts[key] || 0;
  return sum;
}

/**
 * @param {Record<string, number>} counts
 * @param {number} n
 * @param {(value: number) => boolean} pred
 */
function scaleMajority(counts, n, pred) {
  return hasMajority(sumScale(counts, pred), n);
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

/**
 * @param {Record<string, number>} counts
 */
function sumSeniorPlus(counts) {
  return (
    (counts.senior || 0) +
    (counts.staff || 0) +
    (counts.lead || 0) +
    (counts.head || 0)
  );
}

/**
 * @param {string} id
 */
function categoryFromId(id) {
  const prefix = String(id).split("_")[0] || "";
  return prefix;
}
