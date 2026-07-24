import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/cyrillic-400.css";
import "@fontsource/montserrat/cyrillic-500.css";
import "@fontsource/montserrat/cyrillic-600.css";
import "@fontsource/montserrat/cyrillic-ext-400.css";
import "@fontsource/montserrat/cyrillic-ext-500.css";
import "@fontsource/montserrat/cyrillic-ext-600.css";

import {
  applyDocumentI18n,
  formatString,
  getStrings,
} from "./i18n.js";
import {
  resolveAccessibleRoute,
  resolveEntryScreen,
} from "./app/flow.js";
import { createAppRouter } from "./app/router.js";
import { getSession, setSession, clearSession } from "./app/session.js";
import { completeOAuthFromUrl, signOut } from "./api/auth.js";
import { submitPortfolio, clearSubmittedPortfolios, submitPortfolioReview, claimPortfolioReview, heartbeatPortfolioClaim, releasePortfolioClaim, portfolioRpcErrorCode } from "./api/portfolios.js";
import { fetchMyProfile, isProfileBanned, updateMyProfile } from "./api/profiles.js";
import {
  redeemReferral,
  validateReferral,
} from "./api/referrals.js";
import {
  awardReviewReward,
  canSubmitPortfolio,
  refreshSessionFromProfile,
  spendSubmitCost,
} from "./api/wallet.js";
import { createReviewPanel } from "./components/review-panel/ReviewPanel.js";
import { createReviewScreen } from "./components/review-screen/ReviewScreen.js";
import { createAuthScreen } from "./components/auth-screen/AuthScreen.js";
import { createAuthCodeScreen } from "./components/auth-code-screen/AuthCodeScreen.js";
import { createHomeScreen } from "./components/home-screen/HomeScreen.js";
import { createOnboardingScreen } from "./components/onboarding-screen/OnboardingScreen.js";
import { createReferralScreen } from "./components/referral-screen/ReferralScreen.js";
import { createSuccessScreen } from "./components/success-screen/SuccessScreen.js";
import { createReportScreen } from "./components/report-screen/ReportScreen.js";
import { createBanScreen } from "./components/ban-screen/BanScreen.js";
import { createUrlScreen } from "./components/url-screen/UrlScreen.js";
import {
  resolvePortfolioEmbed,
} from "./utils/portfolioEmbed.js";
import { resolvePortfolioMeta } from "./utils/portfolioMeta.js";
import { getMotionFocusDelayMs } from "./utils/motionTokens.js";
import brandLogoUrl from "./assets/brand/logo.svg";

const SESSION_SECONDS = 10;
const SESSION_TOTAL_MS = SESSION_SECONDS * 1000;
const TIMER_TICK_MS = 10;
/** Продление claim TTL, пока пользователь на review/quiz. */
const CLAIM_HEARTBEAT_MS = 2 * 60 * 1000;

const frameWrap = document.querySelector("[data-frame]");
const frame = document.querySelector("#portfolio-frame");
const externalViewer = document.querySelector("[data-external-viewer]");
const externalBodyEl = document.querySelector("[data-external-body]");
const openExternalBtn = document.querySelector('[data-action="open-external"]');
const timerEl = document.querySelector("[data-timer]");
const avatarEl = document.querySelector("[data-portfolio-avatar]");
const nameEl = document.querySelector("[data-portfolio-name]");
const frameReloadBtn = document.querySelector('[data-action="reload-frame"]');
const frameBackBtn = document.querySelector('[data-action="frame-back"]');
const frameForwardBtn = document.querySelector('[data-action="frame-forward"]');

/** @type {string | null} */
let portfolioUrl = null;
/** @type {string | null} */
let portfolioId = null;
/** Активный claim на portfolioId (нужно release при уходе без submit). */
let claimHeld = false;
/** Ревью уже отправлено — claim не освобождаем (триггер снял его). */
let reviewSubmitted = false;
/** @type {Promise<void> | null} */
let reviewSubmitPromise = null;
/** @type {ReturnType<typeof window.setInterval> | null} */
let claimHeartbeatId = null;
/** @type {import("./utils/portfolioEmbed.js").PortfolioEmbedPlan | null} */
let embedPlan = null;
/** @type {string} */
let portfolioName = getStrings().brandName;

/** @type {string | null} */
let pendingReportPortfolioId = null;

