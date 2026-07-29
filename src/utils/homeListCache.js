/**
 * SWR-кэш вкладок home: feed / mine / rating.
 * Memory + sessionStorage (`obratka.homeLists.<userId>`), чтобы SPA и F5
 * не мигали skeleton при наличии **непустых** данных. Пустой `[]` для UI —
 * miss (skeleton), иначе flash empty до revalidate.
 */

/** @typedef {'feed' | 'mine' | 'rating'} HomeListTabId */

/**
 * @typedef {{
 *   feed: unknown[] | null;
 *   mine: unknown[] | null;
 *   rating: unknown[] | null;
 * }} HomeListTabsCache
 */

const STORAGE_PREFIX = "obratka.homeLists.";

/** @type {Map<string, HomeListTabsCache>} */
const memoryByUser = new Map();

/**
 * @returns {HomeListTabsCache}
 */
function emptyTabs() {
  return { feed: null, mine: null, rating: null };
}

/**
 * @param {string} userId
 * @returns {string}
 */
function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId}`;
}

/**
 * @param {unknown} value
 * @returns {value is unknown[]}
 */
function isItemList(value) {
  return Array.isArray(value);
}

/**
 * @param {unknown} raw
 * @returns {HomeListTabsCache | null}
 */
function parseStored(raw) {
  if (!raw || typeof raw !== "object") return null;
  const feed = "feed" in raw && raw.feed === null ? null : raw.feed;
  const mine = "mine" in raw && raw.mine === null ? null : raw.mine;
  const rating = "rating" in raw && raw.rating === null ? null : raw.rating;
  return {
    feed: feed == null ? null : isItemList(feed) ? feed : null,
    mine: mine == null ? null : isItemList(mine) ? mine : null,
    rating: rating == null ? null : isItemList(rating) ? rating : null,
  };
}

/**
 * @param {string} userId
 */
function ensureHydrated(userId) {
  if (!userId || memoryByUser.has(userId)) return;
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    if (!raw) {
      memoryByUser.set(userId, emptyTabs());
      return;
    }
    const parsed = parseStored(JSON.parse(raw));
    memoryByUser.set(userId, parsed ?? emptyTabs());
  } catch {
    memoryByUser.set(userId, emptyTabs());
  }
}

/**
 * @param {string} userId
 * @param {HomeListTabsCache} tabs
 */
function persist(userId, tabs) {
  try {
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(tabs));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Кэш вкладки: `null` = miss; непустой массив = hit (UI сразу).
 * Пустой `[]` для UI — тоже miss (skeleton до confirm refresh), иначе F5
 * мелькает empty до прихода данных.
 *
 * @param {string | null | undefined} userId
 * @param {HomeListTabId} tab
 * @returns {unknown[] | null}
 */
export function getCachedHomeList(userId, tab) {
  if (!userId) return null;
  ensureHydrated(userId);
  const entry = memoryByUser.get(userId);
  if (!entry) return null;
  return entry[tab];
}

/**
 * @param {string | null | undefined} userId
 * @param {HomeListTabId} tab
 * @param {unknown[]} items
 */
export function setCachedHomeList(userId, tab, items) {
  if (!userId) return;
  ensureHydrated(userId);
  const entry = memoryByUser.get(userId) ?? emptyTabs();
  entry[tab] = Array.isArray(items) ? items : [];
  memoryByUser.set(userId, entry);
  persist(userId, entry);
}

/**
 * Сброс кэша (logout). Без `userId` — все ключи префикса.
 *
 * @param {string | null | undefined} [userId]
 */
export function clearHomeListCache(userId) {
  if (userId) {
    memoryByUser.delete(userId);
    try {
      window.sessionStorage.removeItem(storageKey(userId));
    } catch {
      /* ignore */
    }
    return;
  }
  memoryByUser.clear();
  try {
    const keys = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
