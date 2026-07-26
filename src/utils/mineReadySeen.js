/**
 * Какие готовые отчёты (portfolio id) пользователь уже «видел» в сегменте
 * «Завершённые». localStorage `obratka.mineReadySeen.<userId>` — точки на
 * «Мои посты» и на сегменте гаснут после открытия «Завершённые», загораются
 * снова только для новых 3/3.
 */

const STORAGE_PREFIX = "obratka.mineReadySeen.";

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
export function getMineReadySeenIds(userId) {
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
 * Добавить текущие готовые id в просмотренные (открытие «Завершённые»).
 * Пустой список не трогает storage — иначе race при холодной загрузке сотрёт seen.
 *
 * @param {string | null | undefined} userId
 * @param {string[]} readyIds
 */
export function markMineReadySeen(userId, readyIds) {
  if (!userId) return;
  const incoming = (Array.isArray(readyIds) ? readyIds : []).filter(
    (id) => typeof id === "string" && id.length > 0,
  );
  if (incoming.length === 0) return;
  const next = getMineReadySeenIds(userId);
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
 * Есть ли готовый отчёт, который ещё не отмечали в «Завершённые».
 *
 * @param {string | null | undefined} userId
 * @param {string[]} readyIds
 * @returns {boolean}
 */
export function hasUnseenMineReady(userId, readyIds) {
  const ids = Array.isArray(readyIds) ? readyIds : [];
  if (ids.length === 0) return false;
  const seen = getMineReadySeenIds(userId);
  return ids.some((id) => id && !seen.has(id));
}

/**
 * Сброс (logout). Без `userId` — все ключи префикса.
 *
 * @param {string | null | undefined} [userId]
 */
export function clearMineReadySeen(userId) {
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
