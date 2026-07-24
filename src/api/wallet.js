import { getSession, setSession } from "../app/session.js";
import { getAuthUserAvatarUrl } from "./auth.js";
import { fetchMyProfile, updateMyProfile } from "./profiles.js";
import { getSupabase } from "../lib/supabaseClient.js";

/** Награда за завершённое ревью (начисляет сервер в handle_review_inserted). */
export const REVIEW_REWARD = 1;

/** Стоимость подачи своего портфолио (списывает RPC spend_submit_cost). */
export const SUBMIT_COST = 1;

/**
 * Инкремент при локальной мутации баланса (credit/spend), чтобы in-flight
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
 * После submit review: сервер уже начислил награду в триггере — только sync сессии.
 * @returns {Promise<number>} новый баланс
 */
export async function awardReviewReward() {
  return refreshWalletFromServer();
}

/**
 * Временно: клик по чипу баланса на home начисляет кости (RPC + локальный кэш).
 * Выключить / удалить RPC `temp_credit_balance` после тестов.
 */
export const TEMP_BALANCE_CHIP_CREDIT = true;

/** Сколько костей даёт один клик по чипу (temp / DEV). */
export const TEMP_BALANCE_CHIP_AMOUNT = 10;

/**
 * Temp / DEV: начислить кости. При `TEMP_BALANCE_CHIP_CREDIT` — RPC `temp_credit_balance`.
 * @param {number} amount
 * @returns {Promise<number>} новый баланс
 */
export async function creditBalance(amount) {
  if (!TEMP_BALANCE_CHIP_CREDIT && !import.meta.env.DEV) {
    return getBalance();
  }
  const n = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  if (n <= 0) return getBalance();

  const supabase = getSupabase();
  if (TEMP_BALANCE_CHIP_CREDIT && supabase) {
    const { data, error } = await supabase.rpc("temp_credit_balance", {
      p_amount: Math.floor(n),
    });
    const credited = coerceBalance(data);
    if (!error && credited != null) {
      walletMutationGen += 1;
      return writeBalanceLocal(credited);
    }
    console.warn(
      "[wallet] temp_credit_balance failed",
      error?.message || error || "bad_payload",
      data,
    );
  }

  /* Fallback без RPC: только localStorage (сотрётся на следующем удачном sync). */
  walletMutationGen += 1;
  return writeBalanceLocal(getBalance() + n);
}

/**
 * Списать стоимость подачи портфолио через RPC.
 * @returns {Promise<number>} новый баланс
 * @throws {Error} если недостаточно средств / не авторизован
 */
export async function spendSubmitCost() {
  if (!canSubmitPortfolio()) {
    throw new Error("wallet.spendSubmitCost: insufficient balance");
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const { data, error } = await supabase.rpc("spend_submit_cost");
  if (error) {
    const msg = String(error.message || "");
    if (/insufficient_balance/i.test(msg)) {
      throw new Error("wallet.spendSubmitCost: insufficient balance");
    }
    throw new Error(msg || "wallet.spend_failed");
  }

  const next =
    typeof data === "number" && Number.isFinite(data)
      ? Math.max(0, Math.floor(data))
      : getBalance() - SUBMIT_COST;
  walletMutationGen += 1;
  writeBalanceLocal(next);
  return next;
}