/** @type {ReturnType<typeof createReviewScreen>["setReportReveal"]} */
let setReviewReportReveal = () => {};

/** @type {import("./app/routes.js").AppRouteId | null} */
let activeRouteId = null;
/** @type {boolean} */
let pendingHandoff = false;
/** @type {import("./components/success-screen/successPresets.js").SuccessPresetId} */
let pendingSuccessPreset = "generic";

/** @type {ReturnType<typeof createAppRouter> | null} */
let appRouter = null;

/**
 * @param {import("./app/routes.js").AppRouteId} id
 * @param {{
 *   replace?: boolean;
 *   handoff?: boolean;
 *   search?: string | URLSearchParams | Record<string, string | null | undefined>;
 * }} [opts]
 */
function go(id, opts = {}) {
  const session = getSession();
  if (session?.banned && id !== "banned") {
    id = "banned";
    opts = { ...opts, replace: true, handoff: false };
  }
  pendingHandoff = Boolean(opts.handoff);
  appRouter?.navigate(id, {
    replace: opts.replace,
    search: opts.search,
  });
}

/**
 * @param {import("./app/routes.js").AppRouteId} id
 * @param {{
 *   replace?: boolean;
 *   search?: string | URLSearchParams | Record<string, string | null | undefined>;
 * }} [opts]
 */
function syncRoute(id, opts = {}) {
  activeRouteId = id;
  appRouter?.sync(id, opts);
}

const reviewPanel = createReviewPanel({
  getPortfolioName: () => portfolioName,
  onReportReveal: (active, payload) => {
    setReviewReportReveal(active, payload);
  },
  onComplete: (answers) => {
    reviewSubmitPromise = (async () => {
      try {
        if (portfolioId) {
          await submitPortfolioReview(portfolioId, answers ?? null);
          reviewSubmitted = true;
          claimHeld = false;
          stopClaimHeartbeat();
          await awardReviewReward();
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("[review] submitPortfolioReview", err);
        }
      } finally {
        reviewSubmitPromise = null;
      }
    })();
  },
  onDoneChange: (done) => {
    if (done) {
      if (activeRouteId !== "done") syncRoute("done");
      return;
    }
    if (activeRouteId === "done") syncRoute("quiz");
  },
  onExit: () => {
    void (async () => {
      const pending = reviewSubmitPromise;
      if (pending) {
        await pending.catch(() => {});
      }
      await releaseHeldClaim();
      go("home", { replace: true });
    })();
  },
  onNextCase: () => {
    void (async () => {
      const pending = reviewSubmitPromise;
      if (pending) {
        await pending.catch(() => {});
      }
      await releaseHeldClaim();
      go("home", { replace: true });
    })();
  },
});
const reviewScreen = createReviewScreen({
  content: reviewPanel.root,
});
setReviewReportReveal = reviewScreen.setReportReveal;
document.body.append(reviewScreen.root);

const successScreen = createSuccessScreen({
  onPrimary: () => {
    pendingSuccessPreset = "generic";
    go("home", { replace: true });
  },
  onSecondary: () => {
    pendingSuccessPreset = "generic";
    go("home", { replace: true });
  },
});
document.body.append(successScreen.root);

const reportScreen = createReportScreen({
  onPrimary: () => {
    pendingReportPortfolioId = null;
    go("home", { replace: true });
  },
});
document.body.append(reportScreen.root);

const banScreen = createBanScreen({
  onExit: async () => {
    try {
      await signOut();
    } catch {
      /* всё равно чистим локальное состояние */
    }
    clearSession();
    clearSubmittedPortfolios();
    stopTimer();
    portfolioUrl = null;
    portfolioId = null;
    claimHeld = false;
    reviewSubmitted = false;
    stopClaimHeartbeat();
    embedPlan = null;
    portfolioName = getStrings().brandName;
    pendingSuccessPreset = "generic";
    pendingReportPortfolioId = null;
    leaveSessionShell();
    await closeReview();
    go("referral", { replace: true });
  },
});
document.body.append(banScreen.root);

let remainingMs = SESSION_TOTAL_MS;
let timerId = null;
let sessionEnded = false;
/** Таймер уже запущен в текущей сессии (для external — после кнопки). */
let sessionStarted = false;
/** @type {number} */
let metaRequestId = 0;

