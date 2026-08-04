import { getStrings } from "../../i18n.js";
import "../../../styles/side-panel.css";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";

const CLOSE_SVG = `<svg class="side-panel__close-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/**
 * Fallback закрытия ≈ CSS panel-duration + запас.
 * @returns {number}
 */
function getSidePanelCloseFallbackMs() {
  if (typeof document === "undefined") return getScreenCloseFallbackMs();
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--side-panel-panel-duration")
    .trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return getScreenCloseFallbackMs();
  const ms = raw.endsWith("s") && !raw.endsWith("ms") ? value * 1000 : value;
  return Math.max(180, Math.round(ms + 80));
}

/**
 * Боковая панель справа (Figma SidePanel).
 * Каркас: title / description / слот `content` / слот `footer` / close. Не экран флоу.
 * Панель всегда opaque — только slide; backdrop отдельно fade.
 *
 * @param {{
 *   title?: string;
 *   description?: string;
 *   closeAriaLabel?: string;
 *   closeOnBackdrop?: boolean;
 *   closeOnEscape?: boolean;
 *   onClose?: () => void;
 * }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   panel: HTMLElement;
 *   content: HTMLElement;
 *   footer: HTMLElement;
 *   open: () => void;
 *   close: () => Promise<void>;
 *   isOpen: () => boolean;
 *   setTitle: (title: string) => void;
 *   setDescription: (description: string) => void;
 *   setCloseAriaLabel: (label: string) => void;
 * }}
 */
export function createSidePanel(opts = {}) {
  const onClose = typeof opts.onClose === "function" ? opts.onClose : null;
  const closeOnBackdrop = opts.closeOnBackdrop !== false;
  const closeOnEscape = opts.closeOnEscape !== false;

  let closing = false;
  let openAnimFrame = 0;
  /** @type {Element | null} */
  let previouslyFocused = null;

  const titleId = `side-panel-title-${Math.random().toString(36).slice(2, 9)}`;
  const descId = `side-panel-desc-${Math.random().toString(36).slice(2, 9)}`;

  const root = document.createElement("div");
  root.className = "side-panel";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");

  const backdrop = document.createElement("div");
  backdrop.className = "side-panel__backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const panel = document.createElement("div");
  panel.className = "side-panel__panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", titleId);

  const header = document.createElement("div");
  header.className = "side-panel__header";

  const heading = document.createElement("div");
  heading.className = "side-panel__heading";

  const titleEl = document.createElement("h2");
  titleEl.className = "side-panel__title";
  titleEl.id = titleId;

  const descriptionEl = document.createElement("p");
  descriptionEl.className = "side-panel__description";
  descriptionEl.id = descId;

  heading.append(titleEl, descriptionEl);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "side-panel__close";
  closeBtn.innerHTML = CLOSE_SVG;

  header.append(heading, closeBtn);

  const content = document.createElement("div");
  content.className = "side-panel__content";

  const footer = document.createElement("div");
  footer.className = "side-panel__footer";

  panel.append(header, content, footer);
  root.append(backdrop, panel);

  /**
   * @param {string} title
   */
  function setTitle(title) {
    titleEl.textContent = title ?? "";
  }

  /**
   * @param {string} description
   */
  function setDescription(description) {
    const text = typeof description === "string" ? description.trim() : "";
    descriptionEl.textContent = text;
    descriptionEl.hidden = !text;
    if (text) {
      panel.setAttribute("aria-describedby", descId);
    } else {
      panel.removeAttribute("aria-describedby");
    }
  }

  /**
   * @param {string} label
   */
  function setCloseAriaLabel(label) {
    const t = getStrings();
    closeBtn.setAttribute(
      "aria-label",
      label || t.modalCloseAria || "Close",
    );
  }

  function syncInitialCopy() {
    setTitle(opts.title ?? "");
    setDescription(opts.description ?? "");
    setCloseAriaLabel(opts.closeAriaLabel ?? "");
  }

  syncInitialCopy();

  function isOpen() {
    return !root.hidden && root.classList.contains("side-panel--open");
  }

  function open() {
    if (closing) return;

    if (openAnimFrame) {
      cancelAnimationFrame(openAnimFrame);
      openAnimFrame = 0;
    }

    previouslyFocused =
      document.activeElement instanceof Element ? document.activeElement : null;

    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    root.classList.remove("side-panel--open");

    openAnimFrame = requestAnimationFrame(() => {
      openAnimFrame = requestAnimationFrame(() => {
        openAnimFrame = 0;
        root.classList.add("side-panel--open");
        closeBtn.focus();
      });
    });
  }

  /**
   * @returns {Promise<void>}
   */
  function close() {
    if (root.hidden || closing) {
      return Promise.resolve();
    }

    closing = true;
    if (openAnimFrame) {
      cancelAnimationFrame(openAnimFrame);
      openAnimFrame = 0;
    }

    root.classList.remove("side-panel--open");
    root.setAttribute("aria-hidden", "true");

    const fallbackMs = getSidePanelCloseFallbackMs();

    return new Promise((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        panel.removeEventListener("transitionend", onEnd);
        window.clearTimeout(timerId);
        root.hidden = true;
        closing = false;
        if (
          previouslyFocused instanceof HTMLElement &&
          document.contains(previouslyFocused)
        ) {
          previouslyFocused.focus();
        }
        previouslyFocused = null;
        onClose?.();
        resolve();
      };

      /**
       * @param {TransitionEvent} event
       */
      const onEnd = (event) => {
        if (event.target !== panel || event.propertyName !== "transform") return;
        finish();
      };

      panel.addEventListener("transitionend", onEnd);
      const timerId = window.setTimeout(finish, fallbackMs);
    });
  }

  closeBtn.addEventListener("click", () => {
    void close();
  });

  backdrop.addEventListener("click", () => {
    if (!closeOnBackdrop) return;
    void close();
  });

  root.addEventListener("keydown", (event) => {
    if (!closeOnEscape || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    void close();
  });

  return {
    root,
    panel,
    content,
    footer,
    open,
    close,
    isOpen,
    setTitle,
    setDescription,
    setCloseAriaLabel,
  };
}
