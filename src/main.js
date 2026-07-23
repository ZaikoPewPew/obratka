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
import { submitPortfolio, clearSubmittedPortfolios } from "./api/portfolios.js";
import {
  awardReviewReward,
  canSubmitPortfolio,
  spendSubmitCost,
} from "./api/wallet.js";
import { createReviewPanel } from "./components/review-panel/ReviewPanel.js";
import { createReviewScreen } from "./components/review-screen/ReviewScreen.js";
import { createAuthScreen } from "./components/auth-screen/AuthScreen.js";
import { createHomeScreen } from "./components/home-screen/HomeScreen.js";
import { createOnboardingScreen } from "./components/onboarding-screen/OnboardingScreen.js";
import { createReferralScreen } from "./components/referral-screen/ReferralScreen.js";
import { createSuccessScreen } from "./components/success-screen/SuccessScreen.js";
import { createUrlScreen } from "./components/url-screen/UrlScreen.js";
import {
  resolvePortfolioEmbed,
} from "./utils/portfolioEmbed.js";
import { resolvePortfolioMeta } from "./utils/portfolioMeta.js";
import { getMotionFocusDelayMs } from "./utils/motionTokens.js";
import brandLogoUrl from "./assets/brand/logo.svg";

const SESSION_SECONDS = 5;
const SESSION_TOTAL_MS = SESSION_SECONDS * 1000;
const TIMER_TICK_MS = 10;

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
/** @type {import("./utils/portfolioEmbed.js").PortfolioEmbedPlan | null} */
let embedPlan = null;
/** @type {string} */
let portfolioName = getStrings().brandName;

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
  onComplete: () => {
    awardReviewReward();
    pendingSuccessPreset = "quizComplete";
    go("done");
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

let remainingMs = SESSION_TOTAL_MS;
let timerId = null;
let sessionEnded = false;
/** Таймер уже запущен в текущей сессии (для external — после кнопки). */
let sessionStarted = false;
/** @type {number} */
let metaRequestId = 0;

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
 * @param {{ openExternal?: boolean }} [options]
 */
async function applyPortfolio(url, options = {}) {
  portfolioUrl = url;
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
  if (!frameWrap) return;

  void homeScreen.close();
  void urlScreen.close();
  void onboardingScreen.close({ handoff: true });
  void authScreen.close({ handoff: true });
  void referralScreen.close({ handoff: true });
  void successScreen.close();

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
      return;
    }
    try {
      spendSubmitCost();
      await submitPortfolio(url);
    } catch {
      go("home", { replace: true });
      return;
    }
    pendingSuccessPreset = "portfolioSubmitted";
    go("done", { replace: true });
  },
});

const homeScreen = createHomeScreen({
  onOpenPortfolio: async (item) => {
    enterSessionShell();
    await closeReview();
    await applyPortfolio(item.url);
    go("review");
    void homeScreen.close();
    if (embedPlan?.mode === "external") {
      armSession();
      return;
    }
    startTimer();
  },
  onAddPortfolio: async () => {
    if (!canSubmitPortfolio()) return;
    go("url");
  },
  onResetSession: async () => {
    clearSession();
    clearSubmittedPortfolios();
    stopTimer();
    portfolioUrl = null;
    embedPlan = null;
    portfolioName = getStrings().brandName;
    pendingSuccessPreset = "generic";
    leaveSessionShell();
    await closeReview();
    go("referral", { replace: true });
  },
});

const onboardingScreen = createOnboardingScreen({
  onComplete: async () => {
    const session = getSession() ?? {};
    setSession({ ...session, onboardingDone: true });
    go("home", { replace: true, handoff: true });
  },
});

const authScreen = createAuthScreen({
  onSuccess: async (result) => {
    const session = getSession() ?? {};
    setSession({
      ...session,
      userId: session.userId ?? `local-${Date.now()}`,
      email: result.type === "email" ? result.email : session.email,
      balance: typeof session.balance === "number" ? session.balance : 0,
    });
    if (session.onboardingDone) {
      go("home", { handoff: true });
      return;
    }
    go("onboarding", { handoff: true });
  },
});

const referralScreen = createReferralScreen({
  onSubmit: async (referral) => {
    const session = getSession() ?? {};
    setSession({ ...session, referralCode: referral });
    go("auth", { handoff: true });
  },
});

document.body.append(
  referralScreen.root,
  authScreen.root,
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
  let accessible = resolveAccessibleRoute(id, {
    hasPortfolio: Boolean(portfolioUrl),
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

  const isReviewWorkspace = id === "review" || id === "quiz";
  const isBrandHandoff =
    handoff &&
    (id === "referral" || id === "auth" || id === "onboarding" || id === "url");
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
    if (target === "done") {
      successScreen.open({ preset: pendingSuccessPreset });
    }
  }

  async function closeOthers() {
    /** @type {Array<Promise<void> | void>} */
    const closers = [];
    if (id !== "referral") closers.push(referralScreen.close(closeOpts));
    if (id !== "auth") closers.push(authScreen.close(closeOpts));
    if (id !== "onboarding") closers.push(onboardingScreen.close(closeOpts));
    if (id !== "home") closers.push(homeScreen.close());
    if (id !== "url") closers.push(urlScreen.close(closeOpts));
    if (id !== "done") closers.push(successScreen.close());
    await Promise.all(closers);
  }

  if (isReviewWorkspace) {
    enterSessionShell();
    await closeOthers();

    if (id === "review") return;

    frameWrap?.classList.add("iframe-shell__frame--locked");
    reviewScreen.open();
    reviewPanel.reset();
    reviewPanel.open();
    window.setTimeout(() => {
      reviewPanel.focus();
    }, getMotionFocusDelayMs());
    return;
  }

  leaveSessionShell();
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
      onboardingScreen.close({}),
      urlScreen.close({}),
      successScreen.close(),
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
        hasSession: Boolean(session),
        onboardingDone: Boolean(session?.onboardingDone),
        referralDone: Boolean(session?.referralCode),
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

appRouter.start();
