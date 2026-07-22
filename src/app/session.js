const STORAGE_KEY = "obratka.session";

/**
 * @typedef {{
 *   userId?: string;
 *   email?: string;
 *   onboardingDone?: boolean;
 *   referralCode?: string | null;
 * }} AppSession
 */

/**
 * Локальная сессия пользователя (заглушка до Supabase Auth).
 * @returns {AppSession | null}
 */
export function getSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {AppSession} session
 */
export function setSession(session) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * @returns {boolean}
 */
export function hasSession() {
  return getSession() != null;
}
