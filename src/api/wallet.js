import { getSession, setSession } from "../app/session.js";
import { getAuthUserAvatarUrl } from "./auth.js";
import { fetchMyProfile, updateMyProfile } from "./profiles.js";
import {
  clampReputation,
  settleReviewReputationRewards,
} from "./reviewComplaints.js";

/** Награда за завершённое ревью (начисляет сервер в handle_review_inserted). */
export const REVIEW_REWARD = 10;

/** Стоимость подачи своего портфолио (списывает RPC submit_portfolio). */
export const SUBMIT_COST = 30;

/**
 * Инкремент при локальной мутации баланса (submit), чтобы in-flight
 * refreshSessionFromProfile не затирал свежее значение устаревшим ответом.
 */
let walletMutationGen = 0;

/**
 * @returns {number}
 */
export function getBalance() {
  const session = getSession();
  const balance = session?.balance;
  return typeof balance === "number" && Number.isFinite(balance)
    ? Math.max(0, Math.floor(balance))
    : 0;
}

/**
 * @returns {boolean}
 */
export function canSubmitPortfolio() {
  return getBalance() >= SUBMIT_COST;
}

/**
 * Только localStorage-сессия (без записи в Supabase).
 * @param {number} next
 * @returns {number}
 */
function writeBalanceLocal(next) {
  const value = Math.max(0, Math.floor(next));
  const session = getSession() ?? {};
  setSession({ ...session, balance: value });
  return value;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function coerceBalance(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return null;
}

/**
 * Подтянуть профиль из Supabase в local-сессию (имя, аватар, email, баланс…).
 * Если в profiles нет avatar_url — берём picture из Auth (Google/Telegram) и пишем в профиль.
 * @returns {Promise<import("../app/session.js").AppSession | null>}
 */
export async function refreshSessionFromProfile() {
  const genAtStart = walletMutationGen;
  await settleReviewReputationRewards();
  const profile = await fetchMyProfile();
  if (!profile) return getSession();

  const session = getSession() ?? {};
  const profileAvatar =
    typeof profile.avatar_url === "string" ? profile.avatar_url.trim() : "";
  let avatarUrl =
    profileAvatar ||
    (typeof session.avatarUrl === "string" ? session.avatarUrl.trim() : "") ||
    null;

  if (!avatarUrl) {
    const fromAuth = await getAuthUserAvatarUrl();
    if (fromAuth) {
      avatarUrl = fromAuth;
      void updateMyProfile({ avatar_url: fromAuth }).catch((err) => {
        if (import.meta.env.DEV) {
          console.warn("[wallet] persist auth avatar", err);
        }
      });
    }
  }

  const serverBalance = coerceBalance(profile.balance);
  const keepLocalBalance = genAtStart !== walletMutationGen;

  /** @type {import("../app/session.js").AppSession} */
  const next = {
    ...session,
    userId: profile.id || session.userId,
    email: profile.email ?? session.email,
    displayName: profile.display_name ?? session.displayName ?? null,
    avatarUrl,
    telegramId: profile.telegram_id ?? session.telegramId,
    telegramUsername: profile.telegram_username ?? session.telegramUsername,
    balance: keepLocalBalance
      ? getBalance()
      : serverBalance != null
        ? serverBalance
        : session.balance,
    reputation:
      typeof profile.reputation === "number" &&
      Number.isFinite(profile.reputation)
        ? clampReputation(profile.reputation)
        : session.reputation,
    onboardingDone:
      typeof profile.onboarding_done === "boolean"
        ? profile.onboarding_done
        : session.onboardingDone,
    role: profile.role ?? session.role,
    grade:
      typeof profile.grade === "string" && profile.grade.trim()
        ? profile.grade.trim()
        : null,
    tier: profile.tier ?? session.tier ?? "free",
    banned: Boolean(profile.banned_at),
    myReferralCode:
      typeof profile.referral_code === "string"
        ? profile.referral_code
        : session.myReferralCode ?? null,
    referralUses:
      typeof profile.referral_uses === "number"
        ? profile.referral_uses
        : session.referralUses ?? 0,
  };
  setSession(next);
  return next;
}

/**
 * Подтянуть `profiles.balance` из Supabase в сессию.
 * @returns {Promise<number>}
 */
export async function refreshWalletFromServer() {
  await refreshSessionFromProfile();
  return getBalance();
}

/**
 * После submit review: сервер уже начислил награду в триггере — только sync сессии.
 * @returns {Promise<number>} новый баланс
 */
export async function awardReviewReward() {
  return refreshWalletFromServer();
}

/**
 * Записать баланс после atomic submit (RPC уже списал).
 * @param {number} next
 * @returns {number}
 */
export function applySubmitBalance(next) {
  const value =
    typeof next === "number" && Number.isFinite(next)
      ? Math.max(0, Math.floor(next))
      : getBalance();
  walletMutationGen += 1;
  return writeBalanceLocal(value);
}
