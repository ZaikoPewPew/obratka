/** Дефолт target_reviews портфолио (зеркало portfolios.DEFAULT_TARGET_REVIEWS). */
const DEFAULT_TARGET_REVIEWS = 3;

/** Окно жалобы после done портфолио (зеркало SQL `review_complaint_window`). */
export const COMPLAINT_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function asIsoTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/**
 * Старт окна жалобы: `portfolios.completed_at`, иначе момент N-го ревью
 * (done / 3 из 3). Без валидного старта кнопку жалобы скрываем.
 *
 * @param {{
 *   completedAt?: string | null;
 *   targetReviews?: number | null;
 *   reviewCreatedAts?: Array<string | null | undefined> | null;
 * }} [input]
 * @returns {string | null} ISO timestamp
 */
export function resolveComplaintWindowStart(input = {}) {
  const fromCompleted = asIsoTimestamp(input.completedAt);
  if (fromCompleted) return fromCompleted;

  const target =
    typeof input.targetReviews === "number" &&
    Number.isFinite(input.targetReviews)
      ? Math.max(1, Math.floor(input.targetReviews))
      : DEFAULT_TARGET_REVIEWS;

  const sorted = (input.reviewCreatedAts || [])
    .map((value) => asIsoTimestamp(value))
    .filter(Boolean)
    .sort();

  if (sorted.length >= target) {
    return sorted[target - 1] ?? null;
  }
  return null;
}

/**
 * Deadline окна жалобы (ISO) или null, если старт битый.
 * Старт окна — `portfolios.completed_at` (момент done / 3 из 3),
 * с fallback на N-е ревью.
 * @param {string | null | undefined} completedAt
 * @param {{
 *   targetReviews?: number | null;
 *   reviewCreatedAts?: Array<string | null | undefined> | null;
 * }} [opts]
 * @returns {string | null}
 */
export function complaintOpenUntil(completedAt, opts = {}) {
  const startIso = resolveComplaintWindowStart({
    completedAt,
    targetReviews: opts.targetReviews,
    reviewCreatedAts: opts.reviewCreatedAts,
  });
  if (!startIso) return null;
  return new Date(Date.parse(startIso) + COMPLAINT_WINDOW_MS).toISOString();
}

/**
 * Можно ли ещё жаловаться на лист (клиентское зеркало окна 6ч от done).
 * @param {{
 *   completedAt?: string | null;
 *   complained?: boolean;
 *   targetReviews?: number | null;
 *   reviewCreatedAts?: Array<string | null | undefined> | null;
 * }} sheet
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function canComplainAboutReview(sheet, nowMs = Date.now()) {
  if (!sheet || sheet.complained) return false;
  const until = complaintOpenUntil(sheet.completedAt, {
    targetReviews: sheet.targetReviews,
    reviewCreatedAts: sheet.reviewCreatedAts,
  });
  if (!until) return false;
  const untilMs = Date.parse(until);
  if (!Number.isFinite(untilMs)) return false;
  return nowMs <= untilMs;
}
