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
import { getSupabase, refreshCachedAccessToken } from "./lib/supabaseClient.js";
import {
  identifyUser,
  initAnalytics,
  resetAnalytics,
  track,
  trackPage,
} from "./lib/analytics.js";
import {
  submitPortfolio,
  clearSubmittedPortfolios,
  submitPortfolioReview,
  claimPortfolioReview,
  heartbeatPortfolioClaim,
  releasePortfolioClaim,
  releasePortfolioClaimKeepalive,
  portfolioRpcErrorCode,
  hasFreeMineSlot,
  listPortfoliosForReview,
  isPortfolioOpenForReview,
} from "./api/portfolios.js";
import {
  clearHomeListCache,
  removeCachedHomeListItem,
} from "./utils/homeListCache.js";
import { clearFeedSeen } from "./utils/feedSeen.js";
import { clearMineReadySeen } from "./utils/mineReadySeen.js";
import {
  buildHomeSearch,
  isCanonicalHomeSearch,
  parseHomeView,
} from "./utils/homeRoute.js";
import {
  getInviteGatePassed,
  setInviteGatePassed,
} from "./utils/inviteGate.js";
import {
  clearMyProfileCache,
  fetchMyProfile,
  isProfileBanned,
  updateMyProfile,
} from "./api/profiles.js";
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
import { clampReputation } from "./api/reviewComplaints.js";
import { polishDictationText } from "./api/dictationPolish.js";
import { createDictationEngine, isWebSpeechSupported } from "./lib/dictation/createDictationEngine.js";
import { createAuthScreen } from "./components/auth-screen/AuthScreen.js";
import { createAuthCodeScreen } from "./components/auth-code-screen/AuthCodeScreen.js";
import { createAppModal } from "./components/app-modal/AppModal.js";
import { DEFAULT_ONBOARDING_ROLE } from "./api/onboarding.js";
import { createReferralScreen } from "./components/referral-screen/ReferralScreen.js";
import { createBanScreen } from "./components/ban-screen/BanScreen.js";
import { createDesktopOnlyScreen } from "./components/desktop-only-screen/DesktopOnlyScreen.js";
import { REVIEW_SESSION_SECONDS } from "./config/review.js";
import {
  probePortfolioEmbed,
  resolvePortfolioEmbedPlan,
} from "./api/portfolioEmbedProbe.js";
import {
  isLikelyFrameBlocked,
  probeReadymagPortfolio,
  resolvePortfolioEmbed,
  toExternalEmbedPlan,
} from "./utils/portfolioEmbed.js";
import { normalizePortfolioUrl } from "./utils/portfolioMeta.js";
import { getMotionFocusDelayMs } from "./utils/motionTokens.js";
import { startTabAttention } from "./utils/tabAttention.js";
import { fixHangingPrepositions } from "./utils/hangingPrepositions.js";
import {
  isDesktopViewport,
  subscribeDesktopViewport,
} from "./utils/viewport.js";

initAnalytics();

/** Extended Montserrat subsets — после paint, не блокируют entry. */
function loadExtendedFonts() {
  const run = () => {
    void import("./fonts-ext.css");
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    window.setTimeout(run, 1500);
  }
}
loadExtendedFonts();

/** @type {Promise<string> | null} */
let timerEndUrlPromise = null;
/** @type {Promise<string> | null} */
let externalEmbedVideoUrlPromise = null;

function loadTimerEndUrl() {
  if (!timerEndUrlPromise) {
    timerEndUrlPromise = import("./assets/audio/Timer-end.wav").then(
      (m) => m.default,
    );
  }
  return timerEndUrlPromise;
}

function loadExternalEmbedVideoUrl() {
  if (!externalEmbedVideoUrlPromise) {
    externalEmbedVideoUrlPromise = import(
      "./assets/video/primer_not_iframe.mp4"
    ).then((m) => m.default);
  }
  return externalEmbedVideoUrlPromise;
}

const SESSION_TOTAL_MS = REVIEW_SESSION_SECONDS * 1000;
const TAB_ATTENTION_FAVICON = `${String(import.meta.env.BASE_URL || "/").replace(/\/?$/, "/")}assets/svg/favicon_timer.svg`;
const TIMER_TICK_MS = 10;
/** Продление claim TTL, пока пользователь на review/quiz. */
const CLAIM_HEARTBEAT_MS = 2 * 60 * 1000;
/** Per-tab: orphan claim после failed unload → boot reconcile. */
const REVIEW_CLAIM_STORAGE_KEY = "obratka.reviewClaim";
/** Ping last_seen для legendary (серверный online TTL = 2 min). */
const LEGENDARY_PRESENCE_HEARTBEAT_MS = 60 * 1000;
/** Потолок длины надиктовки в answers.dictation. */
const DICTATION_MAX_LEN = 4000;
/** Совпадает с ADVICE_MAX_LEN в ReviewPanel. */
const ADVICE_MAX_LEN = 1000;
/**
 * Sandbox портфолио-iframe: скрипты/формы/попапы ок, без top-navigation
 * (вредоносный сайт автора не уводит окно приложения).
 */
const PORTFOLIO_FRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";
/** Ждём load; если нет — эскалация в external (XFO/CSP/сеть). */
const FRAME_BLOCK_WATCH_MS = 8000;
/** Пауза после load, чтобы браузер успел подставить blank/error. */
const FRAME_BLOCK_SETTLE_MS = 50;
/**
 * Сколько ждать prefetch probe при старте ревью (intro обычно уже прогрел).
 * Дальше — optimistic iframe + runtime fallback.
 */
const EMBED_PREFETCH_WAIT_MS = 2500;

const frameWrap = document.querySelector("[data-frame]");
const frame = document.querySelector("#portfolio-frame");
const externalViewer = document.querySelector("[data-external-viewer]");
const externalMedia = document.querySelector("[data-external-media]");
const openExternalBtn = document.querySelector('[data-action="open-external"]');
const timerEl = document.querySelector("[data-timer]");

/** @type {HTMLVideoElement | null} */
let externalMediaVideo = null;
const abortReviewBtn = document.querySelector('[data-action="abort-review"]');
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
/** Поколение applyEmbedPlan — сбрасывает устаревшие probe/iframe watchers. */
let embedWatchGeneration = 0;
/** @type {(() => void) | null} */
let detachFrameBlockWatch = null;

/**
 * @param {string} id
 */
function persistReviewClaim(id) {
  const portfolio = String(id || "").trim();
  if (!portfolio) return;
  try {
    window.sessionStorage.setItem(REVIEW_CLAIM_STORAGE_KEY, portfolio);
  } catch {
    /* private mode / quota */
  }
}

