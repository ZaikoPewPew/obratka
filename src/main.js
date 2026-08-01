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
import { clearHomeListCache } from "./utils/homeListCache.js";
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
import { createReviewPanel } from "./components/review-panel/ReviewPanel.js";
import { createReviewScreen } from "./components/review-screen/ReviewScreen.js";
import { createAuthScreen } from "./components/auth-screen/AuthScreen.js";
import { createAuthCodeScreen } from "./components/auth-code-screen/AuthCodeScreen.js";
import { createHomeScreen } from "./components/home-screen/HomeScreen.js";
import { createExplainerMediaRay } from "./components/home-screen/explainerMediaRay.js";
import { createAppModal } from "./components/app-modal/AppModal.js";
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
import currencyDuckLeaveUrl from "./assets/home/modal/currency-duck-leave.png";
import timerEndUrl from "./assets/audio/Timer-end.wav";
import externalEmbedVideoUrl from "./assets/video/primer_not_iframe.mp4";

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
          reviewPanel.setAdviceText?.(nextAdvice);
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
  clearMyProfileCache();
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
 * На done: свежая лента + prefetch embed 1–2 кандидатов; показать/скрыть кнопку.
 * @returns {Promise<void>}
 */
async function prewarmNextReviewCase() {
  const excludeId = portfolioId;
  const gen = ++nextCasePrewarmGen;
  reviewPanel.setNextCaseVisible?.(false);
  try {
    const items = await listPortfoliosForReview();
    if (gen !== nextCasePrewarmGen) return;
    nextCasePreload = { excludeId, items, at: Date.now() };
    const candidates = nextCaseCandidates(items, excludeId);
    reviewPanel.setNextCaseVisible?.(candidates.length > 0);
    for (const item of candidates.slice(0, 2)) {
      if (item.url) prefetchPortfolioEmbed(item.url);
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[review] prewarmNextReviewCase", err);
    }
    if (gen !== nextCasePrewarmGen) return;
    nextCasePreload = null;
    reviewPanel.setNextCaseVisible?.(false);
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
  if (item?.isOwn || item?.reviewedByMe) return false;
  const id = typeof item?.id === "string" ? item.id : "";
  if (!id) return false;

  if (!isPortfolioOpenForReview(item)) {
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
          clearHomeListCache(getSession()?.userId);
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
      reviewPanel.setNextCaseBusy?.(false);
      reviewPanel.setNextCaseVisible?.(false);
      go("home", { replace: true });
      return;
    }

    if (await tryClaimFromList(items)) return;

    reviewPanel.setNextCaseBusy?.(false);
    reviewPanel.setNextCaseVisible?.(false);
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
  reviewPanel.setDictationSupported(isWebSpeechSupported());
  reviewPanel.setDictationRecording(
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
    reviewPanel.setAdviceText?.(polished);
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
  video.src = externalEmbedVideoUrl;
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
    await stopDictation({ polish: true });
  })();

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
  try {
    if (!timerEndAudio) {
      timerEndAudio = new Audio(timerEndUrl);
      timerEndAudio.preload = "auto";
    }
    timerEndAudio.currentTime = 0;
    void timerEndAudio.play().catch(() => {
      /* autoplay / background tab — молча */
    });
  } catch {
    /* ignore */
  }
}

/** Прогреть Audio после user gesture (кнопка external / старт сессии). */
function warmTimerEndSound() {
  try {
    if (!timerEndAudio) {
      timerEndAudio = new Audio(timerEndUrl);
      timerEndAudio.preload = "auto";
    }
    timerEndAudio.load();
  } catch {
    /* ignore */
  }
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

const abortReviewMedia = document.createElement("div");
abortReviewMedia.className = "iframe-shell__abort-explainer-media";

const abortReviewRay = createExplainerMediaRay();

const abortReviewPhoto = document.createElement("img");
abortReviewPhoto.className = "home-screen__explainer-media-photo";
abortReviewPhoto.src = currencyDuckLeaveUrl;
abortReviewPhoto.alt = "";
abortReviewPhoto.width = 1104;
abortReviewPhoto.height = 536;
abortReviewPhoto.decoding = "async";

abortReviewMedia.append(abortReviewRay.root, abortReviewPhoto);

const abortReviewModal = createAppModal({
  size: "md",
  primaryTone: "danger",
  onPrimary: () => {
    void confirmAbortReview();
  },
  onSecondary: () => {
    void abortReviewModal.close();
  },
});
abortReviewModal.content.append(abortReviewMedia);
document.body.append(abortReviewModal.root);

function openAbortReviewModal() {
  const t = getStrings();
  abortReviewModal.setTitle(fixHangingPrepositions(t.reviewAbortTitle ?? ""));
  abortReviewModal.setDescription(
    fixHangingPrepositions(t.reviewAbortDesc ?? ""),
  );
  abortReviewModal.setPrimaryLabel(t.reviewAbortConfirm ?? "");
  abortReviewModal.setSecondaryLabel(t.reviewAbortCancel ?? "");
  abortReviewModal.setCloseAriaLabel(
    t.reviewAbortCloseAria ?? t.modalCloseAria ?? "",
  );
  abortReviewModal.setPrimaryTone("danger");
  abortReviewModal.setActionsVisible({ primary: true, secondary: true });
  abortReviewModal.open();
  requestAnimationFrame(() => {
    abortReviewRay.sync();
  });
}

function confirmAbortReview() {
  // Сразу с кейса: не ждать fade модалки и reconcile в applyRoute.
  abortReviewModal.root.classList.remove("app-modal--open");
  abortReviewModal.root.hidden = true;
  abortReviewModal.root.setAttribute("aria-hidden", "true");
  leaveSessionShell();
  void stopDictation();
  void homeScreen.open(lastHomeView);
  go("home", { search: buildHomeSearch(lastHomeView) });
}

function requestAbortReview() {
  if (reviewSubmitted) {
    go("home", { search: buildHomeSearch(lastHomeView) });
    return;
  }
  openAbortReviewModal();
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
  onClose: () => {
    if (activeRouteId !== "settings") return;
    go("home", { search: buildHomeSearch(lastHomeView) });
  },
  onSaved: async () => {
    await refreshSessionFromProfile();
  },
});