function stopClaimHeartbeat() {
  if (claimHeartbeatId != null) {
    window.clearInterval(claimHeartbeatId);
    claimHeartbeatId = null;
  }
}

function startClaimHeartbeat() {
  stopClaimHeartbeat();
  if (!portfolioId || !claimHeld) return;
  claimHeartbeatId = window.setInterval(() => {
    if (!portfolioId || !claimHeld || reviewSubmitted) {
      stopClaimHeartbeat();
      return;
    }
    void heartbeatPortfolioClaim(portfolioId).catch((err) => {
      if (import.meta.env.DEV) {
        console.warn("[review] heartbeat", err);
      }
    });
  }, CLAIM_HEARTBEAT_MS);
}

/**
 * Освободить claim, если ревью не отправлено.
 * @returns {Promise<void>}
 */
async function releaseHeldClaim() {
  stopClaimHeartbeat();
  if (!claimHeld || reviewSubmitted || !portfolioId) {
    claimHeld = false;
    return;
  }
  const id = portfolioId;
  claimHeld = false;
  await releasePortfolioClaim(id);
}

/**
 * Сброс локальной review-сессии после ухода с /review|/quiz|/done.
 * Claim к этому моменту уже released или снят триггером после submit.
 */
function clearReviewSessionState() {
  stopTimer();
  sessionEnded = false;
  sessionStarted = false;
  remainingMs = SESSION_TOTAL_MS;
  renderTimer();
  portfolioUrl = null;
  portfolioId = null;
  reviewSubmitted = false;
  reviewSubmitPromise = null;
  claimHeld = false;
  embedPlan = null;
  portfolioName = getStrings().brandName;
}

