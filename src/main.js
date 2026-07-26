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
  getLocale,
  getStrings,
} from "./i18n.js";
import {
  resolveAccessibleRoute,
  resolveEntryScreen,
} from "./app/flow.js";
import { createAppRouter } from "./app/router.js";
import { getSession, setSession, clearSession } from "./app/session.js";
import { completeOAuthFromUrl, signOut } from "./api/auth.js";
import { getSupabase } from "./lib/supabaseClient.js";
import {
  submitPortfolio,
  clearSubmittedPortfolios,
  submitPortfolioReview,
  claimPortfolioReview,
  heartbeatPortfolioClaim,
  releasePortfolioClaim,
  portfolioRpcErrorCode,
  hasFreeMineSlot,
  listPortfoliosForReview,
  isPortfolioOpenForReview,
} from "./api/portfolios.js";
import { clearHomeListCache } from "./utils/homeListCache.js";
import { clearFeedSeen } from "./utils/feedSeen.js";
import { clearMineReadySeen } from "./utils/mineReadySeen.js";
import {
  buildHomeSearch,
  isCanonicalHomeSearch,
  parseHomeView,
} from "./utils/homeRoute.js";
import { fetchMyProfile, isProfileBanned, updateMyProfile } from "./api/profiles.js";
import { heartbeatLegendaryPresence } from "./api/presence.js";
import {
  redeemReferral,
  validateReferral,
} from "./api/referrals.js";
import {
  awardReviewReward,
  applySubmitBalance,
  canSubmitPortfolio,
  refreshSessionFromProfile,
} from "./api/wallet.js";
import { createDictationEngine, isWebSpeechSupported } from "./lib/dictation/createDictationEngine.js";
import { createReviewPanel } from "./components/review-panel/ReviewPanel.js";
import { createReviewScreen } from "./components/review-screen/ReviewScreen.js";
import { createAuthScreen } from "./components/auth-screen/AuthScreen.js";
import { createAuthCodeScreen } from "./components/auth-code-screen/AuthCodeScreen.js";
import { createHomeScreen } from "./components/home-screen/HomeScreen.js";
import { createOnboardingScreen } from "./components/onboarding-screen/OnboardingScreen.js";
import { DEFAULT_ONBOARDING_ROLE } from "./api/onboarding.js";
import { createReferralScreen } from "./components/referral-screen/ReferralScreen.js";
import { createSuccessScreen } from "./components/success-screen/SuccessScreen.js";
import { createReportScreen } from "./components/report-screen/ReportScreen.js";
import { createBanScreen } from "./components/ban-screen/BanScreen.js";
import { createUrlScreen } from "./components/url-screen/UrlScreen.js";
import { createSettingsScreen } from "./components/settings-screen/SettingsScreen.js";
import { REVIEW_SESSION_SECONDS } from "./config/review.js";
import {
  resolvePortfolioEmbed,
} from "./utils/portfolioEmbed.js";
import { getMotionFocusDelayMs } from "./utils/motionTokens.js";
import brandLogoUrl from "./assets/brand/logo.svg";

const SESSION_TOTAL_MS = REVIEW_SESSION_SECONDS * 1000;
const TIMER_TICK_MS = 10;
/** Продление claim TTL, пока пользователь на review/quiz. */
const CLAIM_HEARTBEAT_MS = 2 * 60 * 1000;
/** Ping last_seen для legendary (серверный online TTL = 2 min). */
const LEGENDARY_PRESENCE_HEARTBEAT_MS = 60 * 1000;
/** Потолок длины надиктовки в answers.dictation. */
const DICTATION_MAX_LEN = 4000;

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
const dictationBtn = document.querySelector('[data-action="toggle-dictation"]');
const dictationBars = Array.from(
  document.querySelectorAll(".iframe-shell__rec-bar"),
);

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

/** Надиктовка с /review → answers.dictation */
let dictationText = "";
let dictationRecording = false;
/**
 * Куда уходит транскрипт: заметки на `/review` или поле «Главный совет» в квизе.
 * @type {"notes" | "advice"}
 */
let dictationTarget = "notes";
/** Идёт start/stop — второй клик игнорируем. */
let dictationBusy = false;
/** @type {ReturnType<typeof createDictationEngine>} */
let dictationEngine = null;

