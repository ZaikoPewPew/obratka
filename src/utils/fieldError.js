/**
 * Плавное проявление ошибки под инпутом (`.url-screen__error`).
 * Opacity + blur «из воздуха»; высота через grid без визуальной обрезки текста.
 */

import { getMotionFieldError } from "./motionTokens.js";

const OPEN_CLASS = "url-screen__error--open";
const CLIP_CLASS = "url-screen__error-clip";
const INNER_CLASS = "url-screen__error-inner";

/**
 * @typedef {{
 *   timer: ReturnType<typeof setTimeout> | null;
 *   onEnd: ((event: TransitionEvent) => void) | null;
 * }} FieldErrorState
 */

/** @type {WeakMap<HTMLElement, FieldErrorState>} */
const pending = new WeakMap();

/**
 * @returns {boolean}
 */
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * @param {HTMLElement} el
 */
function clearPending(el) {
  const state = pending.get(el);
  if (!state) return;
  if (state.timer !== null) {
    window.clearTimeout(state.timer);
  }
  if (state.onEnd) {
    el.removeEventListener("transitionend", state.onEnd);
  }
  pending.delete(el);
}

/**
 * Гарантирует clip + inner для анимации.
 * @param {HTMLElement} el
 * @returns {HTMLElement}
 */
export function ensureFieldErrorInner(el) {
  let inner = /** @type {HTMLElement | null} */ (
    el.querySelector(`:scope .${INNER_CLASS}`)
  );
  if (inner) return inner;

  const clip = document.createElement("span");
  clip.className = CLIP_CLASS;

  inner = document.createElement("span");
  inner.className = INNER_CLASS;
  while (el.firstChild) {
    inner.append(el.firstChild);
  }
  clip.append(inner);
  el.append(clip);
  return inner;
}

/**
 * @param {HTMLElement} el
 * @param {string} message
 */
export function setFieldErrorMessage(el, message) {
  ensureFieldErrorInner(el).textContent = message;
}

/**
 * Ошибка в открытом состоянии (класс `--open`).
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function isFieldErrorVisible(el) {
  return el.classList.contains(OPEN_CLASS);
}

/**
 * @param {HTMLElement} el
 * @param {boolean} visible
 * @param {string} [message]
 */
export function setFieldErrorVisible(el, visible, message) {
  const inner = ensureFieldErrorInner(el);
  if (typeof message === "string") {
    inner.textContent = message;
  }

  clearPending(el);

  if (visible) {
    const alreadyOpen = el.classList.contains(OPEN_CLASS) && !el.hidden;
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
    if (alreadyOpen) return;
    if (prefersReducedMotion()) {
      el.classList.add(OPEN_CLASS);
      return;
    }
    void el.offsetHeight;
    el.classList.add(OPEN_CLASS);
    return;
  }

  el.setAttribute("aria-hidden", "true");
  el.classList.remove(OPEN_CLASS);

  if (prefersReducedMotion() || el.hidden) {
    el.hidden = true;
    return;
  }

  const finish = () => {
    if (el.classList.contains(OPEN_CLASS)) return;
    clearPending(el);
    el.hidden = true;
  };

  /** @param {TransitionEvent} event */
  const onEnd = (event) => {
    if (event.target !== el) return;
    if (event.propertyName !== "grid-template-rows") return;
    finish();
  };

  el.addEventListener("transitionend", onEnd);
  const { durationMs } = getMotionFieldError();
  const timer = window.setTimeout(finish, durationMs + 80);
  pending.set(el, { timer, onEnd });
}