function clearPersistedReviewClaim() {
  try {
    window.sessionStorage.removeItem(REVIEW_CLAIM_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @returns {string}
 */
function readPersistedReviewClaim() {
  try {
    const raw = window.sessionStorage.getItem(REVIEW_CLAIM_STORAGE_KEY);
    return typeof raw === "string" ? raw.trim() : "";
  } catch {
    return "";
  }
}

/** Ревью уже отправлено — claim не освобождаем (триггер снял его). */
let reviewSubmitted = false;
/** @type {Promise<void> | null} */
let reviewSubmitPromise = null;
/** @type {ReturnType<typeof window.setInterval> | null} */
let claimHeartbeatId = null;
/** @type {import("./utils/portfolioEmbed.js").PortfolioEmbedPlan | null} */
let embedPlan = null;
/**
 * Prefetch embed-плана по URL (intro на home → к моменту claim уже готов).
 * @type {Map<string, {
 *   syncPlan: import("./utils/portfolioEmbed.js").PortfolioEmbedPlan;
 *   plan: import("./utils/portfolioEmbed.js").PortfolioEmbedPlan | null;
 *   ready: Promise<import("./utils/portfolioEmbed.js").PortfolioEmbedPlan>;
 * }>}
 */
const embedPrefetchByUrl = new Map();
/** @type {string} */
let portfolioName = getStrings().brandName;

/** Надиктовка с /review → answers.dictation */
let dictationText = "";
/** Уже отполированный текст заметок (не полировать повторно на submit). */
let dictationPolishedText = "";
/** Уже отполированный текст совета. */
let advicePolishedText = "";
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
 * Вкладка / сегмент home из текущего URL (и запомнить в `lastHomeView`).
 * @returns {{ tab: import("./utils/homeRoute.js").HomeTabId; filter: import("./utils/homeRoute.js").MineFilterId }}
 */
function currentHomeView() {
  lastHomeView = parseHomeView(
    typeof window !== "undefined" ? window.location.search : "",
  );
  return lastHomeView;
}

/**
 * Вид home после async-паузы в `applyRoute`.
 *
 * Пока ждём reconcile, `activeRouteId` ещё старый → клик по вкладке обновляет
 * `lastHomeView` и UI, но не URL (`onViewChange` рано выходит). Чистый
 * `currentHomeView()` тогда откатывает таб на значение из URL (~1с спустя).
 *
 * - `popstate` (Back/Forward): URL — источник правды.
 * - Home уже на экране: доверяем `lastHomeView`, URL подтягиваем к нему.
 * - Иначе (cold open): URL.
 *
 * @param {{ reason?: 'start' | 'navigate' | 'popstate' }} [opts]
 * @returns {{ tab: import("./utils/homeRoute.js").HomeTabId; filter: import("./utils/homeRoute.js").MineFilterId }}
 */
function resolveHomeView(opts = {}) {
  const fromUrl = parseHomeView(
    typeof window !== "undefined" ? window.location.search : "",
  );
  if (opts.reason === "popstate") {
    lastHomeView = fromUrl;
    return lastHomeView;
  }
  const homeOpen = Boolean(homeScreen && !homeScreen.root.hidden);
  if (homeOpen) {
    canonicalizeHomeSearch(lastHomeView);
    return lastHomeView;
  }
  lastHomeView = fromUrl;
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

/** @type {ReturnType<typeof import("./components/review-panel/ReviewPanel.js").createReviewPanel> | null} */
let reviewPanel = null;
/** @type {ReturnType<typeof import("./components/review-screen/ReviewScreen.js").createReviewScreen> | null} */
let reviewScreen = null;
/** @type {Promise<{ reviewPanel: NonNullable<typeof reviewPanel>; reviewScreen: NonNullable<typeof reviewScreen> }> | null} */
let reviewWorkspacePromise = null;

async function ensureReviewWorkspace() {
  if (reviewPanel && reviewScreen) {
    return { reviewPanel, reviewScreen };
  }
  if (!reviewWorkspacePromise) {
    reviewWorkspacePromise = (async () => {
      const [{ createReviewPanel }, { createReviewScreen }] = await Promise.all([
        import("./components/review-panel/ReviewPanel.js"),
        import("./components/review-screen/ReviewScreen.js"),
      ]);
      if (reviewPanel && reviewScreen) {
        return { reviewPanel, reviewScreen };
      }
      const panel = createReviewPanel({
        getPortfolioName: () => portfolioName,
        onReportReveal: (active, payload) => {
          setReviewReportReveal(active, payload);
        },
        onDictationToggle: () => {
          if (activeRouteId !== "quiz") return;
          void toggleDictation("advice");
        },
        onComplete: (answers) => {
          const pid = portfolioId;
          reviewSubmitPromise = (async () => {
            try {
              await stopDictation({ polish: false });
              const locale = getLocale();
              const dictation = dictationText.trim().slice(0, DICTATION_MAX_LEN);
              const adviceRaw =
                answers && typeof answers.advice === "string"
                  ? answers.advice.trim()
                  : "";
              const needsDictationPolish =
                Boolean(dictation) && dictation !== dictationPolishedText;
              const needsAdvicePolish =
                Boolean(adviceRaw) && adviceRaw !== advicePolishedText;

              const [nextDictation, nextAdvice] = await Promise.all([
                needsDictationPolish
                  ? polishDictationText(dictation, {
                      maxLen: DICTATION_MAX_LEN,
                      locale,
                    })
                  : Promise.resolve(dictation),
                needsAdvicePolish
                  ? polishDictationText(adviceRaw, {
                      maxLen: ADVICE_MAX_LEN,
                      locale,
                    })
                  : Promise.resolve(adviceRaw),
              ]);

              if (nextDictation) {
                dictationText = nextDictation;
                dictationPolishedText = nextDictation;
              }
              let payload = answers;
              if (adviceRaw) {
                payload = { ...answers, advice: nextAdvice };
                advicePolishedText = nextAdvice;
                reviewPanel?.setAdviceText?.(nextAdvice);
              }
              if (payload && nextDictation) {
                payload = { ...payload, dictation: nextDictation };
              }
              if (pid) {
                await submitPortfolioReview(pid, payload ?? null);
                reviewSubmitted = true;
                claimHeld = false;
                clearPersistedReviewClaim();
                stopClaimHeartbeat();
                void awardReviewReward();
                removeCachedHomeListItem(getSession()?.userId, "feed", pid);
                track("review_submitted", { portfolio_id: pid });
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
            void prewarmNextReviewCase();
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
            go("home", {
              replace: true,
              search: buildHomeSearch(lastHomeView),
            });
          })();
        },
        onNextCase: () => {
          void openNextReviewCase();
        },
      });
      const screen = createReviewScreen({
        content: panel.root,
      });
      reviewPanel = panel;
      reviewScreen = screen;
      setReviewReportReveal = screen.setReportReveal;
      document.body.append(screen.root);
      return { reviewPanel: panel, reviewScreen: screen };
    })();
  }
  return reviewWorkspacePromise;
}

/** @type {ReturnType<typeof import("./components/success-screen/SuccessScreen.js").createSuccessScreen> | null} */
let successScreen = null;
/** @type {Promise<NonNullable<typeof successScreen>> | null} */
let successScreenPromise = null;

async function ensureSuccessScreen() {
  if (successScreen) return successScreen;
  if (!successScreenPromise) {
    successScreenPromise = import(
      "./components/success-screen/SuccessScreen.js"
    ).then(({ createSuccessScreen }) => {
      if (successScreen) return successScreen;
      successScreen = createSuccessScreen({
        onPrimary: () => {
          pendingSuccessPreset = "generic";
          go("home", {
            replace: true,
            search: buildHomeSearch(lastHomeView),
          });
        },
        onSecondary: () => {
          pendingSuccessPreset = "generic";
          go("home", {
            replace: true,
            search: buildHomeSearch(lastHomeView),
          });
        },
      });
      document.body.append(successScreen.root);
      return successScreen;
    });
  }
  return successScreenPromise;
}

/** @type {ReturnType<typeof import("./components/report-screen/ReportScreen.js").createReportScreen> | null} */
let reportScreen = null;
/** @type {Promise<NonNullable<typeof reportScreen>> | null} */
let reportScreenPromise = null;

async function ensureReportScreen() {
  if (reportScreen) return reportScreen;
  if (!reportScreenPromise) {
    reportScreenPromise = import(
      "./components/report-screen/ReportScreen.js"
    ).then(({ createReportScreen }) => {
      if (reportScreen) return reportScreen;
      reportScreen = createReportScreen({
        onPrimary: () => {
          pendingReportPortfolioId = null;
          pendingReportPortfolioName = "";
          go("home", {
            replace: true,
            search: buildHomeSearch(lastHomeView),
          });
        },
      });
      document.body.append(reportScreen.root);
      return reportScreen;
    });
  }
  return reportScreenPromise;
}

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
  clearMyProfileCache();
  clearSession();
  resetAnalytics();
  clearSubmittedPortfolios();
  setPendingAuthEmail(null);
  try {
    window.sessionStorage.removeItem("obratka.authProviderError");
  } catch {
    /* ignore */
  }
  stopTimer();
  await releaseHeldClaim();
  clearPersistedReviewClaim();
  resetDictationSession();
  stopLegendaryPresenceHeartbeat();
  portfolioUrl = null;
  portfolioId = null;
  claimHeld = false;
  reviewSubmitted = false;
  stopClaimHeartbeat();
  embedPlan = null;
  embedPrefetchByUrl.clear();
  nextCasePreload = null;
  nextCasePrewarmGen += 1;
  portfolioName = getStrings().brandName;
  pendingSuccessPreset = "generic";
  pendingReportPortfolioId = null;
  pendingReportPortfolioName = "";
  leaveSessionShell();
  await closeReview();
  go(getInviteGatePassed() ? "auth" : "referral", { replace: true });
}

/**
 * Invite gate: код в UX-сессии или уже пройденный validate на этом устройстве.
 * @returns {boolean}
 */
function isReferralDone() {
  return Boolean(getSession()?.referralCode) || getInviteGatePassed();
}

/**
 * UX-кэш с userId: подтвердить живую Auth, подтянуть ban.
 * Мёртвый Auth (удалённый аккаунт) → полный выход на auth (или referral, если gate ещё не пройден).
 * Бан не разлогинивает — caller / resolveAccessibleRoute ведут на /banned.
 *
 * @returns {Promise<"ok" | "banned" | "gone">}
 */
async function reconcileSessionAccess() {
  const cached = getSession();
  if (!cached?.userId) return "ok";

  const supabase = getSupabase();
  if (supabase) {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error && import.meta.env.DEV) {
        console.warn("[session] getUser", error.message);
      }
      if (!user?.id) {
        await exitAuthenticatedSession();
        return "gone";
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[session] getUser", err);
      }
      /* Сеть/исключение — не разлогинивать; ban проверим через refresh. */
    }
  }

  try {
    const session = (await refreshSessionFromProfile()) ?? getSession();
    if (session?.banned) return "banned";
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[session] refresh", err);
    }
  }
  return getSession()?.banned ? "banned" : "ok";
}

const banScreen = createBanScreen({
  onExit: exitAuthenticatedSession,
});
document.body.append(banScreen.root);

const desktopOnlyScreen = createDesktopOnlyScreen();
document.body.append(desktopOnlyScreen.root);

/** Узкий viewport: полный desktop-only гейт. */
let desktopOnlyActive = false;
/** Один раз за загрузку страницы — не спамить при ресайзе. */
let desktopOnlyGateTracked = false;

let remainingMs = SESSION_TOTAL_MS;
let timerId = null;
/** Точный дедлайн конца сессии (wall-clock) — для external, пока вкладка в фоне. */
let sessionDeadlineMs = null;
/** setTimeout на дедлайн — надёжнее throttled setInterval в фоне. */
let sessionEndTimeoutId = null;
/** iframe: таймер на паузе, пока вкладка скрыта. */
let timerPaused = false;
let sessionEnded = false;
/** Таймер уже запущен в текущей сессии (для external — после кнопки). */
let sessionStarted = false;

/** @type {HTMLAudioElement | null} */
let timerEndAudio = null;

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
    await releaseOrphanedReviewClaim();
    return;
  }
  const id = portfolioId;
  claimHeld = false;
  await releasePortfolioClaim(id);
  clearPersistedReviewClaim();
}

