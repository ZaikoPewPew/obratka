/**
 * Какие готовые отчёты (portfolio id) автор уже открывал на `/report`.
 * localStorage `obratka.reportOpened.<userId>` — карточка уезжает в «Архивные»
 * только после первого открытия отчёта.
 */

const STORAGE_PREFIX = "obratka.reportOpened.";

/**
 * @param {string} userId
 * @returns {string}
 */
function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId}`;
}

/**
 * @param {string | null | undefined} userId
 * @returns {Set<string>}
 */
export function getReportOpenedIds(userId) {
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
 * @param {string | null | undefined} userId
 * @param {string | null | undefined} portfolioId
 * @returns {boolean}
 */
export function isReportOpened(userId, portfolioId) {
  if (!userId || !portfolioId) return false;
  return getReportOpenedIds(userId).has(String(portfolioId));
}

/**
 * Пометить отчёт как открытый (первый заход на `/report` по id).
 *
 * @param {string | null | undefined} userId
 * @param {string | null | undefined} portfolioId
 */
export function markReportOpened(userId, portfolioId) {
  if (!userId || !portfolioId) return;
  const id = String(portfolioId);
  if (!id) return;
  const next = getReportOpenedIds(userId);
  if (next.has(id)) return;
  next.add(id);
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify([...next]));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Сброс (logout). Без `userId` — все ключи префикса.
 *
 * @param {string | null | undefined} [userId]
 */
export function clearReportOpened(userId) {
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