function formatTime(totalMs) {
  const clampedMs = Math.max(0, totalMs);
  const minutes = Math.floor(clampedMs / 60000);
  const seconds = Math.floor((clampedMs % 60000) / 1000);
  const centiseconds = Math.floor((clampedMs % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(centiseconds).padStart(2, "0")}`;
}

function renderTimer() {
  if (timerEl) {
    timerEl.textContent = formatTime(remainingMs);
  }
}

function syncLocaleDependentAttrs() {
  const t = getStrings();

  if (frame) {
    frame.title = formatString(t.iframeTitle, { name: portfolioName });
  }

  if (externalBodyEl && embedPlan?.mode === "external") {
    externalBodyEl.textContent = formatString(t.embedBlockedBody, {
      host: embedPlan.hostLabel,
    });
  }
}

function openPortfolioExternally() {
  if (!embedPlan?.openUrl) return;
  window.open(embedPlan.openUrl, "_blank", "noopener,noreferrer");
}

/**
 * @param {import("./utils/portfolioEmbed.js").PortfolioEmbedPlan} plan
 */
function applyEmbedPlan(plan) {
  embedPlan = plan;

  if (!frame || !frameWrap || !externalViewer) return;

  const isExternal = plan.mode === "external";
  frameWrap.classList.toggle("iframe-shell__frame--external", isExternal);
  externalViewer.hidden = !isExternal;
  externalViewer.setAttribute("aria-hidden", isExternal ? "false" : "true");

  if (isExternal) {
    frame.removeAttribute("allow");
    frame.removeAttribute("allowfullscreen");
    frame.src = "about:blank";
    syncLocaleDependentAttrs();
    return;
  }

  if (plan.allowFullscreen) {
    frame.setAttribute("allow", "fullscreen");
    frame.setAttribute("allowfullscreen", "");
  } else {
    frame.removeAttribute("allow");
    frame.removeAttribute("allowfullscreen");
  }

  frame.src = plan.frameSrc || "about:blank";
}

function showBrandChrome() {
  const t = getStrings();
  portfolioName = t.brandName;
  if (nameEl) {
    nameEl.textContent = t.brandName;
  }
  if (avatarEl) {
    avatarEl.onerror = null;
    avatarEl.onload = null;
    avatarEl.classList.remove("iframe-shell__avatar--broken");
    avatarEl.classList.add("iframe-shell__avatar--brand");
    avatarEl.src = brandLogoUrl;
    avatarEl.alt = t.brandLogoAlt;
  }
  syncLocaleDependentAttrs();
}

function syncPortfolioChrome({ label, favicon, faviconFallbacks = [] }) {
  portfolioName = label;
  if (nameEl) {
    nameEl.textContent = label;
  }
  setPortfolioAvatar(favicon, faviconFallbacks);
  syncLocaleDependentAttrs();
}

/**
 * @param {string} primary
 * @param {string[]} [fallbacks]
 */
function setPortfolioAvatar(primary, fallbacks = []) {
  if (!avatarEl) return;

  const queue = [primary, ...fallbacks].filter(Boolean);
  avatarEl.classList.remove("iframe-shell__avatar--broken", "iframe-shell__avatar--brand");
  avatarEl.alt = "";

  const tryNext = () => {
    const next = queue.shift();
    if (!next) {
      avatarEl.removeAttribute("src");
      avatarEl.classList.add("iframe-shell__avatar--broken");
      return;
    }
    avatarEl.src = next;
  };

  avatarEl.onerror = tryNext;
  avatarEl.onload = () => {
    // 1×1 / пустые заглушки части CDN — считаем провалом и пробуем следующий кандидат.
    if (avatarEl.naturalWidth < 8 || avatarEl.naturalHeight < 8) {
      tryNext();
      return;
    }
    avatarEl.classList.remove("iframe-shell__avatar--broken");
  };
  tryNext();
}

/**
 * @param {string} url
 * @param {{ openExternal?: boolean; portfolioId?: string | null }} [options]
 */
async function applyPortfolio(url, options = {}) {
  portfolioUrl = url;
  portfolioId =
    typeof options.portfolioId === "string" && options.portfolioId.trim()
      ? options.portfolioId.trim()
      : null;
  const requestId = ++metaRequestId;
  const plan = resolvePortfolioEmbed(url);

  applyEmbedPlan(plan);

  if (options.openExternal && plan.mode === "external") {
    openPortfolioExternally();
  }

  const meta = await resolvePortfolioMeta(url);
  if (requestId !== metaRequestId) return;
  syncPortfolioChrome(meta);
}

function openReview() {
  /* Только живая review-сессия с claim — иначе ghost-quiz после abort. */
  if (!frameWrap || activeRouteId !== "review" || !claimHeld || reviewSubmitted) {
    return;
  }

  void homeScreen.close();
  void urlScreen.close();
  void onboardingScreen.close({ handoff: true });
  void authScreen.close({ handoff: true });
  void referralScreen.close({ handoff: true });
  void successScreen.close();
  void reportScreen.close();

  frameWrap.classList.add("iframe-shell__frame--locked");
  reviewPanel.reset();
  reviewPanel.open();
  reviewScreen.open();
  syncRoute("quiz");

  window.setTimeout(() => {
    reviewPanel.focus();
  }, getMotionFocusDelayMs());
}

async function closeReview() {
  if (!frameWrap) return;

  frameWrap.classList.remove("iframe-shell__frame--locked");
  reviewPanel.close();
  await reviewScreen.close();
  reviewPanel.reset();
}

function lockFrameAndShowReview() {
  if (!frameWrap || !frame || sessionEnded) return;
  if (activeRouteId !== "review" || !claimHeld || reviewSubmitted) return;
  sessionEnded = true;
  openReview();
}

function tick() {
  remainingMs -= TIMER_TICK_MS;
  renderTimer();

  if (remainingMs <= 0) {
    stopTimer();
    remainingMs = 0;
    renderTimer();
    lockFrameAndShowReview();
  }
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

/** Сбросить таймер на полный срок без запуска (ждём кнопку во external). */
function armSession() {
  stopTimer();
  remainingMs = SESSION_TOTAL_MS;
  sessionEnded = false;
  sessionStarted = false;
  renderTimer();
}

function startTimer() {
  stopTimer();
  remainingMs = SESSION_TOTAL_MS;
  sessionEnded = false;
  sessionStarted = true;
  renderTimer();
  timerId = window.setInterval(tick, TIMER_TICK_MS);
}

/**
 * Кнопка во фрейме: открыть портфолио снаружи и стартовать таймер один раз.
 */
function startExternalSession() {
  openPortfolioExternally();
  if (!sessionStarted && !sessionEnded) {
    startTimer();
  }
}

function navigateFrame(action) {
  if (!frame || !portfolioUrl || !embedPlan) return;

  if (embedPlan.mode === "external") {
    openPortfolioExternally();
    return;
  }

  try {
    action(frame.contentWindow);
  } catch {
    frame.src = embedPlan.frameSrc || portfolioUrl;
  }
}

const shell = document.querySelector(".iframe-shell");

/**
 * Показать оболочку сессии ревью под уходящим экраном ссылки.
 */
function enterSessionShell() {
  if (!shell) return;
  shell.hidden = false;
  shell.classList.remove("iframe-shell--entered");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      shell.classList.add("iframe-shell--entered");
    });
  });
}

function leaveSessionShell() {
  if (!shell) return;
  shell.hidden = true;
  shell.classList.remove("iframe-shell--entered");
}

const urlScreen = createUrlScreen({
  onSubmit: async (url) => {
    if (!canSubmitPortfolio()) {
      go("home", { replace: true });
      throw new Error("url.submit_locked");
    }
    /* URL сразу; persist в фоне — done-UI на url-screen не ждёт сеть. */
    syncRoute("success", { replace: true });
    try {
      await spendSubmitCost();
      await submitPortfolio(url);
    } catch {
      go("home", { replace: true });
      throw new Error("url.submit_failed");
    }
  },
  onExit: () => {
    go("home", { replace: true });
  },
});

const homeScreen = createHomeScreen({
  onOpenPortfolio: async (item) => {
    if (item?.isOwn) return;
    const id = typeof item?.id === "string" ? item.id : "";
    if (!id) return;

    if (item?.reviewedByMe) {
      const t = getStrings();
      homeScreen.showNotice({
        title: t.homeAlreadyReviewedTitle,
        body: t.homeAlreadyReviewedBody,
        closeLabel: t.homeAlreadyReviewedClose,
        closeAria: t.homeAlreadyReviewedCloseAria,
      });
      return;
    }

    try {
      await claimPortfolioReview(id);
    } catch (err) {
      const code = portfolioRpcErrorCode(err);
      if (code === "no_slots") {
        const t = getStrings();
        homeScreen.showNotice({
          title: t.homeNoSlotsTitle,
          body: t.homeNoSlotsBody,
          closeLabel: t.homeNoSlotsClose,
          closeAria: t.homeNoSlotsCloseAria,
        });
        void homeScreen.refresh();
        return;
      }
      if (code === "already_reviewed") {
        const t = getStrings();
        homeScreen.showNotice({
          title: t.homeAlreadyReviewedTitle,
          body: t.homeAlreadyReviewedBody,
          closeLabel: t.homeAlreadyReviewedClose,
          closeAria: t.homeAlreadyReviewedCloseAria,
        });
        void homeScreen.refresh();
        return;
      }
      if (import.meta.env.DEV) {
        console.warn("[review] claimPortfolioReview", err);
      }
      void homeScreen.refresh();
      return;
    }

    claimHeld = true;
    reviewSubmitted = false;
    reviewSubmitPromise = null;
    enterSessionShell();
    await closeReview();
    await applyPortfolio(item.url, { portfolioId: id });
    startClaimHeartbeat();
    go("review");
    void homeScreen.close();
    if (embedPlan?.mode === "external") {
      armSession();
      return;
    }
    startTimer();
  },
  onOpenReport: async (item) => {
    if (!item?.isOwn || !item.id) return;
    pendingReportPortfolioId = item.id;
    go("report", { search: { id: item.id } });
  },
  onAddPortfolio: async () => {
    if (!canSubmitPortfolio()) return;
    go("url");
  },
  onResetSession: async () => {
    try {
      await signOut();
    } catch {
      /* Dev reset: всё равно чистим локальное состояние */
    }
    clearSession();
    clearSubmittedPortfolios();
    setPendingAuthEmail(null);
    try {
      window.sessionStorage.removeItem("obratka.authProviderError");
    } catch {
      /* ignore */
    }
    stopTimer();
    await releaseHeldClaim();
    portfolioUrl = null;
    portfolioId = null;
    embedPlan = null;
    portfolioName = getStrings().brandName;
    pendingSuccessPreset = "generic";
    pendingReportPortfolioId = null;
    leaveSessionShell();
    await closeReview();
    void homeScreen.close();
    go("referral", { replace: true });
  },
});

const onboardingScreen = createOnboardingScreen({
  onComplete: async (answers) => {
    const session = getSession() ?? {};
    setSession({
      ...session,
      onboardingDone: true,
      role: typeof answers?.role === "string" ? answers.role : session.role,
      grade: typeof answers?.grade === "string" ? answers.grade : session.grade,
    });
    go("home", { replace: true, handoff: true });
  },
});

/**
 * Persist Supabase user into app session (OAuth return / provider login).
 * @param {{
 *   userId: string;
 *   email?: string | null;
 *   telegramId?: number;
 *   username?: string | null;
 *   firstName?: string | null;
 *   photoUrl?: string | null;
 * }} user
 * @param {'google' | 'telegram' | 'email'} provider
 * @returns {Promise<import("./app/session.js").AppSession>}
 */
async function applyProviderUser(user, provider) {
  const session = getSession() ?? {};
  /** @type {import("./app/session.js").AppSession} */
  let next = {
    ...session,
    userId: user.userId,
    email: user.email ?? session.email,
    balance: typeof session.balance === "number" ? session.balance : 0,
    displayName: user.firstName ?? null,
    avatarUrl: user.photoUrl ?? null,
    ...(provider === "telegram"
      ? {
          telegramId: user.telegramId,
          telegramUsername: user.username ?? null,
        }
      : {}),
  };

  const profile = await fetchMyProfile();
  if (profile) {
    const photoFromAuth =
      typeof user.photoUrl === "string" ? user.photoUrl.trim() : "";
    const profileAvatar =
      typeof profile.avatar_url === "string" ? profile.avatar_url.trim() : "";
    if (photoFromAuth && !profileAvatar) {
      void updateMyProfile({ avatar_url: photoFromAuth }).catch(() => {});
    }

    next = {
      ...next,
      userId: profile.id || next.userId,
      email: profile.email ?? next.email,
      displayName: profile.display_name ?? next.displayName,
      avatarUrl: profileAvatar || photoFromAuth || next.avatarUrl,
      telegramId: profile.telegram_id ?? next.telegramId,
      telegramUsername: profile.telegram_username ?? next.telegramUsername,
      balance:
        typeof profile.balance === "number" ? profile.balance : next.balance,
      reputation:
        typeof profile.reputation === "number"
          ? profile.reputation
          : next.reputation,
      onboardingDone: Boolean(profile.onboarding_done),
      role: profile.role ?? next.role,
      grade: profile.grade ?? next.grade,
      tier: profile.tier ?? next.tier ?? "free",
      banned: isProfileBanned(profile),
      myReferralCode:
        typeof profile.referral_code === "string"
          ? profile.referral_code
          : next.myReferralCode ?? null,
      referralUses:
        typeof profile.referral_uses === "number"
          ? profile.referral_uses
          : next.referralUses ?? 0,
    };
  } else {
    // Do not trust “not banned” when profile fetch failed — keep prior flag.
    next = {
      ...next,
      banned: Boolean(session.banned),
    };
  }

  const pendingCode =
    typeof next.referralCode === "string" ? next.referralCode.trim() : "";
  if (pendingCode) {
    const redeemed = await redeemReferral(pendingCode);
    if (!redeemed.ok && import.meta.env.DEV) {
      console.warn("[referrals] redeem after auth", redeemed.reason);
    }
  }

  setSession(next);
  return next;
}

/** @type {string | null} */
let pendingAuthEmail = null;

const PENDING_AUTH_EMAIL_KEY = "obratka.pendingAuthEmail";

/**
 * @param {string | null} email
 */
function setPendingAuthEmail(email) {
  pendingAuthEmail = email;
  try {
    if (email) {
      window.sessionStorage.setItem(PENDING_AUTH_EMAIL_KEY, email);
    } else {
      window.sessionStorage.removeItem(PENDING_AUTH_EMAIL_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * @returns {string | null}
 */
function getPendingAuthEmail() {
  if (pendingAuthEmail) return pendingAuthEmail;
  try {
    const stored = window.sessionStorage.getItem(PENDING_AUTH_EMAIL_KEY);
    if (stored) {
      pendingAuthEmail = stored;
      return stored;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const authScreen = createAuthScreen({
  onSuccess: async (result) => {
    if (result.type === "email-otp-sent") {
      setPendingAuthEmail(result.email);
      go("authCode", { handoff: true });
      return;
    }
    if (result.type === "telegram" || result.type === "google") {
      setPendingAuthEmail(null);
      const next = await applyProviderUser(result, result.type);
      if (next.banned) {
        go("banned", { replace: true });
        return;
      }
      if (next.onboardingDone) {
        go("home", { handoff: true });
        return;
      }
      go("onboarding", { handoff: true });
    }
  },
});

const authCodeScreen = createAuthCodeScreen({
  onSuccess: async (result) => {
    setPendingAuthEmail(null);
    const next = await applyProviderUser(result, "email");
    if (next.banned) {
      go("banned", { replace: true });
      return;
    }
    if (next.onboardingDone) {
      go("home", { handoff: true });
      return;
    }
    go("onboarding", { handoff: true });
  },
  onBack: () => {
    go("auth", { handoff: true });
  },
});

const referralScreen = createReferralScreen({
  onSubmit: async (referral) => {
    const result = await validateReferral(referral);
    if (!result.ok) {
      const err = new Error(result.reason);
      /** @type {{ reason: string }} */ (err).reason = result.reason;
      throw err;
    }
    const session = getSession() ?? {};
    setSession({ ...session, referralCode: result.code });
    go("auth", { handoff: true });
  },
});

document.body.append(
  referralScreen.root,
  authScreen.root,
  authCodeScreen.root,
  onboardingScreen.root,
  homeScreen.root,
  urlScreen.root,
);

/**
 * @param {import("./app/routes.js").AppRouteId} id
 * @param {{ handoff?: boolean }} [opts]
 */
async function applyRoute(id, opts = {}) {
  const handoff = Boolean(opts.handoff);
  let session = getSession();

  if (session?.userId) {
    try {
      session = (await refreshSessionFromProfile()) ?? session;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[session] refresh before route", err);
      }
    }
  }

  let accessible = resolveAccessibleRoute(id, {
    hasPortfolio: Boolean(portfolioUrl),
    hasSession: Boolean(session?.userId),
    onboardingDone: Boolean(session?.onboardingDone),
    referralDone: Boolean(session?.referralCode),
    banned: Boolean(session?.banned),
  });

  if (accessible === "url" && !canSubmitPortfolio()) {
    accessible = "home";
  }

  if (accessible !== id) {
    syncRoute(accessible, { replace: true });
    id = accessible;
  }

  activeRouteId = id;
  const closeOpts = handoff ? { handoff: true } : {};
  const openOpts = handoff ? { handoff: true } : {};

  const isReviewWorkspace = id === "review" || id === "quiz" || id === "done";
  const isBrandHandoff =
    handoff &&
    (id === "referral" ||
      id === "auth" ||
      id === "authCode" ||
      id === "onboarding" ||
      id === "url");
  /** Brand → home: открыть home снизу, brand уходит fade (не instant handoff). */
  const isHomeReveal = id === "home" && handoff;

  /**
   * @param {import("./app/routes.js").AppRouteId} target
   */
  function openTarget(target) {
    if (target === "referral") {
      const ref =
        new URLSearchParams(window.location.search).get("ref") ?? "";
      referralScreen.open(ref, openOpts);
      return;
    }
    if (target === "auth") {
      authScreen.open(openOpts);
      return;
    }
    if (target === "authCode") {
      const email = getPendingAuthEmail() ?? "";
      authCodeScreen.open(email, openOpts);
      return;
    }
    if (target === "onboarding") {
      onboardingScreen.open(openOpts);
      return;
    }
    if (target === "home") {
      void homeScreen.open();
      return;
    }
    if (target === "url") {
      urlScreen.open("", openOpts);
      return;
    }
    if (target === "success") {
      successScreen.open({ preset: pendingSuccessPreset });
      return;
    }
    if (target === "report") {
      const fromSearch =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("id")
          : null;
      const id = pendingReportPortfolioId || fromSearch || null;
      reportScreen.open({ portfolioId: id });
      return;
    }
    if (target === "banned") {
      banScreen.open();
    }
  }

  async function closeOthers() {
    /** @type {Array<Promise<void> | void>} */
    const closers = [];
    if (id !== "referral") closers.push(referralScreen.close(closeOpts));
    if (id !== "auth") closers.push(authScreen.close(closeOpts));
    if (id !== "authCode") closers.push(authCodeScreen.close(closeOpts));
    if (id !== "onboarding") closers.push(onboardingScreen.close(closeOpts));
    if (id !== "home") closers.push(homeScreen.close());
    if (id !== "url") closers.push(urlScreen.close(closeOpts));
    if (id !== "success") closers.push(successScreen.close());
    if (id !== "report") closers.push(reportScreen.close());
    if (id !== "banned") closers.push(banScreen.close());
    await Promise.all(closers);
  }

  if (id === "banned") {
    leaveSessionShell();
    await releaseHeldClaim();
    clearReviewSessionState();
    await closeReview();
    await closeOthers();
    openTarget("banned");
    return;
  }

  if (isReviewWorkspace) {
    enterSessionShell();
    await closeOthers();

    if (id === "review") return;

    frameWrap?.classList.add("iframe-shell__frame--locked");
    reviewScreen.open();
    reviewPanel.open();
    if (id === "done") {
      reviewPanel.openDone();
      return;
    }
    reviewPanel.reset();
    reviewPanel.open();
    window.setTimeout(() => {
      reviewPanel.focus();
    }, getMotionFocusDelayMs());
    return;
  }

  leaveSessionShell();
  await releaseHeldClaim();
  clearReviewSessionState();
  await closeReview();

  // Handoff: сначала новый экран поверх, потом убрать предыдущий — visual не мигает.
  if (isBrandHandoff) {
    openTarget(id);
    await closeOthers();
    return;
  }

  // Onboarding → home: home снизу/поверх с fade-in, brand уходит fade-out.
  if (isHomeReveal) {
    const opening = homeScreen.open();
    await Promise.all([
      opening,
      referralScreen.close({}),
      authScreen.close({}),
      authCodeScreen.close({}),
      onboardingScreen.close({}),
      urlScreen.close({}),
      successScreen.close(),
      reportScreen.close(),
      banScreen.close(),
    ]);
    return;
  }

  await closeOthers();
  openTarget(id);
}

appRouter = createAppRouter({
  onChange: (location) => {
    const handoff = pendingHandoff;
    pendingHandoff = false;

    if (!location.id) {
      const session = getSession();
      const entry = resolveEntryScreen({
        hasSession: Boolean(session?.userId),
        onboardingDone: Boolean(session?.onboardingDone),
        referralDone: Boolean(session?.referralCode),
        banned: Boolean(session?.banned),
      });
      const search = Object.fromEntries(location.search.entries());
      go(entry, { replace: true, search });
      return;
    }

    void applyRoute(location.id, { handoff });
  },
});

openExternalBtn?.addEventListener("click", () => {
  startExternalSession();
});

frameReloadBtn?.addEventListener("click", () => {
  if (embedPlan?.mode === "external") {
    openPortfolioExternally();
    return;
  }
  navigateFrame((win) => win?.location.reload());
});

frameBackBtn?.addEventListener("click", () => {
  navigateFrame((win) => win?.history.back());
});

frameForwardBtn?.addEventListener("click", () => {
  navigateFrame((win) => win?.history.forward());
});

applyDocumentI18n();
showBrandChrome();
renderTimer();
if (shell) {
  shell.hidden = true;
  shell.classList.remove("iframe-shell--entered");
}

window.addEventListener("pagehide", () => {
  if (reviewSubmitPromise) {
    /* submit ещё идёт — не трогаем claim; триггер снимет после insert */
    stopClaimHeartbeat();
    return;
  }
  if (claimHeld && !reviewSubmitted && portfolioId) {
    void releasePortfolioClaim(portfolioId);
    claimHeld = false;
  }
  stopClaimHeartbeat();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (!getSession()?.userId) return;
  void refreshSessionFromProfile().then((session) => {
    if (session?.banned && activeRouteId !== "banned") {
      go("banned", { replace: true });
    }
  });
});

void (async () => {
  try {
    const oauthSession = await completeOAuthFromUrl();
    if (oauthSession) {
      await applyProviderUser(oauthSession.user, "google");
    } else if (getSession()) {
      // Re-validate ban from server — do not trust stale localStorage alone.
      await refreshSessionFromProfile();
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[auth] oauth callback failed", err);
    }
    try {
      window.sessionStorage.setItem(
        "obratka.authProviderError",
        err instanceof Error ? err.message : "google_oauth_failed",
      );
    } catch {
      /* ignore quota / private mode */
    }
  }
  appRouter.start();
})();
