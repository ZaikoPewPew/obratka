import { getStrings } from "../../i18n.js";
import { COMMUNITY_CONTACT_URL } from "../../config/contacts.js";
import { getFeedbackEyeMotion } from "../../utils/motionTokens.js";
import {
  computeFeedbackEyePositions,
  idleFeedbackEyePositions,
  lerpEyes,
  readFeedbackEyeGeom,
} from "../../utils/feedbackEyes.js";

const DOUBLE_BLINK_CHANCE = 0.18;

/**
 * @param {"left" | "right"} side
 * @returns {HTMLSpanElement}
 */
function createEye(side) {
  const eye = document.createElement("span");
  eye.className = `feedback__eye feedback__eye--${side}`;
  const ball = document.createElement("span");
  ball.className = "feedback__eye-ball";
  eye.append(ball);
  return eye;
}

/**
 * @returns {{ wrap: HTMLSpanElement; left: HTMLSpanElement; right: HTMLSpanElement }}
 */
function createEyes() {
  const wrap = document.createElement("span");
  wrap.className = "feedback__eyes";
  wrap.setAttribute("aria-hidden", "true");
  const left = createEye("left");
  const right = createEye("right");
  wrap.append(left, right);
  return { wrap, left, right };
}

/**
 * @param {HTMLElement} el
 * @param {{ x: number; y: number }} point
 */
