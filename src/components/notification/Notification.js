import { getStrings } from "../../i18n.js";
import { fixHangingPrepositions } from "../../utils/hangingPrepositions.js";
import { getMotionNotification } from "../../utils/motionTokens.js";
import errorIconSvg from "../../assets/home/notification-error.svg?raw";

const CLOSE_SVG = `<svg class="notification__close-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/**
 * Иконка error — inline SVG, чтобы `currentColor` наследовал цвет тоста.
 * @returns {SVGElement}
 */
function createErrorIcon() {
  const wrap = document.createElement("span");
  wrap.innerHTML = errorIconSvg.trim();
  const svg = wrap.firstElementChild;
  if (!(svg instanceof SVGElement)) {
    throw new Error("notification-error.svg must be a root <svg>");
  }
  svg.classList.add("notification__icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  return svg;
}

/**
 * Toast Notification (Figma `542:1153`).
 * Выезд справа → удержание → уезд вправо. Не экран флоу.
 *
 * @param {{
 *   closeAriaLabel?: string;
 *   onClose?: () => void;
 * }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   show: (message: string) => void;
 *   hide: () => Promise<void>;
 *   isVisible: () => boolean;
 *   setCloseAriaLabel: (label: string) => void;
 * }}
 */
export function createNotification(opts = {}) {
  const onClose = typeof opts.onClose === "function" ? opts.onClose : null;

  let closing = false;
  /** @type {ReturnType<typeof window.setTimeout> | 0} */
  let holdTimer = 0;
  /** @type {ReturnType<typeof window.setTimeout> | 0} */
  let closeFallbackTimer = 0;
  /** @type {((value?: void) => void) | null} */
  let closeResolve = null;

  const root = document.createElement("div");
  root.className = "notification";
  root.hidden = true;
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-atomic", "true");

  const body = document.createElement("div");
  body.className = "notification__body";

  const messageEl = document.createElement("p");
  messageEl.className = "notification__message";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "notification__close";
  closeBtn.innerHTML = CLOSE_SVG;

  body.append(createErrorIcon(), messageEl, closeBtn);
  root.append(body);

  function clearHoldTimer() {
    if (holdTimer) {
      window.clearTimeout(holdTimer);
      holdTimer = 0;
    }
  }

  function clearCloseFallback() {
    if (closeFallbackTimer) {
      window.clearTimeout(closeFallbackTimer);
      closeFallbackTimer = 0;
    }
  }

  function scheduleHold() {
    clearHoldTimer();
    const { holdMs } = getMotionNotification();
    holdTimer = window.setTimeout(() => {
      holdTimer = 0;
      void hide();
    }, holdMs);
  }

  /**
   * @param {string} label
   */
  function setCloseAriaLabel(label) {
    closeBtn.setAttribute("aria-label", label || getStrings().modalCloseAria || "");
  }

  function isVisible() {
    return !root.hidden && root.classList.contains("notification--open");
  }

  /**
   * @returns {Promise<void>}
   */
  function hide() {
    if (closing || !isVisible()) {
      root.hidden = true;
      root.classList.remove("notification--open", "notification--closing");
      return Promise.resolve();
    }

    closing = true;
    clearHoldTimer();
    root.classList.add("notification--closing");
    root.classList.remove("notification--open");

    const { durationMs } = getMotionNotification();

    return new Promise((resolve) => {
      closeResolve = resolve;
      clearCloseFallback();
      closeFallbackTimer = window.setTimeout(() => {
        closeFallbackTimer = 0;
        finishClose();
      }, durationMs + 80);
    });
  }

  function finishClose() {
    if (!closing && root.hidden) return;
    clearCloseFallback();
    closing = false;
    root.hidden = true;
    root.classList.remove("notification--open", "notification--closing");
    const resolve = closeResolve;
    closeResolve = null;
    resolve?.();
    onClose?.();
  }

  root.addEventListener("transitionend", (event) => {
    if (event.target !== root) return;
    if (event.propertyName !== "transform" && event.propertyName !== "opacity") {
      return;
    }
    if (!closing) return;
    finishClose();
  });

  /**
   * @param {string} message
   */
  function show(message) {
    const text = fixHangingPrepositions(String(message ?? "").trim());
    if (!text) return;

    setCloseAriaLabel(
      opts.closeAriaLabel ||
        getStrings().notificationCloseAria ||
        getStrings().modalCloseAria ||
        "",
    );
    messageEl.textContent = text;

    if (closing) {
      clearCloseFallback();
      closing = false;
      closeResolve?.();
      closeResolve = null;
      root.classList.remove("notification--closing");
    }

    root.hidden = false;
    // Force reflow so replay of enter transition works on repeat show.
    void root.offsetWidth;
    root.classList.add("notification--open");
    scheduleHold();
  }

  closeBtn.addEventListener("click", () => {
    void hide();
  });

  setCloseAriaLabel(
    opts.closeAriaLabel ||
      getStrings().notificationCloseAria ||
      getStrings().modalCloseAria ||
      "",
  );

  return {
    root,
    show,
    hide,
    isVisible,
    setCloseAriaLabel,
  };
}
