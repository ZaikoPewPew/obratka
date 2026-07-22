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
import { createReviewPanel } from "./components/review-panel/ReviewPanel.js";
import { createReviewScreen } from "./components/review-screen/ReviewScreen.js";
import { createUrlScreen } from "./components/url-screen/UrlScreen.js";
import {
  resolvePortfolioEmbed,
} from "./utils/portfolioEmbed.js";
import { resolvePortfolioMeta } from "./utils/portfolioMeta.js";
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

/** @type {(done: boolean) => void} */
let setReviewReportReveal = () => {};

const reviewPanel = createReviewPanel({
  getPortfolioName: () => portfolioName,
  onDoneChange: (done) => {
    setReviewReportReveal(done);
  },
});
const reviewScreen = createReviewScreen({
  content: reviewPanel.root,
});
setReviewReportReveal = reviewScreen.setReportReveal;
document.body.append(reviewScreen.root);

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

  frameWrap.classList.add("iframe-shell__frame--locked");
  reviewPanel.reset();
  reviewPanel.open();
  reviewScreen.open();

  window.setTimeout(() => {
    reviewPanel.focus();
  }, 700);
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

const urlScreen = createUrlScreen({
  onSubmit: async (url) => {
    enterSessionShell();
    await closeReview();
    await applyPortfolio(url);
    if (embedPlan?.mode === "external") {
      armSession();
      return;
    }
    startTimer();
  },
});

document.body.append(urlScreen.root);

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
urlScreen.open();
