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
import {
  resolvePortfolioEmbed,
} from "./utils/portfolioEmbed.js";
import { resolvePortfolioMeta } from "./utils/portfolioMeta.js";
import brandLogoUrl from "./assets/brand/logo.svg";

const SESSION_SECONDS = 10;
const SESSION_TOTAL_MS = SESSION_SECONDS * 1000;
const TIMER_TICK_MS = 10;

const workspace = document.querySelector("[data-workspace]");
const frameWrap = document.querySelector("[data-frame]");
const frame = document.querySelector("#portfolio-frame");
const externalViewer = document.querySelector("[data-external-viewer]");
const externalBodyEl = document.querySelector("[data-external-body]");
const openExternalBtn = document.querySelector('[data-action="open-external"]');
const timerEl = document.querySelector("[data-timer]");
const avatarEl = document.querySelector("[data-portfolio-avatar]");
const nameEl = document.querySelector("[data-portfolio-name]");
const reviewMount = document.querySelector("[data-review]");
const frameReloadBtn = document.querySelector('[data-action="reload-frame"]');
const frameBackBtn = document.querySelector('[data-action="frame-back"]');
const frameForwardBtn = document.querySelector('[data-action="frame-forward"]');

/** @type {string | null} */
let portfolioUrl = null;
/** @type {import("./utils/portfolioEmbed.js").PortfolioEmbedPlan | null} */
let embedPlan = null;
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

const urlModal = createUrlModal({
  onSubmit: async (url) => {
    closeReview();
    await applyPortfolio(url, { openExternal: true });
    startTimer();
  },
});

document.body.append(urlModal.backdrop);

openExternalBtn?.addEventListener("click", () => {
  openPortfolioExternally();
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
urlModal.open();
