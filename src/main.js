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
import { createUrlModal } from "./components/url-modal/UrlModal.js";
import { resolvePortfolioMeta } from "./utils/portfolioMeta.js";
import brandLogoUrl from "./assets/brand/logo.svg";

const SESSION_SECONDS = 10;
const SESSION_TOTAL_MS = SESSION_SECONDS * 1000;
const TIMER_TICK_MS = 10;

const workspace = document.querySelector("[data-workspace]");
const frameWrap = document.querySelector("[data-frame]");
const frame = document.querySelector("#portfolio-frame");
const timerEl = document.querySelector("[data-timer]");
const avatarEl = document.querySelector("[data-portfolio-avatar]");
const nameEl = document.querySelector("[data-portfolio-name]");
const reviewMount = document.querySelector("[data-review]");
const frameReloadBtn = document.querySelector('[data-action="reload-frame"]');
const frameBackBtn = document.querySelector('[data-action="frame-back"]');
const frameForwardBtn = document.querySelector('[data-action="frame-forward"]');

/** @type {string | null} */
let portfolioUrl = null;
/** @type {string} */
let portfolioName = getStrings().brandName;

const reviewPanel = createReviewPanel({
  getPortfolioName: () => portfolioName,
});
if (reviewMount) {
  reviewMount.append(reviewPanel.root);
}

let remainingMs = SESSION_TOTAL_MS;
let timerId = null;
let sessionEnded = false;
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
    avatarEl.classList.remove("iframe-shell__avatar--broken");
  };
  tryNext();
}

async function applyPortfolio(url) {
  portfolioUrl = url;
  const requestId = ++metaRequestId;

  if (frame) {
    frame.src = url;
  }

  const meta = await resolvePortfolioMeta(url);
  if (requestId !== metaRequestId) return;
  syncPortfolioChrome(meta);
}

function openReview() {
  if (!workspace || !frameWrap || !reviewMount) return;

  frameWrap.classList.add("iframe-shell__frame--locked");
  workspace.classList.add("iframe-shell__workspace--reviewing");
  reviewMount.setAttribute("aria-hidden", "false");
  reviewPanel.open();

  window.setTimeout(() => {
    reviewPanel.focus();
  }, 700);
}

function closeReview() {
  if (!workspace || !frameWrap || !reviewMount) return;

  workspace.classList.remove("iframe-shell__workspace--reviewing");
  frameWrap.classList.remove("iframe-shell__frame--locked");
  reviewMount.setAttribute("aria-hidden", "true");
  reviewPanel.close();
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

function startTimer() {
  stopTimer();
  remainingMs = SESSION_TOTAL_MS;
  sessionEnded = false;
  renderTimer();
  timerId = window.setInterval(tick, TIMER_TICK_MS);
}

function navigateFrame(action) {
  if (!frame || !portfolioUrl) return;

  try {
    action(frame.contentWindow);
  } catch {
    frame.src = portfolioUrl;
  }
}

const urlModal = createUrlModal({
  onSubmit: async (url) => {
    closeReview();
    await applyPortfolio(url);
    startTimer();
  },
});

document.body.append(urlModal.backdrop);

frameReloadBtn?.addEventListener("click", () => {
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
urlModal.open();
