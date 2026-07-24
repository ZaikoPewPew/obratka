const STORAGE_KEY = "obratka.session";

/**
 * @typedef {{
 *   userId?: string;
 *   email?: string;
 *   onboardingDone?: boolean;
 *   referralCode?: string | null;
 *   myReferralCode?: string | null;
 *   referralUses?: number;
 *   balance?: number;
 *   reputation?: number;
 *   telegramId?: number;
 *   telegramUsername?: string | null;
 *   displayName?: string | null;
 *   avatarUrl?: string | null;
 *   role?: string | null;
 *   grade?: string | null;
 *   tier?: 'free' | 'pro' | 'legendary';
 *   banned?: boolean;
 * }} AppSession
 */

/**
 * Локальная сессия приложения (поверх Supabase Auth session в supabase-js).
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
