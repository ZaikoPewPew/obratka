import { getSession, setSession } from "../app/session.js";

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
 * @param {number} next
 * @returns {number}
 */
function writeBalance(next) {
  const value = Math.max(0, Math.floor(next));
  const session = getSession() ?? {};
  setSession({ ...session, balance: value });
  return value;
}

/**
 * Начислить награду за ревью.
 * @returns {number} новый баланс
 */
export function awardReviewReward() {
  return writeBalance(getBalance() + REVIEW_REWARD);
}

/**
 * Списать стоимость подачи портфолио.
 * @returns {number} новый баланс
 * @throws {Error} если недостаточно средств
 */
export function spendSubmitCost() {
  if (!canSubmitPortfolio()) {
    throw new Error("wallet.spendSubmitCost: insufficient balance");
  }
  return writeBalance(getBalance() - SUBMIT_COST);
}
