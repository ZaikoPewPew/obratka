import { getSession, setSession } from "../app/session.js";
import { getAuthUserAvatarUrl } from "./auth.js";
import { fetchMyProfile, updateMyProfile } from "./profiles.js";

/** Награда за завершённое ревью (stub). */
export const REVIEW_REWARD = 1;

/** Стоимость подачи своего портфолио (stub). */
export const SUBMIT_COST = 1;

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
 * @param {number} next
 * @returns {Promise<number>}
 */
async function writeBalance(next) {
  const value = writeBalanceLocal(next);
  /* Persist не блокирует UI — локальный баланс уже обновлён. */
  void updateMyProfile({ balance: value }).catch((err) => {
    if (import.meta.env.DEV) {
      console.warn("[wallet] persist balance failed", err);
    }
  });
  return value;
}

/**
 * Подтянуть профиль из Supabase в local-сессию (имя, аватар, email, баланс…).
 * Если в profiles нет avatar_url — берём picture из Auth (Google/Telegram) и пишем в профиль.
 * @returns {Promise<import("../app/session.js").AppSession | null>}
 */
export async function refreshSessionFromProfile() {
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

  /** @type {import("../app/session.js").AppSession} */
  const next = {
    ...session,
    userId: profile.id || session.userId,
    email: profile.email ?? session.email,
    displayName: profile.display_name ?? session.displayName ?? null,
    avatarUrl,
    telegramId: profile.telegram_id ?? session.telegramId,
    telegramUsername: profile.telegram_username ?? session.telegramUsername,
    balance:
      typeof profile.balance === "number" && Number.isFinite(profile.balance)
        ? Math.max(0, Math.floor(profile.balance))
        : session.balance,
    reputation:
      typeof profile.reputation === "number" &&
      Number.isFinite(profile.reputation)
        ? Math.max(0, Math.floor(profile.reputation))
        : session.reputation,
    onboardingDone:
      typeof profile.onboarding_done === "boolean"
        ? profile.onboarding_done
        : session.onboardingDone,
    role: profile.role ?? session.role,
    grade: profile.grade ?? session.grade,
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
 * Начислить награду за ревью.
 * @returns {Promise<number>} новый баланс
 */
export async function awardReviewReward() {
  return writeBalance(getBalance() + REVIEW_REWARD);
}

/**
 * Начислить монеты (dev / тестирование).
 * @param {number} amount
 * @returns {Promise<number>} новый баланс
 */
export async function creditBalance(amount) {
  const n = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  if (n <= 0) return getBalance();
  return writeBalance(getBalance() + n);
}

/**
 * Списать стоимость подачи портфолио.
 * @returns {Promise<number>} новый баланс
 * @throws {Error} если недостаточно средств
 */
export async function spendSubmitCost() {
  if (!canSubmitPortfolio()) {
    throw new Error("wallet.spendSubmitCost: insufficient balance");
  }
  return writeBalance(getBalance() - SUBMIT_COST);
}
