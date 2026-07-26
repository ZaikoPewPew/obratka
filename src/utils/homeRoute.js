/**
 * Вкладки home ↔ query (`/home?tab=mine&filter=completed`).
 *
 * Экран один (`ROUTE_PATHS.home`), вкладка и сегмент — параметры, как `?id=`
 * у `/report`. Дефолты (`feed` / `active`) в URL не пишем.
 *
 * @typedef {import("../components/home-screen/HomeScreen.js").HomeTabId} HomeTabId
 * @typedef {import("../components/home-screen/HomeScreen.js").MineFilterId} MineFilterId
 * @typedef {{ tab: HomeTabId; filter: MineFilterId }} HomeView
 */

/** @type {readonly HomeTabId[]} */
export const HOME_TAB_IDS = Object.freeze(["feed", "mine", "rating"]);

/** @type {readonly MineFilterId[]} */
export const MINE_FILTER_IDS = Object.freeze(["active", "completed"]);

/** @type {HomeTabId} */
export const DEFAULT_HOME_TAB = "feed";

/** @type {MineFilterId} */
export const DEFAULT_MINE_FILTER = "active";

export const HOME_TAB_PARAM = "tab";
export const HOME_FILTER_PARAM = "filter";

/**
 * @param {string | URLSearchParams | null | undefined} search
 * @returns {URLSearchParams}
 */
function toSearchParams(search) {
  if (search instanceof URLSearchParams) return search;
  return new URLSearchParams(String(search ?? ""));
}

/**
 * Вкладка + сегмент из query. Мусор и дефолты → `feed` / `active`.
 * `filter` имеет смысл только на `mine`.
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

  if (tab !== "mine") {
    return { tab, filter: DEFAULT_MINE_FILTER };
  }

  const rawFilter = String(params.get(HOME_FILTER_PARAM) ?? "")
    .trim()
    .toLowerCase();
  const filter = /** @type {MineFilterId} */ (
    MINE_FILTER_IDS.includes(/** @type {MineFilterId} */ (rawFilter))
      ? rawFilter
      : DEFAULT_MINE_FILTER
  );

  return { tab, filter };
}

/**
 * Канонический search для `go` / `syncRoute`: без дефолтов и без `filter`
 * вне вкладки «Мои».
 *
 * @param {{ tab?: HomeTabId; filter?: MineFilterId }} [view]
 * @returns {Record<string, string>}
 */
export function buildHomeSearch(view = {}) {
  const { tab, filter } = parseHomeView(
    new URLSearchParams({
      ...(view.tab ? { [HOME_TAB_PARAM]: view.tab } : {}),
      ...(view.filter ? { [HOME_FILTER_PARAM]: view.filter } : {}),
    }),
  );

  /** @type {Record<string, string>} */
  const search = {};
  if (tab !== DEFAULT_HOME_TAB) search[HOME_TAB_PARAM] = tab;
  if (tab === "mine" && filter !== DEFAULT_MINE_FILTER) {
    search[HOME_FILTER_PARAM] = filter;
  }
  return search;
}

/**
 * Совпадает ли текущий query с каноническим для вида (чтобы не гонять
 * лишний `replaceState`).
 *
 * @param {string | URLSearchParams | null | undefined} search
 * @param {{ tab?: HomeTabId; filter?: MineFilterId }} view
 * @returns {boolean}
 */
export function isCanonicalHomeSearch(search, view) {
  const params = toSearchParams(search);
  const canonical = buildHomeSearch(view);

  const currentTab = params.get(HOME_TAB_PARAM);
  const currentFilter = params.get(HOME_FILTER_PARAM);

  return (
    (currentTab ?? null) === (canonical[HOME_TAB_PARAM] ?? null) &&
    (currentFilter ?? null) === (canonical[HOME_FILTER_PARAM] ?? null)
  );
}
