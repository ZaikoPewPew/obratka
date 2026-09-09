/**
 * Вкладки home ↔ query (`/home?tab=mine`).
 *
 * Экран один (`ROUTE_PATHS.home`), вкладка — параметр, как `?id=`
 * у `/report`. Дефолт (`feed`) в URL не пишем.
 *
 * При `RATING_TAB_ENABLED === false` `?tab=rating` → `feed`.
 * Устаревший `?filter=` игнорируется (сегменты Разбор/Разобрано сняты).
 *
 * @typedef {import("../components/home-screen/HomeScreen.js").HomeTabId} HomeTabId
 * @typedef {{ tab: HomeTabId }} HomeView
 */

import { RATING_TAB_ENABLED } from "../config/home.js";

/** @type {readonly HomeTabId[]} */
export const HOME_TAB_IDS = Object.freeze(["feed", "mine", "rating"]);

/** @type {HomeTabId} */
export const DEFAULT_HOME_TAB = "feed";

export const HOME_TAB_PARAM = "tab";

/**
 * @param {string | URLSearchParams | null | undefined} search
 * @returns {URLSearchParams}
 */
function toSearchParams(search) {
  if (search instanceof URLSearchParams) return search;
  return new URLSearchParams(String(search ?? ""));
}

/**
 * Вкладка из query. Мусор и дефолты → `feed`.
 * `?filter=` игнорируется.
 *
 * @param {string | URLSearchParams | null | undefined} search
 * @returns {HomeView}
 */
export function parseHomeView(search) {
  const params = toSearchParams(search);

  const rawTab = String(params.get(HOME_TAB_PARAM) ?? "").trim().toLowerCase();
  const tab = /** @type {HomeTabId} */ (
    HOME_TAB_IDS.includes(/** @type {HomeTabId} */ (rawTab))
      ? rawTab
      : DEFAULT_HOME_TAB
  );
  // Kill-switch: вкладка рейтинга → чистый feed.
  if (tab === "rating" && !RATING_TAB_ENABLED) {
    return { tab: DEFAULT_HOME_TAB };
  }

  return { tab };
}

/**
 * Канонический search для `go` / `syncRoute`: без дефолтов.
 *
 * @param {{ tab?: HomeTabId }} [view]
 * @returns {Record<string, string>}
 */
export function buildHomeSearch(view = {}) {
  const { tab } = parseHomeView(
    new URLSearchParams({
      ...(view.tab ? { [HOME_TAB_PARAM]: view.tab } : {}),
    }),
  );

  /** @type {Record<string, string>} */
  const search = {};
  if (tab !== DEFAULT_HOME_TAB) search[HOME_TAB_PARAM] = tab;
  return search;
}

/**
 * Совпадает ли текущий query с каноническим для вида (чтобы не гонять
 * лишний `replaceState`).
 *
 * @param {string | URLSearchParams | null | undefined} search
 * @param {{ tab?: HomeTabId }} view
 * @returns {boolean}
 */
export function isCanonicalHomeSearch(search, view) {
  const params = toSearchParams(search);
  const canonical = new URLSearchParams(buildHomeSearch(view));
  const keys = new Set([...params.keys(), ...canonical.keys()]);
  for (const key of keys) {
    if (params.get(key) !== canonical.get(key)) return false;
  }
  return true;
}
