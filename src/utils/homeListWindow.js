/**
 * Окно ленты home: в DOM только карточки вокруг вьюпорта.
 * Данные (до FEED_QUERY_LIMIT) остаются в памяти целиком — сорт
 * `sortFeedForSlotClosure` не ломаем. Страйд = высота карточки + gap списка.
 */

/** Запас карточек сверху и снизу от видимых. */
export const LIST_WINDOW_OVERSCAN = 4;

/**
 * Сколько карточек монтировать, пока нет валидного stride / clientHeight
 * (первый кадр до layout).
 */
export const LIST_WINDOW_FALLBACK_VISIBLE = 10;

/**
 * Ключ free-slot на «Мои → Разбор» (не портфолио id).
 * @param {number} index
 * @returns {string}
 */
export function emptySlotWindowKey(index) {
  return `__empty:${Math.max(0, Math.floor(Number(index) || 0))}`;
}

/**
 * Срез индексов [start, end) для виртуального списка.
 *
 * @param {number} scrollTop
 * @param {number} viewH
 * @param {number} count
 * @param {number} stride высота карточки + gap
 * @returns {{ start: number; end: number }}
 */
export function rangeForScroll(scrollTop, viewH, count, stride) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === 0) return { start: 0, end: 0 };

  const overscan = LIST_WINDOW_OVERSCAN;
  if (!(stride > 0)) {
    const fallback = LIST_WINDOW_FALLBACK_VISIBLE + overscan * 2;
    return { start: 0, end: Math.min(n, fallback) };
  }

  const y = Math.max(0, Number(scrollTop) || 0);
  const viewport = Math.max(0, Number(viewH) || 0);
  const visible =
    viewport > 0
      ? Math.max(1, Math.ceil(viewport / stride))
      : LIST_WINDOW_FALLBACK_VISIBLE;
  const firstVisible = Math.min(n - 1, Math.floor(y / stride));
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(n, firstVisible + visible + overscan);
  return { start, end };
}

/**
 * Padding списка, чтобы scrollHeight = полная лента (без spacer-li).
 * stride = высота карточки + flex gap.
 *
 * @param {number} start
 * @param {number} end
 * @param {number} count
 * @param {number} stride
 * @returns {{ paddingTop: number; paddingBottom: number }}
 */
export function listWindowPadding(start, end, count, stride) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === 0 || !(stride > 0)) {
    return { paddingTop: 0, paddingBottom: 0 };
  }
  const s = Math.max(0, Math.min(Math.floor(Number(start) || 0), n));
  const e = Math.max(s, Math.min(Math.floor(Number(end) || 0), n));
  return {
    paddingTop: s * stride,
    paddingBottom: (n - e) * stride,
  };
}
