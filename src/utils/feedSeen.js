/**
 * Какие кейсы ленты (portfolio id) пользователь уже «видел» на «На ревью».
 * localStorage `obratka.feedSeen.<userId>` — точка на вкладке гаснет после
 * открытия «На ревью», загорается снова только для новых id.
 *
 * Холодный старт: пустой ключ → `seedFeedSeenIfNeeded` с актуальным снимком
 * ленты (точка не горит на всём списке). Не сидить пустым списком до fetch.
 */

const STORAGE_PREFIX = "obratka.feedSeen.";

/**
 * @param {string} userId
 * @returns {string}
 */
function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId}`;
}

/**
 * @param {string | null | undefined} userId
 * @returns {boolean}
 */
export function isFeedSeenInitialized(userId) {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(storageKey(userId)) != null;
  } catch {
    return false;
  }
}

/**
 * @param {string | null | undefined} userId
 * @returns {Set<string>}
 */
export function getFeedSeenIds(userId) {
  if (!userId) return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id) => typeof id === "string" && id.length > 0),
    );
  } catch {
    return new Set();
  }
}

/**
 * Первый снимок ленты: записать baseline (в т.ч. `[]` после пустого fetch),
 * чтобы не подсветить весь список. Вызывать только после реального ответа API
 * или cache-hit вкладки feed.
 *
 * @param {string | null | undefined} userId
 * @param {string[]} feedIds
 * @returns {boolean} true, если только что засеяли
 */
export function seedFeedSeenIfNeeded(userId, feedIds) {
  if (!userId || isFeedSeenInitialized(userId)) return false;
  const incoming = (Array.isArray(feedIds) ? feedIds : []).filter(
    (id) => typeof id === "string" && id.length > 0,
  );
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(incoming));
  } catch {
    /* quota / private mode */
  }
  return true;
}

/**
 * Добавить текущие id ленты в просмотренные (открытие «На ревью»).
 * Пустой список не трогает storage — иначе race при холодной загрузке сотрёт seen
 * (кроме seed через `seedFeedSeenIfNeeded`).
 *
 * @param {string | null | undefined} userId
 * @param {string[]} feedIds
 */
export function markFeedSeen(userId, feedIds) {
  if (!userId) return;
  const incoming = (Array.isArray(feedIds) ? feedIds : []).filter(
    (id) => typeof id === "string" && id.length > 0,
  );
  if (incoming.length === 0) return;
  const next = getFeedSeenIds(userId);
  for (const id of incoming) {
    next.add(id);
  }
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...next]));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Есть ли кейс в ленте, который ещё не отмечали на «На ревью».
 * Без инициализированного storage — false (сначала `seedFeedSeenIfNeeded`).
 *
 * @param {string | null | undefined} userId
 * @param {string[]} feedIds
 * @returns {boolean}
 */
export function hasUnseenFeed(userId, feedIds) {
  if (!isFeedSeenInitialized(userId)) return false;
  const ids = Array.isArray(feedIds) ? feedIds : [];
  if (ids.length === 0) return false;
  const seen = getFeedSeenIds(userId);
  return ids.some((id) => id && !seen.has(id));
}

/**
 * Сброс (logout). Без `userId` — все ключи префикса.
 *
 * @param {string | null | undefined} [userId]
 */
export function clearFeedSeen(userId) {
  if (userId) {
    try {
      window.localStorage.removeItem(storageKey(userId));
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
