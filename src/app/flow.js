/**
 * Порядок продуктовых экранов до iframe-сессии.
 * Stub: константы и хелперы; монтирование — когда экраны подключены в main.js.
 *
 * @typedef {'referral' | 'auth' | 'onboarding' | 'home' | 'url' | 'session'} AppScreenId
 */

/** @type {readonly AppScreenId[]} */
export const APP_FLOW = Object.freeze([
  "referral",
  "auth",
  "onboarding",
  "home",
]);

/**
 * Экраны после home (уже реализованы в продукте).
 * @type {readonly AppScreenId[]}
 */
export const SESSION_FLOW = Object.freeze(["url", "session"]);

/**
 * @param {AppScreenId} id
 * @returns {AppScreenId | null}
 */
export function getNextScreen(id) {
  const full = [...APP_FLOW, ...SESSION_FLOW];
  const index = full.indexOf(id);
  if (index < 0 || index >= full.length - 1) return null;
  return full[index + 1];
}

/**
 * @param {{
 *   hasSession?: boolean;
 *   onboardingDone?: boolean;
 *   referralDone?: boolean;
 * }} state
 * @returns {AppScreenId}
 */
export function resolveEntryScreen(state = {}) {
  const {
    hasSession = false,
    onboardingDone = false,
    referralDone = false,
  } = state;

  if (hasSession && onboardingDone) return "home";
  if (hasSession && !onboardingDone) return "onboarding";
  if (referralDone) return "auth";
  return "referral";
}