/** @type {string | null} */
let pendingReportPortfolioId = null;
/** @type {string} */
let pendingReportPortfolioName = "";

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

/**
 * Последний вид home — чтобы возврат с `/report` / `/settings` попадал на ту же
 * вкладку (отчёт открывается только с «Мои»).
 * @type {{ tab: import("./utils/homeRoute.js").HomeTabId; filter: import("./utils/homeRoute.js").MineFilterId }}
 */
let lastHomeView = { tab: "feed", filter: "active" };

/**
 * Вкладка / сегмент home из текущего URL.
 * @returns {{ tab: import("./utils/homeRoute.js").HomeTabId; filter: import("./utils/homeRoute.js").MineFilterId }}
 */
function currentHomeView() {
  lastHomeView = parseHomeView(
    typeof window !== "undefined" ? window.location.search : "",
  );
  return lastHomeView;
}

/**
 * Подчистить `/home` query (мусорный `tab`, дефолты) без записи в history-стек.
 * @param {{ tab?: import("./utils/homeRoute.js").HomeTabId; filter?: import("./utils/homeRoute.js").MineFilterId }} view
 */
function canonicalizeHomeSearch(view) {
  const search = typeof window !== "undefined" ? window.location.search : "";
  if (isCanonicalHomeSearch(search, view)) return;
  appRouter?.navigate("home", {
    search: buildHomeSearch(view),
    replace: true,
    silent: true,
  });
}

