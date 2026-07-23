import { getSession, setSession } from "../app/session.js";
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
  try {
    await updateMyProfile({ balance: value });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[wallet] persist balance failed", err);
    }
  }
  return value;
}

/**
 * Подтянуть `profiles.balance` из Supabase в сессию.
 * @returns {Promise<number>}
 */
export async function refreshWalletFromServer() {
  const profile = await fetchMyProfile();
  if (profile && typeof profile.balance === "number" && Number.isFinite(profile.balance)) {
    return writeBalanceLocal(profile.balance);
  }
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
