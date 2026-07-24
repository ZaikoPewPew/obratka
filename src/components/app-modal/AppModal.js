import { getStrings } from "../../i18n.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";

const CLOSE_SVG = `<svg class="app-modal__close-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/** @typedef {"md" | "lg" | "xl"} AppModalSize */

const SIZE_CLASS = {
  md: "app-modal--size-md",
  lg: "app-modal--size-lg",
  xl: "app-modal--size-xl",
};

/**
 * @param {unknown} value
 * @returns {AppModalSize}
 */
function normalizeSize(value) {
  if (value === "lg" || value === "xl" || value === "md") return value;
  return "md";
}

/**
 * Универсальная модалка по Figma Modal (600 / 800 / 1000).
 * Красная зона в макете → `content` (слот под кастомный контент кейса).
 *
 * @param {{
 *   size?: AppModalSize;
 *   title?: string;
 *   description?: string;
 *   closeAriaLabel?: string;
 *   primaryLabel?: string;
 *   secondaryLabel?: string;
 *   showPrimary?: boolean;
 *   showSecondary?: boolean;
 *   closeOnBackdrop?: boolean;
 *   closeOnEscape?: boolean;
 *   onClose?: () => void;
 *   onPrimary?: () => void | Promise<void>;
 *   onSecondary?: () => void | Promise<void>;
 * }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   dialog: HTMLElement;
 *   content: HTMLElement;
 *   open: () => void;
 *   close: () => Promise<void>;
 *   isOpen: () => boolean;
 *   setSize: (size: AppModalSize) => void;
 *   setTitle: (title: string) => void;
 *   setDescription: (description: string) => void;
 *   setPrimaryLabel: (label: string) => void;
 *   setSecondaryLabel: (label: string) => void;
 *   setActionsVisible: (flags: { primary?: boolean; secondary?: boolean }) => void;
 *   setCloseAriaLabel: (label: string) => void;
 * }}
 */
export function createAppModal(opts = {}) {
  const onClose = typeof opts.onClose === "function" ? opts.onClose : null;
  const onPrimary = typeof opts.onPrimary === "function" ? opts.onPrimary : null;
  const onSecondary =
    typeof opts.onSecondary === "function" ? opts.onSecondary : null;
  const closeOnBackdrop = opts.closeOnBackdrop !== false;
  const closeOnEscape = opts.closeOnEscape !== false;

  let size = normalizeSize(opts.size);
  let closing = false;
  let openAnimFrame = 0;
  /** @type {Element | null} */
  let previouslyFocused = null;

  const titleId = `app-modal-title-${Math.random().toString(36).slice(2, 9)}`;
  const descId = `app-modal-desc-${Math.random().toString(36).slice(2, 9)}`;

  const root = document.createElement("div");
  root.className = `app-modal ${SIZE_CLASS[size]}`;
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");

  const dialog = document.createElement("div");
  dialog.className = "app-modal__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", titleId);

  const header = document.createElement("div");
  header.className = "app-modal__header";

  const heading = document.createElement("div");
  heading.className = "app-modal__heading";

  const titleEl = document.createElement("h2");
  titleEl.className = "app-modal__title";
  titleEl.id = titleId;

  const descriptionEl = document.createElement("p");
  descriptionEl.className = "app-modal__description";
  descriptionEl.id = descId;

  heading.append(titleEl, descriptionEl);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "app-modal__close";
  closeBtn.innerHTML = CLOSE_SVG;

  header.append(heading, closeBtn);

  const content = document.createElement("div");
  content.className = "app-modal__content";

  const actions = document.createElement("div");
  actions.className = "app-modal__actions";

  const primaryBtn = document.createElement("button");
  primaryBtn.type = "button";
  primaryBtn.className = "app-modal__btn app-modal__btn--primary";

  const secondaryBtn = document.createElement("button");
  secondaryBtn.type = "button";
  secondaryBtn.className = "app-modal__btn app-modal__btn--secondary";

  actions.append(primaryBtn, secondaryBtn);
  dialog.append(header, content, actions);
  root.append(dialog);

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
      dialog.setAttribute("aria-describedby", descId);
    } else {
      dialog.removeAttribute("aria-describedby");
    }
  }

  /**
   * @param {string} label
   */
  function setPrimaryLabel(label) {
    primaryBtn.textContent = label ?? "";
  }

  /**
   * @param {string} label
   */
  function setSecondaryLabel(label) {
    secondaryBtn.textContent = label ?? "";
  }

  /**
   * @param {string} label
   */
  function setCloseAriaLabel(label) {
    const t = getStrings();
    closeBtn.setAttribute(
      "aria-label",
      label || t.modalCloseAria || t.homeInviteCloseAria || "Close",
    );
  }

  /**
   * @param {{ primary?: boolean; secondary?: boolean }} flags
   */
  function setActionsVisible(flags) {
    if (typeof flags.primary === "boolean") {
      primaryBtn.hidden = !flags.primary;
    }
    if (typeof flags.secondary === "boolean") {
      secondaryBtn.hidden = !flags.secondary;
    }
    actions.hidden = primaryBtn.hidden && secondaryBtn.hidden;
  }

  /**
   * @param {AppModalSize} next
   */
  function setSize(next) {
    size = normalizeSize(next);
    root.classList.remove(
      SIZE_CLASS.md,
      SIZE_CLASS.lg,
      SIZE_CLASS.xl,
    );
    root.classList.add(SIZE_CLASS[size]);
  }

  function syncInitialCopy() {
    setTitle(opts.title ?? "");
    setDescription(opts.description ?? "");
    setPrimaryLabel(opts.primaryLabel ?? "");
    setSecondaryLabel(opts.secondaryLabel ?? "");
    setCloseAriaLabel(opts.closeAriaLabel ?? "");
    setActionsVisible({
      primary: opts.showPrimary !== false && Boolean(opts.primaryLabel),
      secondary: opts.showSecondary !== false && Boolean(opts.secondaryLabel),
    });
  }

  syncInitialCopy();

  function isOpen() {
    return !root.hidden && root.classList.contains("app-modal--open");
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
    root.classList.remove("app-modal--open");

    openAnimFrame = requestAnimationFrame(() => {
      openAnimFrame = requestAnimationFrame(() => {
        openAnimFrame = 0;
        root.classList.add("app-modal--open");
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

    root.classList.remove("app-modal--open");
    root.setAttribute("aria-hidden", "true");

    const fallbackMs = getScreenCloseFallbackMs();

    return new Promise((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        root.removeEventListener("transitionend", onEnd);
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
        if (event.target !== root || event.propertyName !== "opacity") return;
        finish();
      };

      root.addEventListener("transitionend", onEnd);
      const timerId = window.setTimeout(finish, fallbackMs);
    });
  }

  closeBtn.addEventListener("click", () => {
    void close();
  });

  primaryBtn.addEventListener("click", () => {
    void onPrimary?.();
  });

  secondaryBtn.addEventListener("click", () => {
    void onSecondary?.();
  });

  root.addEventListener("click", (event) => {
    if (!closeOnBackdrop || event.target !== root) return;
    void close();
  });

  root.addEventListener("keydown", (event) => {
    if (!closeOnEscape || event.key !== "Escape") return;
    if (root.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    void close();
  });

  return {
    root,
    dialog,
    content,
    open,
    close,
    isOpen,
    setSize,
    setTitle,
    setDescription,
    setPrimaryLabel,
    setSecondaryLabel,
    setActionsVisible,
    setCloseAriaLabel,
  };
}