const reviewPanel = createReviewPanel({
  getPortfolioName: () => portfolioName,
  onReportReveal: (active, payload) => {
    setReviewReportReveal(active, payload);
  },
  onDictationToggle: () => {
    if (activeRouteId !== "quiz") return;
    void toggleDictation("advice");
  },
  onComplete: (answers) => {
    void stopDictation();
    const dictation = dictationText.trim().slice(0, DICTATION_MAX_LEN);
    const payload =
      answers && dictation
        ? { ...answers, dictation }
        : answers;
    reviewSubmitPromise = (async () => {
      try {
        if (portfolioId) {
          await submitPortfolioReview(portfolioId, payload ?? null);
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
    void openNextReviewCase();
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
    pendingReportPortfolioName = "";
    go("home", { replace: true, search: buildHomeSearch(lastHomeView) });
  },
});
document.body.append(reportScreen.root);

async function exitAuthenticatedSession() {
  const sessionUserId = getSession()?.userId;
  try {
    await signOut();
  } catch {
    /* Локальную сессию всё равно закрываем. */
  }
  clearHomeListCache(sessionUserId);
  clearMineReadySeen(sessionUserId);
  clearFeedSeen(sessionUserId);
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
  resetDictationSession();
  stopLegendaryPresenceHeartbeat();
  portfolioUrl = null;
  portfolioId = null;
  claimHeld = false;
  reviewSubmitted = false;
  stopClaimHeartbeat();
  embedPlan = null;
  portfolioName = getStrings().brandName;
  pendingSuccessPreset = "generic";
  pendingReportPortfolioId = null;
  pendingReportPortfolioName = "";
  leaveSessionShell();
  await closeReview();
  go("referral", { replace: true });
}

const banScreen = createBanScreen({
  onExit: exitAuthenticatedSession,
});
document.body.append(banScreen.root);

let remainingMs = SESSION_TOTAL_MS;
let timerId = null;
let sessionEnded = false;
/** Таймер уже запущен в текущей сессии (для external — после кнопки). */
let sessionStarted = false;

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

/** @type {ReturnType<typeof window.setInterval> | null} */
let legendaryPresenceHeartbeatId = null;

function stopLegendaryPresenceHeartbeat() {
  if (legendaryPresenceHeartbeatId != null) {
    window.clearInterval(legendaryPresenceHeartbeatId);
    legendaryPresenceHeartbeatId = null;
  }
}

function pingLegendaryPresence() {
  void heartbeatLegendaryPresence().catch((err) => {
    if (import.meta.env.DEV) {
      console.warn("[presence] heartbeat", err);
    }
  });
}

/**
 * Heartbeat only while tab visible and session.tier === legendary.
 */
function syncLegendaryPresenceHeartbeat() {
  const session = getSession();
  const shouldRun =
    session?.tier === "legendary" &&
    !session?.banned &&
    document.visibilityState === "visible";

  if (!shouldRun) {
    stopLegendaryPresenceHeartbeat();
    return;
  }

  if (legendaryPresenceHeartbeatId != null) return;

  pingLegendaryPresence();
  legendaryPresenceHeartbeatId = window.setInterval(() => {
    if (
      getSession()?.tier !== "legendary" ||
      getSession()?.banned ||
      document.visibilityState !== "visible"
    ) {
      stopLegendaryPresenceHeartbeat();
      return;
    }
    pingLegendaryPresence();
  }, LEGENDARY_PRESENCE_HEARTBEAT_MS);
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

/** Защита от двойного клика «Следующий кейс». */
let nextCaseOpening = false;

/**
 * Claim + старт `/review`. Тот же путь, что CTA intro на home (без модалки).
 *
 * @param {{
 *   id?: string;
 *   url?: string;
 *   name?: string;
 *   avatarUrl?: string;
 *   isOwn?: boolean;
 *   reviewedByMe?: boolean;
 * }} item
 * @param {{ showNoSlotsNotice?: boolean }} [opts]
 * @returns {Promise<boolean>}
 */
async function claimAndStartReview(item, opts = {}) {
  const showNoSlotsNotice = Boolean(opts.showNoSlotsNotice);
  if (item?.isOwn || item?.reviewedByMe) return false;
  const id = typeof item?.id === "string" ? item.id : "";
  if (!id) return false;

  try {
    await claimPortfolioReview(id);
  } catch (err) {
    const code = portfolioRpcErrorCode(err);
    if (code === "no_slots") {
      if (showNoSlotsNotice) {
        const t = getStrings();
        homeScreen.showNotice({
          title: t.homeNoSlotsTitle,
          body: t.homeNoSlotsBody,
          closeLabel: t.homeNoSlotsClose,
          closeAria: t.homeNoSlotsCloseAria,
        });
        void homeScreen.refresh();
      }
      return false;
    }
    if (code === "already_reviewed") {
      if (showNoSlotsNotice) {
        void homeScreen.refresh();
      }
      return false;
    }
    if (import.meta.env.DEV) {
      console.warn("[review] claimPortfolioReview", err);
    }
    if (showNoSlotsNotice) {
      void homeScreen.refresh();
    }
    return false;
  }

  claimHeld = true;
  reviewSubmitted = false;
  reviewSubmitPromise = null;
  resetDictationSession();
  stopTimer();
  sessionEnded = false;
  sessionStarted = false;
  remainingMs = SESSION_TOTAL_MS;
  renderTimer();
  enterSessionShell();
  await closeReview();
  applyPortfolio(item.url, {
    portfolioId: id,
    applicantName: item.name,
    applicantAvatar: item.avatarUrl,
  });
  startClaimHeartbeat();
  go("review");
  void homeScreen.close();
  if (embedPlan?.mode === "external") {
    armSession();
    return true;
  }
  startTimer();
  return true;
}

/**
 * После done: свежая лента → первый доступный кейс → claim → `/review`.
 * Нет кандидатов / все claim провалились → home.
 * @returns {Promise<void>}
 */
async function openNextReviewCase() {
  if (nextCaseOpening) return;
  nextCaseOpening = true;
  try {
    const pending = reviewSubmitPromise;
    if (pending) {
      await pending.catch(() => {});
    }
    await releaseHeldClaim();

    const excludeId = portfolioId;
    let items;
    try {
      items = await listPortfoliosForReview();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[review] listPortfoliosForReview", err);
      }
      go("home", { replace: true });
      return;
    }

    for (const item of items) {
      if (excludeId && item.id === excludeId) continue;
      if (!isPortfolioOpenForReview(item)) continue;
      const started = await claimAndStartReview(item, {
        showNoSlotsNotice: false,
      });
      if (started) {
        clearHomeListCache(getSession()?.userId);
        return;
      }
    }

    go("home", { replace: true });
  } finally {
    nextCaseOpening = false;
  }
}

/**
 * Сброс локальной review-сессии после ухода с /review|/quiz|/done.
 * Claim к этому моменту уже released или снят триггером после submit.
 */
function clearReviewSessionState() {
  resetDictationSession();
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

/**
 * @returns {string}
 */
function speechLangForLocale() {
  return getLocale() === "en" ? "en-US" : "ru-RU";
}

/** Последние уровни волны shell-чипа — без лишних style writes. */
const lastDictationBarLevels = dictationBars.map(() => -1);

function setDictationWaveform(levels = []) {
  // Волна видна только у shell-чипа на /review; в advice DOM не трогаем.
  const visible =
    !levels.length ||
    (dictationRecording && dictationTarget === "notes");
  if (!visible && levels.length) return;

  for (let index = 0; index < dictationBars.length; index += 1) {
    const next = Number(levels[index]) || 0;
    if (Math.abs(lastDictationBarLevels[index] - next) < 0.01) continue;
    lastDictationBarLevels[index] = next;
    dictationBars[index].style.setProperty(
      "--control-rec-bar-level",
      String(next),
    );
  }
}

function syncDictationButtonChrome() {
  if (!dictationBtn) return;
  const t = getStrings();
  const onLiveReview =
    activeRouteId === "review" && !sessionEnded && Boolean(claimHeld);
  if (!isWebSpeechSupported() || !onLiveReview) {
    dictationBtn.hidden = true;
    if (!isWebSpeechSupported()) {
      dictationBtn.title = t.reviewRecUnsupportedTitle;
    }
    return;
  }
  const recording = dictationRecording && dictationTarget === "notes";
  dictationBtn.hidden = false;
  dictationBtn.classList.toggle("iframe-shell__rec--recording", recording);
  dictationBtn.setAttribute("aria-pressed", recording ? "true" : "false");
  dictationBtn.setAttribute(
    "aria-label",
    recording ? t.reviewRecStopAria : t.reviewRecStartAria,
  );
  dictationBtn.title = recording
    ? t.reviewRecStopTitle
    : t.reviewRecStartTitle;
}

/** Чип rec на /review + кнопка микрофона в поле «Главный совет». */
function syncDictationChrome() {
  syncDictationButtonChrome();
  reviewPanel.setDictationSupported(isWebSpeechSupported());
  reviewPanel.setDictationRecording(
    dictationRecording && dictationTarget === "advice",
  );
}

/**
 * @returns {NonNullable<ReturnType<typeof createDictationEngine>> | null}
 */
function ensureDictationEngine() {
  if (dictationEngine) return dictationEngine;
  dictationEngine = createDictationEngine({ lang: speechLangForLocale() });
  if (!dictationEngine) return null;
  dictationEngine.onTranscript((finalText, interim) => {
    const combined = [finalText, interim].filter(Boolean).join(" ").trim();
    if (dictationTarget === "advice") {
      // Пустой flush (stop без речи) не должен затирать уже набранный/надиктованный текст.
      if (!combined) return;
      reviewPanel.setDictationTranscript(combined);
      return;
    }
    if (!combined) return;
    dictationText = combined.slice(0, DICTATION_MAX_LEN);
  });
  dictationEngine.onWaveform(setDictationWaveform);
  dictationEngine.onError((code) => {
    dictationRecording = false;
    setDictationWaveform();
    syncDictationChrome();
    if (import.meta.env.DEV) {
      console.warn("[dictation]", code);
    }
  });
  return dictationEngine;
}

async function stopDictation() {
  if (dictationEngine) {
    await dictationEngine.stop();
  }
  dictationRecording = false;
  setDictationWaveform();
  syncDictationChrome();
}

/**
 * @param {"notes" | "advice"} target
 */
async function startDictation(target) {
  const engine = ensureDictationEngine();
  if (!engine) {
    syncDictationChrome();
    return;
  }
  // Поле «Главный совет» дописывает транскрипт к своему тексту, поэтому
  // каждая запись начинается с пустого буфера движка.
  if (target === "advice" || dictationTarget === "advice") {
    engine.resetTranscript();
  }
  dictationTarget = target;
  const ok = await engine.start();
  dictationRecording = Boolean(ok);
  if (!ok) setDictationWaveform();
  syncDictationChrome();
}

/**
 * @param {"notes" | "advice"} target
 */
async function toggleDictation(target) {
  if (dictationBusy) return;
  dictationBusy = true;
  try {
    if (dictationRecording) {
      await stopDictation();
      return;
    }
    await startDictation(target);
  } finally {
    dictationBusy = false;
  }
}

function resetDictationSession() {
  void stopDictation();
  dictationEngine?.destroy();
  dictationEngine = null;
  dictationText = "";
  dictationRecording = false;
  dictationTarget = "notes";
  setDictationWaveform();
  syncDictationChrome();
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

  syncDictationChrome();
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
    avatarEl.setAttribute("aria-label", t.brandLogoAlt);
  }
  syncLocaleDependentAttrs();
}

function syncPortfolioChrome({ label, avatar }) {
  portfolioName = label;
  if (nameEl) {
    nameEl.textContent = label;
  }
  setPortfolioAvatar(avatar);
  syncLocaleDependentAttrs();
}

/**
 * @param {string} primary
 */
function setPortfolioAvatar(primary) {
  if (!avatarEl) return;

  avatarEl.classList.remove("iframe-shell__avatar--broken", "iframe-shell__avatar--brand");
  avatarEl.alt = "";
  avatarEl.removeAttribute("aria-label");

  const showBroken = () => {
    avatarEl.removeAttribute("src");
    avatarEl.classList.add("iframe-shell__avatar--broken");
  };

  avatarEl.onerror = showBroken;
  avatarEl.onload = () => {
    // 1×1 / пустые заглушки части CDN не показываем как аватар кандидата.
    if (avatarEl.naturalWidth < 8 || avatarEl.naturalHeight < 8) {
      showBroken();
      return;
    }
    avatarEl.classList.remove("iframe-shell__avatar--broken");
  };
  if (primary) {
    avatarEl.src = primary;
  } else {
    showBroken();
  }
}

/**
 * @param {string} url
 * @param {{
 *   openExternal?: boolean;
 *   portfolioId?: string | null;
 *   applicantName?: string;
 *   applicantAvatar?: string;
 * }} [options]
 */
function applyPortfolio(url, options = {}) {
  portfolioUrl = url;
  portfolioId =
    typeof options.portfolioId === "string" && options.portfolioId.trim()
      ? options.portfolioId.trim()
      : null;
  const applicantName =
    typeof options.applicantName === "string" && options.applicantName.trim()
      ? options.applicantName.trim()
      : url;
  const applicantAvatar =
    typeof options.applicantAvatar === "string"
      ? options.applicantAvatar.trim()
      : "";
  const plan = resolvePortfolioEmbed(url);

  syncPortfolioChrome({
    label: applicantName,
    avatar: applicantAvatar,
  });
  applyEmbedPlan(plan);

  if (options.openExternal && plan.mode === "external") {
    openPortfolioExternally();
  }
}

function openReview() {
  /* Только живая review-сессия с claim — иначе ghost-quiz после abort. */
  if (!frameWrap || activeRouteId !== "review" || !claimHeld || reviewSubmitted) {
    return;
  }

  void stopDictation();

  void homeScreen.close();
  void settingsScreen.close();
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
  syncDictationChrome();
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
      const result = await submitPortfolio(url);
      if (typeof result?.balance === "number") {
        applySubmitBalance(result.balance);
      } else {
        await refreshSessionFromProfile();
      }
      clearHomeListCache(getSession()?.userId);
    } catch {
      go("home", { replace: true });
      throw new Error("url.submit_failed");
    }
  },
  onExit: () => {
    go("home", { replace: true });
  },
});

const settingsScreen = createSettingsScreen({
  onBack: () => {
    go("home", { search: buildHomeSearch(lastHomeView) });
  },
});

const homeScreen = createHomeScreen({
  onOpenPortfolio: async (item) => {
    // Intro CTA → тот же claimAndStartReview, что и «Следующий кейс» (без intro).
    await claimAndStartReview(item, { showNoSlotsNotice: true });
  },
  onOpenReport: async (item) => {
    if (!item?.isOwn || !item.id) return;
    pendingReportPortfolioId = item.id;
    pendingReportPortfolioName =
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : "";
    go("report", { search: { id: item.id } });
  },
  onAddPortfolio: async () => {
    if (!canSubmitPortfolio()) return;
    try {
      if (!(await hasFreeMineSlot())) {
        const t = getStrings();
        homeScreen.showNotice({
          title: t.homePendingLimitTitle ?? "",
          body: t.homePendingLimit ?? "",
          closeLabel: t.homePendingLimitClose,
          closeAria: t.homePendingLimitCloseAria,
        });
        return;
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[home] hasFreeMineSlot", err);
      }
    }
    go("url");
  },
  onOpenSettings: () => {
    go("settings");
  },
  onViewChange: ({ tab, filter, reason }) => {
    lastHomeView = { tab, filter };
    // Экран уже переключился сам — URL только догоняем, без re-open.
    if (activeRouteId !== "home") return;
    appRouter?.navigate("home", {
      search: buildHomeSearch({ tab, filter }),
      replace: reason === "filter",
      silent: true,
    });
  },
  onSignOut: exitAuthenticatedSession,
});

const onboardingScreen = createOnboardingScreen({
  onComplete: async (answers) => {
    const session = getSession() ?? {};
    setSession({
      ...session,
      onboardingDone: true,
      role:
        typeof answers?.role === "string" && answers.role
          ? answers.role
          : session.role || DEFAULT_ONBOARDING_ROLE,
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
  syncLegendaryPresenceHeartbeat();
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
  settingsScreen.root,
  urlScreen.root,
);

/**
 * @param {import("./app/routes.js").AppRouteId} id
 * @param {{ handoff?: boolean }} [opts]
 */
async function applyRoute(id, opts = {}) {
  const handoff = Boolean(opts.handoff);
  const prevRouteId = activeRouteId;
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

  if (accessible === "url") {
    if (!canSubmitPortfolio()) {
      accessible = "home";
    } else {
      try {
        if (!(await hasFreeMineSlot())) {
          accessible = "home";
        }
      } catch {
        accessible = "home";
      }
    }
  }

  if (accessible !== id) {
    syncRoute(accessible, { replace: true });
    id = accessible;
  }

  activeRouteId = id;
  syncDictationChrome();

  // Back/Forward между вкладками home: экран уже смонтирован, меняем только вид.
  if (id === "home" && prevRouteId === "home" && !handoff) {
    const view = currentHomeView();
    canonicalizeHomeSearch(view);
    await homeScreen.setView(view);
    return;
  }

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
      const view = currentHomeView();
      canonicalizeHomeSearch(view);
      void homeScreen.open(view);
      return;
    }
    if (target === "settings") {
      settingsScreen.open();
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
      reportScreen.open({
        portfolioId: id,
        portfolioName: pendingReportPortfolioName || null,
      });
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
    if (id !== "settings") closers.push(settingsScreen.close());
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
    const opening = homeScreen.open(currentHomeView());
    await Promise.all([
      opening,
      referralScreen.close({}),
      authScreen.close({}),
      authCodeScreen.close({}),
      onboardingScreen.close({}),
      settingsScreen.close(),
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

dictationBtn?.addEventListener("click", () => {
  if (activeRouteId !== "review" || sessionEnded) return;
  void toggleDictation("notes");
});

applyDocumentI18n();
showBrandChrome();
renderTimer();
syncDictationChrome();
if (shell) {
  shell.hidden = true;
  shell.classList.remove("iframe-shell--entered");
}

window.addEventListener("pagehide", () => {
  void stopDictation();
  stopLegendaryPresenceHeartbeat();
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
  if (document.visibilityState !== "visible") {
    stopLegendaryPresenceHeartbeat();
    return;
  }
  if (!getSession()?.userId) return;
  syncLegendaryPresenceHeartbeat();
  void refreshSessionFromProfile().then((session) => {
    syncLegendaryPresenceHeartbeat();
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
    } else if (getSession()?.userId) {
      // UX-кэш `obratka.session` без живой Supabase Auth → не пускать на home.
      const supabase = getSupabase();
      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) {
          const referralCode = getSession()?.referralCode ?? null;
          clearSession();
          if (referralCode) {
            setSession({ referralCode });
          }
        } else {
          // Re-validate ban from server — do not trust stale localStorage alone.
          await refreshSessionFromProfile();
        }
      } else {
        await refreshSessionFromProfile();
      }
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
  syncLegendaryPresenceHeartbeat();
  appRouter.start();
})();