const homeScreen = createHomeScreen({
  onPreviewPortfolio: (item) => {
    // Intro открыт — греем Edge/Readymag probe, чтобы `/review` сразу знал mode.
    if (item?.url) prefetchPortfolioEmbed(item.url);
  },
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
  onAddPortfolio: () => {
    // Слот локально на home; авторитетный gate — applyRoute (без лишнего await).
    if (!canSubmitPortfolio()) return;
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

  /** Параллельный результат слота при запросе `/portfolio` (null — не запрашивали). */
  /** @type {boolean | null} */
  let urlSlotFree = null;

  if (session?.userId) {
    if (id === "url") {
      // Session + pending-слот параллельно — меньше лаг CTA «Закинуть».
      const [access, slotResult] = await Promise.all([
        reconcileSessionAccess(),
        hasFreeMineSlot()
          .then((free) => /** @type {const} */ ({ ok: true, free }))
          .catch((err) => {
            if (import.meta.env.DEV) {
              console.warn("[route] hasFreeMineSlot", err);
            }
            return /** @type {const} */ ({ ok: false, free: false });
          }),
      ]);
      if (access === "gone") return;
      session = getSession();
      urlSlotFree = slotResult.ok ? slotResult.free : false;
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
        prevRouteId === "done")
    ) {
      // Выход с review-workspace (abort / «На главную»): не держать shell
      // на сети — ban/gone догоняют фоном.
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
    try {
      const slotFree =
        urlSlotFree != null ? urlSlotFree : await hasFreeMineSlot();
      if (!slotFree) {
        accessible = "home";
        pendingLimitBlocked = true;
      } else if (!canSubmitPortfolio()) {
        accessible = "home";
      }
    } catch {
      accessible = "home";
      pendingLimitBlocked = true;
    }
  }

  if (accessible !== id) {
    syncRoute(accessible, { replace: true });
    id = accessible;
  }

  activeRouteId = id;
  syncDictationChrome();

  const showPendingLimitIfNeeded = () => {
    if (!pendingLimitBlocked) return;
    const t = getStrings();
    homeScreen.showNotification(t.homeNotifySlotTaken ?? "");
  };

  // Back/Forward между вкладками home: экран уже смонтирован, меняем только вид.
  if (id === "home" && prevRouteId === "home" && !handoff) {
    const view = currentHomeView();
    canonicalizeHomeSearch(view);
    await homeScreen.setView(view);
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
      // Возврат из side-panel настроек: home не закрывался — только вид,
      // иначе повторный entrance-каскад и скролл ленты в 0.
      if (prevRouteId === "settings") {
        void homeScreen.setView(view);
      } else {
        void homeScreen.open(view);
      }
      return;
    }
    if (target === "settings") {
      // Side-panel поверх home (как rules), deep link /settings сохраняем.
      // Не парсить search с /settings — иначе lastHomeView сбросится в feed.
      // Home уже на экране → только setView: иначе повторный entrance-каскад,
      // сброс скролла ленты и лишний refetch списков.
      if (prevRouteId === "home") {
        void homeScreen.setView(lastHomeView);
      } else {
        void homeScreen.open(lastHomeView);
      }
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
    if (id !== "home" && id !== "settings") closers.push(homeScreen.close());
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
  showPendingLimitIfNeeded();
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
        referralDone: isReferralDone(),
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