function applyEye(el, point) {
  el.style.setProperty("--feedback-eye-x", `${point.x}px`);
  el.style.setProperty("--feedback-eye-y", `${point.y}px`);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Fixed FAB feedback — Telegram админа (`COMMUNITY_CONTACT_URL`).
 *
 * @param {{ href?: string }} [opts]
 * @returns {{
 *   root: HTMLAnchorElement;
 *   syncCopy: () => void;
 * }}
 */
export function createFeedback({ href = COMMUNITY_CONTACT_URL } = {}) {
  const root = document.createElement("a");
  root.className = "feedback";
  root.href = href;
  root.target = "_blank";
  root.rel = "noopener noreferrer";

  const { wrap: eyes, left, right } = createEyes();
  const leftBall = left.firstElementChild;

  const tip = document.createElement("span");
  tip.className = "feedback__tip";
  tip.setAttribute("aria-hidden", "true");

  root.append(eyes, tip);

  /** @type {{ x: number; y: number } | null} */
  let mouseLocal = null;
  /** @type {ReturnType<typeof computeFeedbackEyePositions> | null} */
  let current = null;
  let raf = 0;
  /** @type {ReturnType<typeof window.setTimeout> | null} */
  let blinkTimer = null;
  let idleStartedAt = 0;
  let pendingDoubleBlink = false;

  function isHomeOpen() {
    const home = root.closest(".home-screen");
    if (!home) return root.isConnected;
    return !home.hidden;
  }

  function restPair() {
    const geom = readFeedbackEyeGeom(root);
    return {
      left: { x: geom.rest.left.x, y: geom.rest.left.y },
      right: { x: geom.rest.right.x, y: geom.rest.right.y },
    };
  }

  function restartIdle() {
    idleStartedAt = performance.now();
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{ x: number; y: number } | null}
   */
  function clientToLocal(clientX, clientY) {
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const geom = readFeedbackEyeGeom(root);
    return {
      x: ((clientX - rect.left) / rect.width) * geom.size,
      y: ((clientY - rect.top) / rect.height) * geom.size,
    };
  }

  function idleTarget() {
    const geom = readFeedbackEyeGeom(root);
    const motion = getFeedbackEyeMotion();
    const duration = Math.max(1, motion.idleDurationMs);
    const phase = ((performance.now() - idleStartedAt) / duration) % 1;
    return idleFeedbackEyePositions(phase, geom);
  }

  function tick() {
    raf = 0;
    const geom = readFeedbackEyeGeom(root);
    const motion = getFeedbackEyeMotion();
    const reduced = prefersReducedMotion();
    const homeOpen = isHomeOpen();
    if (!current) current = restPair();

    let target;
    let lerp;
    if (!homeOpen || reduced) {
      target = restPair();
      lerp = homeOpen ? motion.idleLerp : 1;
    } else if (mouseLocal) {
      target = computeFeedbackEyePositions(mouseLocal, geom);
      lerp = motion.lookLerp;
    } else {
      target = idleTarget();
      lerp = motion.idleLerp;
    }

    current = lerpEyes(current, target, lerp);
    applyEye(left, current.left);
    applyEye(right, current.right);

    const keepLooping = homeOpen && !reduced;
    if (keepLooping) {
      raf = requestAnimationFrame(tick);
    }
  }

  function requestTick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (prefersReducedMotion() || !isHomeOpen()) return;
    if (!idleStartedAt) restartIdle();
    requestTick();
  }

  function stopLoop() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    mouseLocal = null;
    current = restPair();
    applyEye(left, current.left);
    applyEye(right, current.right);
  }

  /**
   * @param {PointerEvent} event
   */
  function onPointerMove(event) {
    if (event.pointerType && event.pointerType !== "mouse") return;
    if (!isHomeOpen() || prefersReducedMotion()) return;
    mouseLocal = clientToLocal(event.clientX, event.clientY);
    requestTick();
  }

  function onPointerLost() {
    if (mouseLocal === null) return;
    mouseLocal = null;
    restartIdle();
    requestTick();
  }

  /**
   * @param {MouseEvent} event
   */
  function onDocumentMouseOut(event) {
    if (event.relatedTarget) return;
    onPointerLost();
  }

  function clearBlinkTimer() {
    if (blinkTimer !== null) {
      window.clearTimeout(blinkTimer);
      blinkTimer = null;
    }
  }

  function stopBlink() {
    clearBlinkTimer();
    pendingDoubleBlink = false;
    root.classList.remove("feedback--blink");
  }

  function fireBlink() {
    root.classList.remove("feedback--blink");
    if (leftBall instanceof HTMLElement) void leftBall.offsetWidth;
    root.classList.add("feedback--blink");
  }

  function scheduleBlink() {
    clearBlinkTimer();
    if (prefersReducedMotion() || !isHomeOpen()) return;
    const motion = getFeedbackEyeMotion();
    const span = Math.max(0, motion.blinkDelayMaxMs - motion.blinkDelayMinMs);
    const delay = motion.blinkDelayMinMs + Math.random() * span;
    blinkTimer = window.setTimeout(() => {
      blinkTimer = null;
      if (!isHomeOpen() || prefersReducedMotion()) return;
      pendingDoubleBlink = Math.random() < DOUBLE_BLINK_CHANCE;
      fireBlink();
      scheduleBlink();
    }, delay);
  }

  function onBlinkEnd(event) {
    if (event.animationName !== "motion-feedback-blink") return;
    root.classList.remove("feedback--blink");
    if (!pendingDoubleBlink) return;
    pendingDoubleBlink = false;
    requestAnimationFrame(() => {
      if (!isHomeOpen() || prefersReducedMotion()) return;
      fireBlink();
    });
  }

  function onMotionPreferenceChange() {
    if (prefersReducedMotion()) {
      stopBlink();
      stopLoop();
      return;
    }
    restartIdle();
    scheduleBlink();
    startLoop();
  }

  leftBall?.addEventListener("animationend", onBlinkEnd);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("blur", onPointerLost);
  document.documentElement.addEventListener("mouseleave", onPointerLost);
  document.addEventListener("mouseout", onDocumentMouseOut);

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (typeof motionQuery.addEventListener === "function") {
    motionQuery.addEventListener("change", onMotionPreferenceChange);
  }

  queueMicrotask(() => {
    const home = root.closest(".home-screen");
    if (!home) {
      restartIdle();
      scheduleBlink();
      startLoop();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!isHomeOpen()) {
        stopBlink();
        stopLoop();
        return;
      }
      restartIdle();
      scheduleBlink();
      startLoop();
    });
    observer.observe(home, { attributes: true, attributeFilter: ["hidden"] });
    if (isHomeOpen()) {
      restartIdle();
      scheduleBlink();
      startLoop();
    }
  });

  function syncCopy() {
    const t = getStrings();
    const label = t.homeFeedbackAria ?? "";
    const tooltip = t.homeFeedbackTooltip ?? "";
    root.setAttribute("aria-label", label);
    root.title = tooltip;
    tip.textContent = tooltip;
  }

  syncCopy();

  return { root, syncCopy };
}
