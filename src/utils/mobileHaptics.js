const MOBILE_POINTER_QUERY = "(hover: none) and (pointer: coarse)";
const HAPTIC_COOLDOWN_MS = 60;
const HAPTIC_DURATION_MS = 10;
const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "input:not([type='hidden'])",
  "textarea",
  "select",
  "summary",
  "[role='button']",
  "[data-haptic]",
].join(", ");

/**
 * Виброотклик на мобильных интерактивных элементах.
 * Работает через `navigator.vibrate()` и безопасно игнорируется, если API недоступно.
 */
export function initMobileHaptics() {
  const canVibrate =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  if (!canVibrate) {
    return;
  }

  let isMobile = false;
  try {
    isMobile = window.matchMedia(MOBILE_POINTER_QUERY).matches;
  } catch {
    isMobile = window.innerWidth < 768;
  }
  if (!isMobile) {
    return;
  }

  let lastVibrationAt = 0;
  const vibrate = () => {
    const now = Date.now();
    if (now - lastVibrationAt < HAPTIC_COOLDOWN_MS) {
      return;
    }
    lastVibrationAt = now;
    try {
      navigator.vibrate(HAPTIC_DURATION_MS);
    } catch {
      /* ignore */
    }
  };

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const target = event.target.closest(INTERACTIVE_SELECTOR);
      if (!target) {
        return;
      }
      if (
        target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        if (target.disabled) {
          return;
        }
      }
      if ("ariaDisabled" in target && target.ariaDisabled === "true") {
        return;
      }
      vibrate();
    },
    true,
  );
}
