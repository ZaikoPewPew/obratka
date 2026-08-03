/** Совпадает с `--breakpoint-min-desktop` в `styles/tokens.css` (в @media — литерал). */
export const DESKTOP_MIN_WIDTH_PX = 768;

const DESKTOP_MQ = `(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`;

/**
 * Десктопный viewport (≥ 768px). Узкий экран / телефон — false.
 * @returns {boolean}
 */
export function isDesktopViewport() {
  return window.matchMedia(DESKTOP_MQ).matches;
}

/**
 * Подписка на смену desktop/narrow. Сразу не вызывает callback.
 * @param {(isDesktop: boolean) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function subscribeDesktopViewport(onChange) {
  const mq = window.matchMedia(DESKTOP_MQ);
  /** @param {MediaQueryListEvent} event */
  const handler = (event) => {
    onChange(event.matches);
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
