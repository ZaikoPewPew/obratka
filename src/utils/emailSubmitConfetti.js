import confetti from "canvas-confetti";

/** Согласовано с `.layout-desktop` и брейкпоинтом проекта */
const DESKTOP_MQ = "(min-width: 768px)";

/** Выше `.access-modal__backdrop` (200) */
const CONFETTI_Z = 320;

/** @type {HTMLCanvasElement | null} */
let layer = null;
/** @type {ReturnType<typeof confetti.create> | null} */
let fire = null;

function ensureLayer() {
  if (layer) {
    return;
  }
  layer = document.createElement("canvas");
  layer.setAttribute("aria-hidden", "true");
  layer.style.position = "fixed";
  layer.style.inset = "0";
  layer.style.width = "100%";
  layer.style.height = "100%";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = String(CONFETTI_Z);
  document.body.appendChild(layer);
  fire = confetti.create(layer, {
    useWorker: false,
    resize: false,
    disableForReducedMotion: true,
  });
}

/**
 * Внутреннее разрешение = CSS × DPR, иначе на Retina всё «мыльное».
 * @returns {{ dpr: number; cssW: number; cssH: number }}
 */
function syncLayerSize() {
  const cssW = document.documentElement.clientWidth;
  const cssH = document.documentElement.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.25);
  layer.width = Math.max(1, Math.floor(cssW * dpr));
  layer.height = Math.max(1, Math.floor(cssH * dpr));
  return { dpr, cssW, cssH };
}

/**
 * Конфетти после успешной отправки email; только десктоп (viewport ≥768px).
 * @param {HTMLElement} anchorEl — центр взрыва (обычно `.email-input-shell`)
 */
export function fireEmailSubmitConfetti(anchorEl) {
  if (!window.matchMedia(DESKTOP_MQ).matches) {
    return;
  }

  ensureLayer();
  const { dpr, cssW, cssH } = syncLayerSize();

  const rect = anchorEl.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / cssW;
  const y = (rect.top + rect.height / 2) / cssH;

  const intensity = Math.min(1.08, Math.max(0.88, cssW / 1200));

  /** Скорость и гравитация в координатах буфера: при DPR>1 умножаем, чтобы скорость по экрану осталась как у «1×»-тюнинга. */
  const s = dpr;

  const base = {
    origin: { x, y },
    disableForReducedMotion: true,
    angle: 90,
    colors: ["#9eb6cc", "#b5a3c2", "#9dc4b0", "#d4cfc4", "#2a2a2d", "#f7f4ef"],
  };

  fire({
    ...base,
    particleCount: Math.round(72 * intensity),
    spread: 48,
    startVelocity: 36 * s,
    ticks: 280,
    gravity: 0.92 * s,
    decay: 0.92,
    drift: 0.12 * s,
    scalar: 1.08,
    shapes: ["circle", "square"],
  });

  window.setTimeout(() => {
    fire({
      ...base,
      particleCount: Math.round(28 * intensity),
      spread: 72,
      startVelocity: 22 * s,
      ticks: 240,
      gravity: 0.85 * s,
      decay: 0.93,
      drift: -0.06 * s,
      scalar: 0.92,
      shapes: ["star", "circle"],
    });
  }, 150);
}