/**
 * Same-tab orphan после failed pagehide keepalive: storage есть, claimHeld нет.
 * Не трогает чужую вкладку (sessionStorage per-tab).
 * @returns {Promise<void>}
 */
async function releaseOrphanedReviewClaim() {
  if (claimHeld) return;
  const id = readPersistedReviewClaim();
  if (!id) return;
  await releasePortfolioClaim(id);
  clearPersistedReviewClaim();
}

/** Защита от двойного клика «Следующий кейс». */
let nextCaseOpening = false;

/** TTL прогрева ленты на done-экране. */
const NEXT_CASE_PRELOAD_TTL_MS = 60_000;

/**
 * @type {{
 *   excludeId: string | null;
 *   items: import("./api/portfolios.js").PortfolioQueueItem[];
 *   at: number;
 * } | null}
 */
let nextCasePreload = null;
/** Инвалидация устаревших prewarm при повторном done. */
let nextCasePrewarmGen = 0;

/**
 * Кандидаты на «Следующий кейс» (без текущего portfolioId).
 * @param {import("./api/portfolios.js").PortfolioQueueItem[]} items
 * @param {string | null} excludeId
 * @returns {import("./api/portfolios.js").PortfolioQueueItem[]}
 */
function nextCaseCandidates(items, excludeId) {
  return items.filter((item) => {
    if (excludeId && item.id === excludeId) return false;
    return isPortfolioOpenForReview(item);
  });
}

/**
 * На done: сразу показать «Следующий кейс» с лоадером; свежая лента +
 * prefetch embed 1–2 кандидатов; без кандидатов — empty-подпись.
 * @returns {Promise<void>}
 */
async function prewarmNextReviewCase() {
  const excludeId = portfolioId;
  const gen = ++nextCasePrewarmGen;
  reviewPanel?.setNextCaseVisible?.(true);
  reviewPanel?.setNextCasePreparing?.(true);
  try {
    const items = await listPortfoliosForReview();
    if (gen !== nextCasePrewarmGen) return;
    nextCasePreload = { excludeId, items, at: Date.now() };
    const candidates = nextCaseCandidates(items, excludeId);
    reviewPanel?.setNextCasePreparing?.(false);
    reviewPanel?.setNextCaseVisible?.(true);
    reviewPanel?.setNextCaseEmpty?.(candidates.length === 0);
    for (const item of candidates.slice(0, 2)) {
      if (item.url) prefetchPortfolioEmbed(item.url);
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[review] prewarmNextReviewCase", err);
    }
    if (gen !== nextCasePrewarmGen) return;
    nextCasePreload = null;
    reviewPanel?.setNextCasePreparing?.(false);
    reviewPanel?.setNextCaseVisible?.(true);
    reviewPanel?.setNextCaseEmpty?.(true);
  }
}

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
  if (!isDesktopViewport() || desktopOnlyActive) return false;
  if (item?.isOwn || item?.reviewedByMe) return false;
  const id = typeof item?.id === "string" ? item.id : "";
  if (!id) return false;

  if (!isPortfolioOpenForReview(item)) {
    track("review_claim_failed", { reason: "client_no_slots" });
    if (showNoSlotsNotice) {
      const t = getStrings();
      homeScreen?.showNotice({
        title: t.homeNoSlotsTitle,
        body: t.homeNoSlotsBody,
        closeLabel: t.homeNoSlotsClose,
        closeAria: t.homeNoSlotsCloseAria,
      });
      void homeScreen?.refresh();
    }
    return false;
  }

  try {
    await claimPortfolioReview(id);
  } catch (err) {
    const code = portfolioRpcErrorCode(err);
    track("review_claim_failed", { reason: code || "unknown" });
    if (code === "no_slots") {
      if (showNoSlotsNotice) {
        const t = getStrings();
        homeScreen?.showNotice({
          title: t.homeNoSlotsTitle,
          body: t.homeNoSlotsBody,
          closeLabel: t.homeNoSlotsClose,
          closeAria: t.homeNoSlotsCloseAria,
        });
        void homeScreen?.refresh();
      }
      return false;
    }
    if (code === "already_reviewed") {
      if (showNoSlotsNotice) {
        void homeScreen?.refresh();
      }
      return false;
    }
    if (import.meta.env.DEV) {
      console.warn("[review] claimPortfolioReview", err);
    }
    if (showNoSlotsNotice) {
      void homeScreen?.refresh();
    }
    return false;
  }

  claimHeld = true;
  persistReviewClaim(id);
  void refreshCachedAccessToken();
  reviewSubmitted = false;
  reviewSubmitPromise = null;
  stopTimer();
  sessionEnded = false;
  sessionStarted = false;
  timerPaused = false;
  sessionDeadlineMs = null;
  remainingMs = SESSION_TOTAL_MS;
  renderTimer();
  // Сначала live-флаги, потом reset/sync — иначе Rec остаётся hidden
  // до конца async applyRoute (reconcileSessionAccess).
  resetDictationSession();
  enterSessionShell();
  await closeReview();
  await applyPortfolio(item.url, {
    portfolioId: id,
    applicantName: item.name,
    applicantAvatar: item.avatarUrl,
  });
  startClaimHeartbeat();
  track("review_claimed", { portfolio_id: id });
  void ensureReviewWorkspace();
  go("review");
  void homeScreen?.close();
  if (embedPlan?.mode === "external") {
    armSession();
    return true;
  }
  startTimer();
  return true;
}

/**
 * После done: прогретая лента (или свежая) → claim → `/review`.
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

    /**
     * @param {import("./api/portfolios.js").PortfolioQueueItem[]} list
     * @returns {Promise<boolean>}
     */
    async function tryClaimFromList(list) {
      for (const item of list) {
        if (excludeId && item.id === excludeId) continue;
        if (!isPortfolioOpenForReview(item)) continue;
        if (item.url) prefetchPortfolioEmbed(item.url);
        const started = await claimAndStartReview(item, {
          showNoSlotsNotice: false,
        });
        if (started) {
          nextCasePreload = null;
          return true;
        }
      }
      return false;
    }

    const preload = nextCasePreload;
    const preloadFresh =
      Boolean(preload) &&
      preload.excludeId === excludeId &&
      Date.now() - preload.at < NEXT_CASE_PRELOAD_TTL_MS;

    if (preloadFresh) {
      if (await tryClaimFromList(preload.items)) return;
    }

    let items;
    try {
      items = await listPortfoliosForReview();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[review] listPortfoliosForReview", err);
      }
      reviewPanel?.setNextCaseBusy?.(false);
      reviewPanel?.setNextCaseVisible?.(false);
      go("home", {
        replace: true,
        search: buildHomeSearch(lastHomeView),
      });
      return;
    }

    if (await tryClaimFromList(items)) return;

    reviewPanel?.setNextCaseBusy?.(false);
    reviewPanel?.setNextCaseVisible?.(false);
    go("home", {
      replace: true,
      search: buildHomeSearch(lastHomeView),
    });
  } finally {
    nextCaseOpening = false;
  }
}

