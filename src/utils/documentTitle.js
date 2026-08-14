/**
 * `document.title` по маршруту SPA.
 *
 * Оркестрация — `applyRoute` / `syncRoute` в `main.js`. Экраны title не ставят.
 * Desktop-only гейт — override (`metaTitleDesktopOnly`), не роут.
 * Fallback без известного id — `metaTitle`.
 *
 * @typedef {import("../app/routes.js").AppRouteId} AppRouteId
 */

/** @type {Readonly<Record<AppRouteId, string>>} */
export const ROUTE_META_TITLE_KEYS = Object.freeze({
  referral: "metaTitleReferral",
  auth: "metaTitleAuth",
  authCode: "metaTitleAuthCode",
  onboarding: "metaTitleOnboarding",
  home: "metaTitleHome",
  settings: "metaTitleSettings",
  url: "metaTitleUrl",
  review: "metaTitleReview",
  quiz: "metaTitleQuiz",
  done: "metaTitleDone",
  success: "metaTitleSuccess",
  report: "metaTitleReport",
  banned: "metaTitleBanned",
  notFound: "metaTitleNotFound",
});

/** @type {AppRouteId | null} */
let lastRouteId = null;
/** @type {string | null} */
let overrideKey = null;
/** @type {Record<string, string>} */
let lastStrings = {};

/**
 * @param {string | null | undefined} routeId
 * @param {Record<string, string>} [strings]
 * @returns {string}
 */
export function titleForRoute(routeId, strings = {}) {
  const key =
    routeId && routeId in ROUTE_META_TITLE_KEYS
      ? ROUTE_META_TITLE_KEYS[/** @type {AppRouteId} */ (routeId)]
      : null;
  const title = (key && strings[key]) || strings.metaTitle || "";
  return String(title);
}

function paintDocumentTitle() {
  if (typeof document === "undefined") return;
  const t = lastStrings;
  if (overrideKey && t[overrideKey]) {
    document.title = t[overrideKey];
    return;
  }
  const title = titleForRoute(lastRouteId, t);
  if (title) document.title = title;
}

/**
 * Гейт «только с компьютера» и другие оверлеи поверх роута.
 * `null` снимает override и возвращает тайтл текущего экрана.
 *
 * @param {string | null} key
 * @param {Record<string, string>} [strings]
 */
export function setDocumentTitleOverride(key, strings) {
  overrideKey = key || null;
  if (strings) lastStrings = strings;
  paintDocumentTitle();
}

/**
 * Запомнить роут и выставить `document.title`.
 * Без `routeId` — перекрасить текущий (смена языка / снятие override).
 *
 * @param {AppRouteId | null | undefined} [routeId]
 * @param {Record<string, string>} [strings]
 */
export function applyDocumentTitle(routeId, strings) {
  if (routeId) lastRouteId = routeId;
  if (strings) lastStrings = strings;
  paintDocumentTitle();
}
