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
 * Cooldown кнопки «Отправить ещё раз» на экране email OTP.
 * @returns {number}
 */
export function getAuthCodeResendCooldownMs() {
  return parseCssTimeMs(readCssVar("--auth-code-resend-cooldown"), 60_000);
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

/**
 * Уход PDF-листа: разгон вверх → бросок вниз, opacity всегда 1.
 * @returns {{
 *   durationMs: number;
 *   liftPx: number;
 *   peak: number;
 *   easeLift: string;
 *   easeDive: string;
 * }}
 */
export function getReportLaunchMotion() {
  const peakRaw = Number.parseFloat(readCssVar("--shell-review-report-launch-peak"));
  const peak =
    Number.isFinite(peakRaw) && peakRaw > 0 && peakRaw < 1 ? peakRaw : 0.24;

  return {
    durationMs: parseCssTimeMs(
      readCssVar("--shell-review-report-launch-duration"),
      780,
    ),
    liftPx: parseCssLengthPx(
      readCssVar("--shell-review-report-launch-lift"),
      40,
    ),
    peak,
    easeLift:
      readCssVar("--shell-review-report-launch-ease-lift") ||
      "cubic-bezier(0.22, 1, 0.36, 1)",
    easeDive:
      readCssVar("--shell-review-report-launch-ease-dive") ||
      "cubic-bezier(0.55, 0.05, 0.9, 0.3)",
  };
}

/**
 * Смена mesh-палитры после submit: к середине спуска лого.
 * @returns {{ durationMs: number; easing: string }}
 */
export function getReviewMeshDoneMotion() {
  const brandMs = parseCssTimeMs(
    readCssVar("--shell-review-brand-motion-duration"),
    1600,
  );
  const midpointRaw = Number.parseFloat(
    readCssVar("--shell-review-mesh-done-midpoint"),
  );
  const midpoint =
    Number.isFinite(midpointRaw) && midpointRaw > 0 && midpointRaw <= 1
      ? midpointRaw
      : 0.5;
  const explicitMs = parseCssTimeMs(
    readCssVar("--shell-review-mesh-done-duration"),
    brandMs * midpoint,
  );

  return {
    durationMs: explicitMs > 0 ? explicitMs : brandMs * midpoint,
    easing:
      readCssVar("--shell-review-brand-motion-ease") ||
      "cubic-bezier(0.16, 1, 0.3, 1)",
  };
}

/**
 * Морф mark → logo-done (нимб + корона) вместе с done-mesh.
 * @returns {{ durationMs: number; easing: string }}
 */
export function getBrandMarkMorphMotion() {
  const mesh = getReviewMeshDoneMotion();
  const morphMs = parseCssTimeMs(
    readCssVar("--shell-review-brand-mark-morph-duration"),
    mesh.durationMs,
  );
  return {
    durationMs: morphMs > 0 ? morphMs : mesh.durationMs,
    easing:
      readCssVar("--shell-review-brand-mark-morph-ease") || mesh.easing,
  };
}