/**
 * Сброс локальной review-сессии после ухода с /review|/quiz|/done.
 * Claim к этому моменту уже released или снят триггером после submit.
 */
function clearReviewSessionState() {
  stopTimer();
  sessionEnded = false;
  sessionStarted = false;
  timerPaused = false;
  sessionDeadlineMs = null;
  remainingMs = SESSION_TOTAL_MS;
  renderTimer();
  portfolioUrl = null;
  portfolioId = null;
  reviewSubmitted = false;
  reviewSubmitPromise = null;
  claimHeld = false;
  embedPlan = null;
  nextCasePreload = null;
  nextCasePrewarmGen += 1;
  portfolioName = getStrings().brandName;
  // После снятия claimHeld — иначе sync снова покажет Rec.
  resetDictationSession();
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
  // Не завязывать на activeRouteId === "review": shell входит до applyRoute,
  // а route выставляется только после await reconcileSessionAccess.
  const onLiveReview = Boolean(claimHeld) && !sessionEnded;
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
  reviewPanel?.setDictationSupported(isWebSpeechSupported());
  reviewPanel?.setDictationRecording(
    dictationRecording && dictationTarget === "advice",
  );
}

/**
 * @returns {NonNullable<ReturnType<typeof createDictationEngine>> | null}
 */
