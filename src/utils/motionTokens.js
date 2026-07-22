/**
 * Чтение motion-токенов из CSS (`styles/tokens.css`) для WAAPI / таймеров.
 * Источник правды — `--motion-*`, не хардкод в компонентах.
 */

/**
 * @param {string} name CSS custom property, например "--motion-reveal-duration"
 * @returns {string}
 */
function readCssVar(name) {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * @param {string} raw
 * @param {number} fallback
 * @returns {number}
 */
function parseCssTimeMs(raw, fallback) {
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  if (raw.endsWith("ms")) return value;
  if (raw.endsWith("s")) return value * 1000;
  return value;
}

/**
 * @param {string} raw
 * @param {number} fallback
 * @returns {number}
 */
function parseCssLengthPx(raw, fallback) {
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Параметры общего reveal (экраны, шаги опроса, done).
 * @returns {{
 *   durationMs: number;
 *   shiftPx: number;
 *   blurPx: number;
 *   easing: string;
 * }}
 */
export function getMotionReveal() {
  return {
    durationMs: parseCssTimeMs(readCssVar("--motion-reveal-duration"), 900),
    shiftPx: parseCssLengthPx(readCssVar("--motion-reveal-shift"), 12),
    blurPx: parseCssLengthPx(readCssVar("--motion-reveal-blur"), 5),
    easing: readCssVar("--motion-reveal-ease") || "cubic-bezier(0.16, 1, 0.3, 1)",
  };
}

/**
 * Fallback для close() после transition экрана.
 * @returns {number}
 */
export function getScreenCloseFallbackMs() {
  return parseCssTimeMs(readCssVar("--motion-screen-close-fallback"), 700);
}

/**
 * Пауза после выбора варианта до auto-advance шага.
 * @returns {number}
 */
export function getMotionAdvanceDelayMs() {
  return parseCssTimeMs(readCssVar("--motion-advance-delay"), 280);
}

/**
 * Задержка фокуса после open экрана опроса.
 * @returns {number}
 */
export function getMotionFocusDelayMs() {
  return parseCssTimeMs(readCssVar("--motion-focus-delay"), 720);
}
