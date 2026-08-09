/**
 * Порядок продуктовых экранов и helper'ы входа.
 *
 * @typedef {import("./routes.js").AppRouteId} AppScreenId
 */

import { EMAIL_AUTH_ENABLED } from "../config/auth.js";
import { ROUTE_PATHS } from "./routes.js";

/** @type {readonly AppScreenId[]} */
export const APP_FLOW = Object.freeze([
  "referral",
  "auth",
  "authCode",
  "onboarding",
  "home",
]);

/**
 * Экраны рабочей сессии ревью (портфолио → квиз).
 * @type {readonly AppScreenId[]}
 */
export const SESSION_FLOW = Object.freeze([
  "url",
  "review",
  "quiz",
  "done",
]);

/**
 * Линейный порядок онбординга + сессии ревью.
 * Side-routes (`settings`, `success`, `report`, `banned`) сюда не входят — ими управляет `go` / access.
 * @type {readonly AppScreenId[]}
 */
export const FULL_FLOW = Object.freeze([...APP_FLOW, ...SESSION_FLOW]);

export { ROUTE_PATHS };

/**
 * Следующий экран в `FULL_FLOW` (не используется оркестрацией; left for debug/tests).
 * @deprecated Навигация только через `go` в `main.js`.
 * @param {AppScreenId} id
 * @returns {AppScreenId | null}
 */
export function getNextScreen(id) {
  const index = FULL_FLOW.indexOf(id);
  if (index < 0 || index >= FULL_FLOW.length - 1) return null;
  return FULL_FLOW[index + 1];
}

/**
 * Предыдущий экран в `FULL_FLOW`.
 * @deprecated Навигация только через `go` в `main.js`.
 * @param {AppScreenId} id
 * @returns {AppScreenId | null}
 */
export function getPreviousScreen(id) {
  const index = FULL_FLOW.indexOf(id);
  if (index <= 0) return null;
  return FULL_FLOW[index - 1];
}

/**
 * Стартовый экран по состоянию сессии (без учёта path).
 * @param {{
 *   hasSession?: boolean;
 *   onboardingDone?: boolean;
 *   referralDone?: boolean;
 *   banned?: boolean;
 * }} state
 * @returns {AppScreenId}
 */
export function resolveEntryScreen(state = {}) {
  const {
    hasSession = false,
    onboardingDone = false,
    referralDone = false,
    banned = false,
  } = state;

  if (banned) return "banned";
  if (hasSession && onboardingDone) return "home";
  if (hasSession && !onboardingDone) return "onboarding";
  if (referralDone) return "auth";
  return "referral";
}

/**
 * Экраны, которым нужен логин (`session.userId`).
 * Без сессии deep link → `resolveEntryScreen` (referral / auth).
 * @type {ReadonlySet<AppScreenId>}
 */
const AUTH_GATED_ROUTES = Object.freeze(
  new Set([
    "home",
    "settings",
    "onboarding",
    "report",
    "url",
    "success",
    "review",
    "quiz",
    "done",
  ]),
);

/**
 * Можно ли открыть deep link при текущем runtime-состоянии.
 * @param {AppScreenId} id
 * @param {{
 *   hasPortfolio?: boolean;
 *   hasSession?: boolean;
 *   onboardingDone?: boolean;
 *   referralDone?: boolean;
 *   banned?: boolean;
 * }} state
 * @returns {AppScreenId}
 */
export function resolveAccessibleRoute(id, state = {}) {
  const banned = Boolean(state.banned);
  const hasSession = Boolean(state.hasSession);
  const onboardingDone = Boolean(state.onboardingDone);

  if (banned) return "banned";

  if (id === "banned") {
    return resolveEntryScreen(state);
  }

  if (id === "authCode") {
    // Email OTP выключен — экран кода недоступен.
    if (!EMAIL_AUTH_ENABLED) return "auth";
    // Без pending email код-экран недоступен — назад на регистрацию.
    try {
      const pending = window.sessionStorage.getItem("obratka.pendingAuthEmail");
      if (!pending) return "auth";
    } catch {
      return "auth";
    }
  }

  // Invite-only: auth без кода / без device gate / без сессии → обратно на referral.
  if (
    (id === "auth" || id === "authCode") &&
    !hasSession &&
    !state.referralDone
  ) {
    return "referral";
  }

  // Защищённые маршруты: без логина → entry (referral / auth по state).
  if (AUTH_GATED_ROUTES.has(id) && !hasSession) {
    return resolveEntryScreen(state);
  }

  // Залогинен, онбординг не завершён — только onboarding (не home / report / …).
  if (
    hasSession &&
    !onboardingDone &&
    AUTH_GATED_ROUTES.has(id) &&
    id !== "onboarding"
  ) {
    return "onboarding";
  }

  const hasPortfolio = Boolean(state.hasPortfolio);

  if (id === "review" || id === "quiz" || id === "done") {
    if (!hasPortfolio) return "home";
  }

  return id;
}