function ensureDictationEngine() {
  if (dictationEngine) {
    syncDictationBackgroundPolicy();
    return dictationEngine;
  }
  dictationEngine = createDictationEngine({ lang: speechLangForLocale() });
  if (!dictationEngine) return null;
  syncDictationBackgroundPolicy();
  dictationEngine.onTranscript((finalText, interim) => {
    const combined = [finalText, interim].filter(Boolean).join(" ").trim();
    if (dictationTarget === "advice") {
      // Пустой flush (stop без речи) не должен затирать уже набранный/надиктованный текст.
      if (!combined) return;
      reviewPanel?.setDictationTranscript(combined);
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

/** External: держать STT при уходе на вкладку портфолио; iframe — обычный pause. */
function syncDictationBackgroundPolicy() {
  dictationEngine?.setKeepAliveInBackground?.(embedPlan?.mode === "external");
}

/**
 * @param {{ polish?: boolean }} [opts]
 */
async function stopDictation(opts = {}) {
  const target = dictationTarget;
  if (dictationEngine) {
    await dictationEngine.stop();
  }
  dictationRecording = false;
  setDictationWaveform();
  syncDictationChrome();
  if (opts.polish) {
    await polishStoppedDictation(target);
  }
}

/**
 * Post-edit после stop: notes → dictationText; advice → поле совета.
 * @param {"notes" | "advice"} target
 */
async function polishStoppedDictation(target) {
  const locale = getLocale();
  if (target === "advice") {
    const form = reviewPanel?.form;
    const raw = form
      ? String(new FormData(form).get("advice") || "").trim()
      : "";
    if (!raw) return;
    const polished = await polishDictationText(raw, {
      maxLen: ADVICE_MAX_LEN,
      locale,
    });
    advicePolishedText = polished;
    reviewPanel?.setAdviceText?.(polished);
    return;
  }
  const raw = dictationText.trim();
  if (!raw) return;
  dictationText = await polishDictationText(raw, {
    maxLen: DICTATION_MAX_LEN,
    locale,
  });
  dictationPolishedText = dictationText;
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
      await stopDictation({ polish: true });
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
  dictationPolishedText = "";
  advicePolishedText = "";
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

/**
 * CTA external UI: до старта — «Открыть и начать», после — «Открыть сайт»
 * (повторный клик только re-open вкладки, таймер не трогает).
 */
function syncExternalOpenButton() {
  if (!openExternalBtn) return;
  const key = sessionStarted ? "embedBlockedOpenSite" : "embedBlockedOpen";
  openExternalBtn.setAttribute("data-i18n", key);
  const label = getStrings()[key];
  if (typeof label === "string" && label) {
    openExternalBtn.textContent = label;
  }
}

function syncLocaleDependentAttrs() {
  const t = getStrings();

  if (frame) {
    frame.title = formatString(t.iframeTitle, { name: portfolioName });
  }

  if (externalMediaVideo) {
    const mediaAria = t.embedBlockedMediaAria ?? "";
    if (mediaAria) {
      externalMediaVideo.setAttribute("aria-label", mediaAria);
    } else {
      externalMediaVideo.removeAttribute("aria-label");
    }
  }

  syncExternalOpenButton();
  syncDictationChrome();
}

/**
 * Видео-инструкция в слоте external UI (primer_not_iframe).
 * @returns {HTMLVideoElement | null}
 */
function ensureExternalMediaVideo() {
  if (externalMediaVideo) return externalMediaVideo;
  if (!externalMedia) return null;

  const video = document.createElement("video");
  video.className = "iframe-shell__external-media-video";
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = false;
  video.preload = "metadata";
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.disablePictureInPicture = true;
  video.controls = false;
  video.setAttribute("aria-hidden", "false");

  externalMedia.append(video);
  externalMediaVideo = video;
  void loadExternalEmbedVideoUrl().then((url) => {
    if (externalMediaVideo === video) video.src = url;
  });
  return video;
}

/**
 * @param {boolean} isExternal
 */
function syncExternalMediaPlayback(isExternal) {
  const video = ensureExternalMediaVideo();
  if (!video) return;
  if (isExternal) {
    try {
      video.currentTime = 0;
    } catch {
      /* ignore seek before ready */
    }
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        /* autoplay can be blocked — silent */
      });
    }
    return;
  }
  video.pause();
  try {
    video.currentTime = 0;
  } catch {
    /* ignore */
  }
}

function openPortfolioExternally() {
  if (!embedPlan?.openUrl) return;
  window.open(embedPlan.openUrl, "_blank", "noopener,noreferrer");
}

/**
 * @param {string} url
 * @param {import("./utils/portfolioEmbed.js").PortfolioEmbedPlan} plan
 */
function rememberEmbedPrefetch(url, plan) {
  const safeUrl = normalizePortfolioUrl(url);
  if (!safeUrl || !plan) return;
  const ready = Promise.resolve(plan);
  embedPrefetchByUrl.set(safeUrl, {
    syncPlan: plan,
    plan,
    ready,
  });
}

/**
 * Старт probe на intro (или заранее перед claim). Идемпотентно по URL.
 * @param {string | null | undefined} url
 */
function prefetchPortfolioEmbed(url) {
  const safeUrl = normalizePortfolioUrl(url);
  if (!safeUrl) return;
  if (embedPrefetchByUrl.has(safeUrl)) return;

  const syncPlan = resolvePortfolioEmbed(safeUrl);
  if (
    syncPlan.mode === "external" ||
    syncPlan.allowFullscreen ||
    !syncPlan.frameSrc
  ) {
    rememberEmbedPrefetch(safeUrl, syncPlan);
    return;
  }

  const ready = resolvePortfolioEmbedPlan(safeUrl, {
    embedderOrigin: window.location.origin,
  }).catch(() => syncPlan);

  embedPrefetchByUrl.set(safeUrl, {
    syncPlan,
    plan: null,
    ready,
  });

  void ready.then((plan) => {
    const entry = embedPrefetchByUrl.get(safeUrl);
    if (!entry || entry.ready !== ready) return;
    embedPrefetchByUrl.set(safeUrl, {
      syncPlan: entry.syncPlan,
      plan,
      ready,
    });
  });
}

/**
 * План для `/review`: ждём prefetch до EMBED_PREFETCH_WAIT_MS, иначе sync.
 * @param {string} safeUrl
 * @returns {Promise<import("./utils/portfolioEmbed.js").PortfolioEmbedPlan>}
 */
async function resolveEmbedPlanForReview(safeUrl) {
  prefetchPortfolioEmbed(safeUrl);
  const entry = embedPrefetchByUrl.get(safeUrl);
  if (!entry) {
    return resolvePortfolioEmbed(safeUrl);
  }
  if (entry.plan) {
    return entry.plan;
  }

  let settled = false;
  const plan = await Promise.race([
    entry.ready.then((resolved) => {
      settled = true;
      return resolved;
    }),
    new Promise((resolve) => {
      window.setTimeout(() => {
        if (!settled) resolve(entry.syncPlan);
      }, EMBED_PREFETCH_WAIT_MS);
    }),
  ]);
  return /** @type {import("./utils/portfolioEmbed.js").PortfolioEmbedPlan} */ (
    plan
  );
}

function clearFrameBlockWatch() {
  if (detachFrameBlockWatch) {
    detachFrameBlockWatch();
    detachFrameBlockWatch = null;
  }
}

/**
 * Optimistic iframe → external UI (Readymag на своём домене / XFO / сеть).
 * Если таймер уже тикал как у iframe — сбрасываем и ждём кнопку «Открыть».
 * @param {string} hostLabel
 */
function escalateOptimisticEmbedToExternal(hostLabel) {
  if (!embedPlan || embedPlan.mode !== "iframe") return;
  const openUrl = embedPlan.openUrl || portfolioUrl || "";
  if (!openUrl) return;

  const wasRunning = sessionStarted && !sessionEnded;
  const nextPlan = toExternalEmbedPlan(
    openUrl,
    hostLabel || embedPlan.hostLabel || "site",
  );
  rememberEmbedPrefetch(openUrl, nextPlan);
  applyEmbedPlan(nextPlan);
  if (wasRunning || sessionStarted) {
    armSession();
  }
}

/**
 * Следим за load/error optimistic iframe: blank/about:neterror → external.
 * @param {import("./utils/portfolioEmbed.js").PortfolioEmbedPlan} plan
 * @param {number} generation
 */
function watchOptimisticFrame(plan, generation) {
  clearFrameBlockWatch();
  // Спец-embed (Figma/YouTube) и пустой src не мониторим.
  if (!frame || plan.mode !== "iframe" || !plan.frameSrc || plan.allowFullscreen) {
    return;
  }

  let loadFired = false;
  let settled = false;

  const finish = () => {
    if (settled || generation !== embedWatchGeneration) return;
    settled = true;
    clearFrameBlockWatch();
    if (embedPlan?.mode !== "iframe") return;
    const blocked = isLikelyFrameBlocked(frame);
    if (!blocked) return;
    escalateOptimisticEmbedToExternal(plan.hostLabel);
  };

  const onLoad = () => {
    loadFired = true;
    window.setTimeout(finish, FRAME_BLOCK_SETTLE_MS);
  };

  const onError = () => {
    finish();
  };

  const timeoutId = window.setTimeout(() => {
    if (!loadFired) finish();
  }, FRAME_BLOCK_WATCH_MS);

  frame.addEventListener("load", onLoad);
  frame.addEventListener("error", onError);

  detachFrameBlockWatch = () => {
    window.clearTimeout(timeoutId);
    frame.removeEventListener("load", onLoad);
    frame.removeEventListener("error", onError);
  };
}

/**
 * CORS-probe: маркеры Readymag в HTML (часто fail без ACAO → iframe watch).
 * @param {string} url
 * @param {number} generation
 */
function probeOptimisticReadymag(url, generation) {
  void probeReadymagPortfolio(url).then((isReadymag) => {
    if (!isReadymag || generation !== embedWatchGeneration) return;
    if (embedPlan?.mode !== "iframe") return;
    escalateOptimisticEmbedToExternal("Readymag");
  });
}

/**
 * Edge GET: XFO / CSP frame-ancestors (клиент CORS не видит).
 * @param {string} url
 * @param {number} generation
 */
function probeOptimisticFramePolicy(url, generation) {
  void probePortfolioEmbed(url, {
    embedderOrigin: window.location.origin,
  }).then((result) => {
    if (generation !== embedWatchGeneration) return;
    if (embedPlan?.mode !== "iframe") return;
    if (result.canFrame !== false) return;
    escalateOptimisticEmbedToExternal(
      result.hostLabel || embedPlan.hostLabel || "site",
    );
  });
}

/**
 * @param {import("./utils/portfolioEmbed.js").PortfolioEmbedPlan} plan
 */
function applyEmbedPlan(plan) {
  embedWatchGeneration += 1;
  const generation = embedWatchGeneration;
  clearFrameBlockWatch();

  embedPlan = plan;
  syncDictationBackgroundPolicy();

  if (!frame || !frameWrap || !externalViewer) return;

  frame.setAttribute("sandbox", PORTFOLIO_FRAME_SANDBOX);
  frame.setAttribute("referrerpolicy", "no-referrer");

  const isExternal = plan.mode === "external";
  frameWrap.classList.toggle("iframe-shell__frame--external", isExternal);
  externalViewer.hidden = !isExternal;
  externalViewer.setAttribute("aria-hidden", isExternal ? "false" : "true");
  syncExternalMediaPlayback(isExternal);

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
  watchOptimisticFrame(plan, generation);
  // Спец-embed (Figma/YouTube) не трогаем probe'ом; кастомные домены — да.
  if (plan.frameSrc && plan.openUrl && !plan.allowFullscreen) {
    probeOptimisticFramePolicy(plan.openUrl, generation);
    probeOptimisticReadymag(plan.openUrl, generation);
  }
}

function syncPortfolioName(label) {
  portfolioName =
    typeof label === "string" && label.trim()
      ? label.trim()
      : getStrings().brandName;
  syncLocaleDependentAttrs();
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
async function applyPortfolio(url, options = {}) {
  const safeUrl = normalizePortfolioUrl(url);
  portfolioId =
    typeof options.portfolioId === "string" && options.portfolioId.trim()
      ? options.portfolioId.trim()
      : null;
  const applicantName =
    typeof options.applicantName === "string" && options.applicantName.trim()
      ? options.applicantName.trim()
      : safeUrl || String(url || "").trim() || getStrings().brandName;

  syncPortfolioName(applicantName);

  if (!safeUrl) {
    portfolioUrl = "";
    applyEmbedPlan({
      mode: "iframe",
      openUrl: "",
      frameSrc: null,
      allowFullscreen: false,
      hostLabel: "",
    });
    return;
  }

  portfolioUrl = safeUrl;
  const plan = await resolveEmbedPlanForReview(safeUrl);
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

  void (async () => {
    await ensureReviewWorkspace();
    await stopDictation({ polish: true });

    void homeScreen?.close();
    void settingsScreen?.close();
    void urlScreen?.close();
    void onboardingScreen?.close({ handoff: true });
    void authScreen.close({ handoff: true });
    void referralScreen.close({ handoff: true });
    void successScreen?.close();
    void reportScreen?.close();

    frameWrap.classList.add("iframe-shell__frame--locked");
    reviewPanel?.reset();
    reviewPanel?.open();
    reviewScreen?.open();
    syncRoute("quiz");

    window.setTimeout(() => {
      reviewPanel?.focus();
    }, getMotionFocusDelayMs());
  })();
}

async function closeReview() {
  if (!frameWrap) return;

  frameWrap.classList.remove("iframe-shell__frame--locked");
  reviewPanel?.close();
  if (reviewScreen) await reviewScreen.close();
  reviewPanel?.reset();
}

function lockFrameAndShowReview() {
  if (!frameWrap || !frame || sessionEnded) return;
  if (activeRouteId !== "review" || !claimHeld || reviewSubmitted) return;
  sessionEnded = true;
  syncDictationChrome();
  playTimerEndSound();
  startTabAttention({
    alertTitle: getStrings().metaTitleAttention,
    alertFaviconHref: TAB_ATTENTION_FAVICON,
  });
  openReview();
}

function isExternalEmbedSession() {
  return embedPlan?.mode === "external";
}

function clearSessionEndTimeout() {
  if (sessionEndTimeoutId != null) {
    window.clearTimeout(sessionEndTimeoutId);
    sessionEndTimeoutId = null;
  }
}

function scheduleSessionEndTimeout() {
  clearSessionEndTimeout();
  if (sessionDeadlineMs == null) return;
  const delay = Math.max(0, sessionDeadlineMs - Date.now());
  sessionEndTimeoutId = window.setTimeout(() => {
    sessionEndTimeoutId = null;
    finishSessionFromTimer();
  }, delay);
}

function playTimerEndSound() {
  void loadTimerEndUrl()
    .then((url) => {
      if (!timerEndAudio) {
        timerEndAudio = new Audio(url);
        timerEndAudio.preload = "auto";
      }
      timerEndAudio.currentTime = 0;
      return timerEndAudio.play();
    })
    .catch(() => {
      /* autoplay / background tab / load — молча */
    });
}

/** Прогреть Audio после user gesture (кнопка external / старт сессии). */
function warmTimerEndSound() {
  void loadTimerEndUrl()
    .then((url) => {
      if (!timerEndAudio) {
        timerEndAudio = new Audio(url);
        timerEndAudio.preload = "auto";
      }
      timerEndAudio.load();
    })
    .catch(() => {
      /* ignore */
    });
}

function finishSessionFromTimer() {
  if (sessionEnded) return;
  stopTimer();
  remainingMs = 0;
  sessionDeadlineMs = null;
  timerPaused = false;
  renderTimer();
  lockFrameAndShowReview();
}

function tick() {
  if (sessionDeadlineMs != null) {
    remainingMs = Math.max(0, sessionDeadlineMs - Date.now());
  } else {
    remainingMs -= TIMER_TICK_MS;
  }
  renderTimer();

  if (remainingMs <= 0) {
    finishSessionFromTimer();
  }
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
  clearSessionEndTimeout();
}

/** Сбросить таймер на полный срок без запуска (ждём кнопку во external). */
function armSession() {
  stopTimer();
  remainingMs = SESSION_TOTAL_MS;
  sessionDeadlineMs = null;
  timerPaused = false;
  sessionEnded = false;
  sessionStarted = false;
  renderTimer();
  syncExternalOpenButton();
}

function startTimer() {
  stopTimer();
  remainingMs = SESSION_TOTAL_MS;
  sessionEnded = false;
  sessionStarted = true;
  timerPaused = false;
  warmTimerEndSound();
  if (isExternalEmbedSession()) {
    // Wall-clock: не замирает, пока смотрят портфолио на другой вкладке.
    sessionDeadlineMs = Date.now() + remainingMs;
    scheduleSessionEndTimeout();
  } else {
    sessionDeadlineMs = null;
  }
  renderTimer();
  syncExternalOpenButton();
  timerId = window.setInterval(tick, TIMER_TICK_MS);
}

/**
 * iframe: пауза при уходе со вкладки (setInterval и так throttlit — делаем явно).
 * external: не трогаем — дедлайн wall-clock продолжает тикать.
 */
function pauseTimerForHiddenTab() {
  if (!sessionStarted || sessionEnded || timerPaused) return;
  if (isExternalEmbedSession()) return;
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
  clearSessionEndTimeout();
  timerPaused = true;
}

function resumeTimerAfterVisible() {
  if (!sessionStarted || sessionEnded || !timerPaused) return;
  timerPaused = false;
  if (remainingMs <= 0) {
    finishSessionFromTimer();
    return;
  }
  timerId = window.setInterval(tick, TIMER_TICK_MS);
}

/** Подтянуть remaining из дедлайна после возврата на вкладку (external). */
function syncExternalTimerFromDeadline() {
  if (!sessionStarted || sessionEnded || !isExternalEmbedSession()) return;
  if (sessionDeadlineMs == null) return;
  remainingMs = Math.max(0, sessionDeadlineMs - Date.now());
  renderTimer();
  if (remainingMs <= 0) {
    finishSessionFromTimer();
  }
}

/**
 * Кнопка во фрейме: первый клик — открыть портфолио и стартовать таймер;
 * дальше — только re-open вкладки («Открыть сайт»), без влияния на таймер.
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
  syncDictationChrome();
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
  syncExternalMediaPlayback(false);
}

/** @type {ReturnType<typeof createAppModal> | null} */
let abortReviewModal = null;
/** @type {{ sync: () => void } | null} */
let abortReviewRay = null;
/** @type {Promise<ReturnType<typeof createAppModal>> | null} */
let abortReviewModalPromise = null;

async function ensureAbortReviewModal() {
  if (abortReviewModal) return abortReviewModal;
  if (abortReviewModalPromise) return abortReviewModalPromise;

  abortReviewModalPromise = (async () => {
    const [{ createExplainerMediaRay }, photoMod] = await Promise.all([
      import("./components/home-screen/explainerMediaRay.js"),
      import("./assets/home/modal/currency-duck-leave.png"),
    ]);

    const abortReviewMedia = document.createElement("div");
    abortReviewMedia.className = "iframe-shell__abort-explainer-media";

    const ray = createExplainerMediaRay();
    abortReviewRay = ray;

    const abortReviewPhoto = document.createElement("img");
    abortReviewPhoto.className = "home-screen__explainer-media-photo";
    abortReviewPhoto.src = photoMod.default;
    abortReviewPhoto.alt = "";
    abortReviewPhoto.width = 1104;
    abortReviewPhoto.height = 536;
    abortReviewPhoto.decoding = "async";

    abortReviewMedia.append(ray.root, abortReviewPhoto);

    const modal = createAppModal({
      size: "md",
      primaryTone: "danger",
      onPrimary: () => {
        void confirmAbortReview();
      },
      onSecondary: () => {
        void modal.close();
      },
    });
    modal.content.append(abortReviewMedia);
    document.body.append(modal.root);
    abortReviewModal = modal;
    return modal;
  })();

  try {
    return await abortReviewModalPromise;
  } finally {
    abortReviewModalPromise = null;
  }
}

async function openAbortReviewModal() {
  const modal = await ensureAbortReviewModal();
  const t = getStrings();
  modal.setTitle(fixHangingPrepositions(t.reviewAbortTitle ?? ""));
  modal.setDescription(fixHangingPrepositions(t.reviewAbortDesc ?? ""));
  modal.setPrimaryLabel(t.reviewAbortConfirm ?? "");
  modal.setSecondaryLabel(t.reviewAbortCancel ?? "");
  modal.setCloseAriaLabel(t.reviewAbortCloseAria ?? t.modalCloseAria ?? "");
  modal.setPrimaryTone("danger");
  modal.setActionsVisible({ primary: true, secondary: true });
  modal.open();
  requestAnimationFrame(() => {
    abortReviewRay?.sync();
  });
}

function confirmAbortReview() {
  // Сразу с кейса: не ждать fade модалки и reconcile в applyRoute.
  if (abortReviewModal) {
    abortReviewModal.root.classList.remove("app-modal--open");
    abortReviewModal.root.hidden = true;
    abortReviewModal.root.setAttribute("aria-hidden", "true");
  }
  track("review_aborted", {
    portfolio_id: portfolioId || undefined,
    route_id: activeRouteId || undefined,
  });
  leaveSessionShell();
  void stopDictation();
  void ensureHomeScreen().then((screen) => {
    void screen.open(lastHomeView);
  });
  go("home", { search: buildHomeSearch(lastHomeView) });
}

function requestAbortReview() {
  if (reviewSubmitted) {
    go("home", { search: buildHomeSearch(lastHomeView) });
    return;
  }
  void openAbortReviewModal();
}

/** @type {ReturnType<typeof import("./components/url-screen/UrlScreen.js").createUrlScreen> | null} */
let urlScreen = null;
/** @type {Promise<NonNullable<typeof urlScreen>> | null} */
let urlScreenPromise = null;

async function ensureUrlScreen() {
  if (urlScreen) return urlScreen;
  if (!urlScreenPromise) {
    urlScreenPromise = import("./components/url-screen/UrlScreen.js").then(
      ({ createUrlScreen }) => {
        if (urlScreen) return urlScreen;
        urlScreen = createUrlScreen({
          onSubmit: async (url) => {
            if (!canSubmitPortfolio()) {
              go("home", {
                replace: true,
                search: buildHomeSearch(lastHomeView),
              });
              throw new Error("url.submit_locked");
            }
            syncRoute("success", { replace: true });
            try {
              const result = await submitPortfolio(url);
              if (typeof result?.balance === "number") {
                applySubmitBalance(result.balance);
              } else {
                await refreshSessionFromProfile();
              }
              track("portfolio_submitted");
            } catch {
              go("home", {
                replace: true,
                search: buildHomeSearch(lastHomeView),
              });
              throw new Error("url.submit_failed");
            }
          },
          onExit: () => {
            go("home", {
              replace: true,
              search: buildHomeSearch(lastHomeView),
            });
          },
        });
        document.body.append(urlScreen.root);
        return urlScreen;
      },
    );
  }
  return urlScreenPromise;
}

/** @type {ReturnType<typeof import("./components/settings-screen/SettingsScreen.js").createSettingsScreen> | null} */
let settingsScreen = null;
/** @type {Promise<NonNullable<typeof settingsScreen>> | null} */
let settingsScreenPromise = null;

async function ensureSettingsScreen() {
  if (settingsScreen) return settingsScreen;
  if (!settingsScreenPromise) {
    settingsScreenPromise = import(
      "./components/settings-screen/SettingsScreen.js"
    ).then(({ createSettingsScreen }) => {
      if (settingsScreen) return settingsScreen;
      settingsScreen = createSettingsScreen({
        onClose: () => {
          if (activeRouteId !== "settings") return;
          go("home", { search: buildHomeSearch(lastHomeView) });
        },
        onSaved: async () => {
          await refreshSessionFromProfile();
        },
      });
      document.body.append(settingsScreen.root);
      return settingsScreen;
    });
  }
  return settingsScreenPromise;
}

/** @type {ReturnType<typeof import("./components/home-screen/HomeScreen.js").createHomeScreen> | null} */
let homeScreen = null;
/** @type {Promise<NonNullable<typeof homeScreen>> | null} */
let homeScreenPromise = null;

async function ensureHomeScreen() {
  if (homeScreen) return homeScreen;
  if (!homeScreenPromise) {
    homeScreenPromise = import("./components/home-screen/HomeScreen.js").then(
      ({ createHomeScreen }) => {
        if (homeScreen) return homeScreen;
        homeScreen = createHomeScreen({
          onPreviewPortfolio: (item) => {
            if (item?.url) prefetchPortfolioEmbed(item.url);
          },
          onOpenPortfolio: async (item) => {
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
          onAddPortfolio: () => {
            if (!canSubmitPortfolio()) return;
            go("url");
          },
          onOpenSettings: () => {
            go("settings");
          },
          onBeforeOpenRules: async () => {
            // Правила и /settings — одна side-panel за раз, не стек.
            if (!settingsScreen?.isOpen()) return;
            if (activeRouteId === "settings") {
              syncRoute("home", { search: buildHomeSearch(lastHomeView) });
            }
            await settingsScreen.close();
          },
          onViewChange: ({ tab, filter, reason }) => {
            lastHomeView = { tab, filter };
            if (activeRouteId !== "home") return;
            appRouter?.navigate("home", {
              search: buildHomeSearch({ tab, filter }),
              replace: reason === "filter",
              silent: true,
            });
          },
          onSignOut: exitAuthenticatedSession,
        });
        document.body.append(homeScreen.root);
        return homeScreen;
      },
    );
  }
  return homeScreenPromise;
}

/** @type {ReturnType<typeof import("./components/onboarding-screen/OnboardingScreen.js").createOnboardingScreen> | null} */
let onboardingScreen = null;
/** @type {Promise<NonNullable<typeof onboardingScreen>> | null} */
let onboardingScreenPromise = null;

async function ensureOnboardingScreen() {
  if (onboardingScreen) return onboardingScreen;
  if (!onboardingScreenPromise) {
    onboardingScreenPromise = import(
      "./components/onboarding-screen/OnboardingScreen.js"
    ).then(({ createOnboardingScreen }) => {
      if (onboardingScreen) return onboardingScreen;
      onboardingScreen = createOnboardingScreen({
        onComplete: async (answers) => {
          const session = getSession() ?? {};
          setSession({
            ...session,
            onboardingDone: true,
            role:
              typeof answers?.role === "string" && answers.role
                ? answers.role
                : session.role || DEFAULT_ONBOARDING_ROLE,
            grade:
              typeof answers?.grade === "string"
                ? answers.grade
                : session.grade,
          });
          track("onboarding_done", {
            grade:
              typeof answers?.grade === "string" ? answers.grade : undefined,
          });
          go("home", {
            replace: true,
            handoff: true,
            search: buildHomeSearch(lastHomeView),
          });
        },
      });
      document.body.append(onboardingScreen.root);
      return onboardingScreen;
    });
  }
  return onboardingScreenPromise;
}

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
          ? clampReputation(profile.reputation)
          : next.reputation,
      onboardingDone: Boolean(profile.onboarding_done),
      role: profile.role ?? next.role,
      grade:
        typeof profile.grade === "string" && profile.grade.trim()
          ? profile.grade.trim()
          : null,
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
  if (next.userId) {
    identifyUser(next.userId, {
      grade: next.grade ?? undefined,
      tier: next.tier ?? undefined,
      onboarding_done: Boolean(next.onboardingDone),
    });
    track("auth_success", { provider });
  }
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
    setInviteGatePassed(true);
    track("referral_validated");
    go("auth", { handoff: true });
  },
});

document.body.append(
  referralScreen.root,
  authScreen.root,
  authCodeScreen.root,
);

/**
 * @param {import("./app/routes.js").AppRouteId} id
 * @param {{ handoff?: boolean }} [opts]
 */
async function applyRoute(id, opts = {}) {
  const handoff = Boolean(opts.handoff);
  /** @type {'start' | 'navigate' | 'popstate' | undefined} */
  const routeReason = opts.reason;
  const prevRouteId = activeRouteId;
  let session = getSession();

  /** Параллельный результат слота при запросе `/portfolio` (null — не запрашивали). */
  /** @type {boolean | null} */
  let urlSlotFree = null;

  if (session?.userId) {
    if (id === "url") {
      // Session + pending-слот параллельно — меньше лаг CTA «Закинуть».
      // Ошибка count (сеть / RLS) ≠ «слот занят»: fail-open, лимит жёстко
      // в submit_portfolio (too_many_pending). Иначе ложный toast при outage.
      const [access, slotResult] = await Promise.all([
        reconcileSessionAccess(),
        hasFreeMineSlot()
          .then((free) => /** @type {const} */ ({ ok: true, free }))
          .catch((err) => {
            if (import.meta.env.DEV) {
              console.warn("[route] hasFreeMineSlot", err);
            }
            return /** @type {const} */ ({ ok: false, free: true });
          }),
      ]);
      if (access === "gone") return;
      session = getSession();
      urlSlotFree = slotResult.free;
    } else if (id === "report" || id === "settings") {
      // Open по кэшу — settle+profile не блокируют первый paint /report
      // и side-panel настроек. Ban/gone догоняют фоном (exit уже внутри reconcile).
      void reconcileSessionAccess().then((access) => {
        if (access === "gone") return;
        if (access === "banned" && activeRouteId !== "banned") {
          go("banned", { replace: true });
        }
      });
    } else if (
      id === "home" &&
      (prevRouteId === "review" ||
        prevRouteId === "quiz" ||
        prevRouteId === "done" ||
        prevRouteId === "onboarding" ||
        // Home уже смонтирован (под settings / тот же /home): не блокировать
        // таббар на reconcile — иначе клик по вкладке за ~1с откатится.
        prevRouteId === "settings" ||
        prevRouteId === "home")
    ) {
      // Выход с review-workspace / онбординга / settings / home↔home:
      // не держать UI на сети — ban/gone догоняют фоном.
      void reconcileSessionAccess().then((access) => {
        if (access === "gone") return;
        if (access === "banned" && activeRouteId !== "banned") {
          go("banned", { replace: true });
        }
      });
    } else {
      const access = await reconcileSessionAccess();
      if (access === "gone") return;
      session = getSession();
    }
  }

  let accessible = resolveAccessibleRoute(id, {
    hasPortfolio: Boolean(portfolioUrl),
    hasSession: Boolean(session?.userId),
    onboardingDone: Boolean(session?.onboardingDone),
    referralDone: isReferralDone(),
    banned: Boolean(session?.banned),
  });

  /** Слот занят → home + notice (deep link / гонка без локального buzz). */
  let pendingLimitBlocked = false;

  if (accessible === "url") {
    // Иерархия: слот → монеты (как tryAddPortfolio / onAddPortfolio).
    // Count error → не блокируем как «слот занят» (см. fail-open выше).
    try {
      const slotFree =
        urlSlotFree != null ? urlSlotFree : await hasFreeMineSlot();
      if (!slotFree) {
        accessible = "home";
        pendingLimitBlocked = true;
      } else if (!canSubmitPortfolio()) {
        accessible = "home";
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[route] url slot gate", err);
      }
      if (!canSubmitPortfolio()) {
        accessible = "home";
      }
    }
  }

  if (accessible !== id) {
    syncRoute(accessible, {
      replace: true,
      ...(accessible === "home"
        ? { search: buildHomeSearch(lastHomeView) }
        : {}),
    });
    id = accessible;
  }

  // Узкий viewport: не поднимать review-shell / quiz под оверлеем.
  if (
    desktopOnlyActive &&
    (id === "review" || id === "quiz" || id === "done")
  ) {
    syncRoute("home", {
      replace: true,
      search: buildHomeSearch(lastHomeView),
    });
    id = "home";
  }

  activeRouteId = id;
  syncDictationChrome();
  {
    /** @type {Record<string, unknown>} */
    const pageProps = {};
    if (id === "home") {
      const view = resolveHomeView({ reason: routeReason });
      pageProps.tab = view.tab;
      pageProps.filter = view.filter;
    }
    trackPage(id, pageProps);
  }

  const showPendingLimitIfNeeded = () => {
    if (!pendingLimitBlocked) return;
    const t = getStrings();
    homeScreen?.showNotification(t.homeNotifySlotTaken ?? "");
  };

  // Back/Forward между вкладками home: экран уже смонтирован, меняем только вид.
  if (id === "home" && prevRouteId === "home" && !handoff) {
    const view = resolveHomeView({ reason: routeReason });
    canonicalizeHomeSearch(view);
    const home = await ensureHomeScreen();
    await home.setView(view);
    showPendingLimitIfNeeded();
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
  async function openTarget(target) {
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
      const screen = await ensureOnboardingScreen();
      screen.open(openOpts);
      // К «Начать» home уже в бандле — без гэпа на dynamic import.
      void ensureHomeScreen();
      return;
    }
    if (target === "home") {
      const view = resolveHomeView({ reason: routeReason });
      canonicalizeHomeSearch(view);
      const home = await ensureHomeScreen();
      // Возврат из side-panel настроек: home не закрывался — только вид,
      // иначе повторный entrance-каскад и скролл ленты в 0.
      if (prevRouteId === "settings") {
        void home.setView(view);
      } else {
        void home.open(view);
      }
      return;
    }
    if (target === "settings") {
      const home = await ensureHomeScreen();
      const settings = await ensureSettingsScreen();
      // Side-panel поверх home (как rules), deep link /settings сохраняем.
      // Не парсить search с /settings — иначе lastHomeView сбросится в feed.
      // Home уже на экране → только setView: иначе повторный entrance-каскад,
      // сброс скролла ленты и лишний refetch списков.
      if (prevRouteId === "home") {
        void home.setView(lastHomeView);
      } else {
        void home.open(lastHomeView);
      }
      // Правила и настройки не стекаются: закрыть rules перед settings.
      if (home.isRulesPanelOpen()) {
        await home.closeRulesPanel();
      }
      settings.open();
      return;
    }
    if (target === "url") {
      const screen = await ensureUrlScreen();
      screen.open("", openOpts);
      return;
    }
    if (target === "success") {
      const screen = await ensureSuccessScreen();
      screen.open({ preset: pendingSuccessPreset });
      return;
    }
    if (target === "report") {
      const screen = await ensureReportScreen();
      const fromSearch =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("id")
          : null;
      const reportId = pendingReportPortfolioId || fromSearch || null;
      screen.open({
        portfolioId: reportId,
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
    if (id !== "onboarding") closers.push(onboardingScreen?.close(closeOpts));
    if (id !== "home" && id !== "settings") closers.push(homeScreen?.close());
    if (id !== "settings") closers.push(settingsScreen?.close());
    if (id !== "url") closers.push(urlScreen?.close(closeOpts));
    if (id !== "success") closers.push(successScreen?.close());
    if (id !== "report") closers.push(reportScreen?.close());
    if (id !== "banned") closers.push(banScreen.close());
    await Promise.all(closers);
  }

  if (id === "banned") {
    leaveSessionShell();
    await releaseHeldClaim();
    clearReviewSessionState();
    await closeReview();
    await closeOthers();
    await openTarget("banned");
    return;
  }

  if (isReviewWorkspace) {
    enterSessionShell();
    await ensureReviewWorkspace();
    await closeOthers();

    if (id === "review") return;

    frameWrap?.classList.add("iframe-shell__frame--locked");
    reviewScreen?.open();
    reviewPanel?.open();
    if (id === "done") {
      reviewPanel?.openDone();
      return;
    }
    reviewPanel?.reset();
    reviewPanel?.open();
    window.setTimeout(() => {
      reviewPanel?.focus();
    }, getMotionFocusDelayMs());
    return;
  }

  leaveSessionShell();
  await releaseHeldClaim();
  clearReviewSessionState();
  await closeReview();

  // Handoff: сначала новый экран поверх, потом убрать предыдущий — visual не мигает.
  if (isBrandHandoff) {
    await openTarget(id);
    await closeOthers();
    return;
  }

  // Onboarding → home: home снизу/поверх с fade-in, brand уходит fade-out.
  // Не ждать refresh ленты — иначе клик «Начать» зависает на сети.
  if (isHomeReveal) {
    const home = await ensureHomeScreen();
    void home.open(resolveHomeView({ reason: routeReason }));
    await Promise.all([
      referralScreen.close({}),
      authScreen.close({}),
      authCodeScreen.close({}),
      onboardingScreen?.close({}),
      settingsScreen?.close(),
      urlScreen?.close({}),
      successScreen?.close(),
      reportScreen?.close(),
      banScreen.close(),
    ]);
    return;
  }

  await closeOthers();
  await openTarget(id);
  showPendingLimitIfNeeded();
}

appRouter = createAppRouter({
  onChange: (location, meta) => {
    const handoff = pendingHandoff;
    pendingHandoff = false;

    if (!location.id) {
      const session = getSession();
      const entry = resolveEntryScreen({
        hasSession: Boolean(session?.userId),
        onboardingDone: Boolean(session?.onboardingDone),
        referralDone: isReferralDone(),
        banned: Boolean(session?.banned),
      });
      const search = Object.fromEntries(location.search.entries());
      go(entry, { replace: true, search });
      return;
    }

    void applyRoute(location.id, { handoff, reason: meta.reason });
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
  if (!claimHeld || sessionEnded) return;
  void toggleDictation("notes");
});

abortReviewBtn?.addEventListener("click", () => {
  requestAbortReview();
});

applyDocumentI18n();
syncPortfolioName(getStrings().brandName);
renderTimer();
syncDictationChrome();

/**
 * Уход с review-workspace без модалки (гейт desktop-only).
 * @returns {Promise<void>}
 */
async function suspendReviewForDesktopOnlyGate() {
  const inReviewWorkspace =
    activeRouteId === "review" ||
    activeRouteId === "quiz" ||
    activeRouteId === "done" ||
    claimHeld;
  if (!inReviewWorkspace) return;

  track("review_aborted", {
    portfolio_id: portfolioId || undefined,
    route_id: activeRouteId || undefined,
    reason: "desktop_only_gate",
  });
  leaveSessionShell();
  void stopDictation();
  await releaseHeldClaim();

  if (
    activeRouteId === "review" ||
    activeRouteId === "quiz" ||
    activeRouteId === "done"
  ) {
    void ensureHomeScreen().then((screen) => {
      void screen.open(lastHomeView);
    });
    go("home", { search: buildHomeSearch(lastHomeView), replace: true });
  }
}

/**
 * @param {boolean} isDesktop
 */
function syncDesktopOnlyGate(isDesktop) {
  const shouldGate = !isDesktop;
  if (shouldGate === desktopOnlyActive) return;
  desktopOnlyActive = shouldGate;
  document.body.classList.toggle("desktop-only-gated", shouldGate);

  if (shouldGate) {
    desktopOnlyScreen.open();
    if (!desktopOnlyGateTracked) {
      desktopOnlyGateTracked = true;
      track("desktop_only_gate_shown");
    }
    void suspendReviewForDesktopOnlyGate();
    return;
  }

  void desktopOnlyScreen.close().then(() => {
    applyDocumentI18n();
  });
}

syncDesktopOnlyGate(isDesktopViewport());
subscribeDesktopViewport(syncDesktopOnlyGate);

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
    // keepalive: обычный rpc часто убивается при unload. Storage не чистим —
    // boot reconcile добьёт orphan, если fetch не успел.
    releasePortfolioClaimKeepalive(portfolioId);
    claimHeld = false;
  }
  stopClaimHeartbeat();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    pauseTimerForHiddenTab();
    stopLegendaryPresenceHeartbeat();
    return;
  }

  syncExternalTimerFromDeadline();
  resumeTimerAfterVisible();
  if (dictationRecording && isExternalEmbedSession()) {
    dictationEngine?.resumeIfNeeded?.();
  }

  if (!getSession()?.userId) return;
  syncLegendaryPresenceHeartbeat();
  void reconcileSessionAccess().then((access) => {
    syncLegendaryPresenceHeartbeat();
    if (access === "banned" && activeRouteId !== "banned") {
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
      // Re-validate Auth + ban — не доверять одному UX-кэшу localStorage.
      // gone → exit на /referral; banned → start/applyRoute схлопнет на /banned.
      await reconcileSessionAccess();
      const boot = getSession();
      if (boot?.userId) {
        identifyUser(boot.userId, {
          grade: boot.grade ?? undefined,
          tier: boot.tier ?? undefined,
          onboarding_done: Boolean(boot.onboardingDone),
        });
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
  // Бан после boot-refresh: start → applyRoute схлопнет любой deep link на /banned.
  appRouter.start();
})();
