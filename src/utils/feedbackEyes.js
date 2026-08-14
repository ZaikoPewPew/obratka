/**
 * Позиции глаз FAB feedback: пара с зазором 8px (схождение не ближе 4px), clamp в pad 8.
 * Зазор сжимается (не ближе 4px) только когда курсор над кнопкой и между глазами.
 */

/** @typedef {{ x: number; y: number }} EyePoint */
/** @typedef {{ left: EyePoint; right: EyePoint }} EyePair */

export const FEEDBACK_EYE_DEFAULTS = {
  size: 56,
  pad: 8,
  eyeWidth: 9,
  eyeHeight: 10,
  gap: 8,
  minGap: 4,
  lookRange: 96,
};

/**
 * @param {Partial<typeof FEEDBACK_EYE_DEFAULTS>} [partial]
 */
export function getFeedbackEyeGeom(partial = {}) {
  const size = partial.size ?? FEEDBACK_EYE_DEFAULTS.size;
  const pad = partial.pad ?? FEEDBACK_EYE_DEFAULTS.pad;
  const eyeWidth = partial.eyeWidth ?? FEEDBACK_EYE_DEFAULTS.eyeWidth;
  const eyeHeight = partial.eyeHeight ?? FEEDBACK_EYE_DEFAULTS.eyeHeight;
  const gap = partial.gap ?? FEEDBACK_EYE_DEFAULTS.gap;
  const minGap = partial.minGap ?? FEEDBACK_EYE_DEFAULTS.minGap;
  const lookRange = partial.lookRange ?? FEEDBACK_EYE_DEFAULTS.lookRange;
  const rx = eyeWidth / 2;
  const ry = eyeHeight / 2;
  const restY = pad + ry;
  const pairHalf = rx + gap / 2;
  const midX = size / 2;

  return {
    size,
    pad,
    eyeWidth,
    eyeHeight,
    gap,
    minGap,
    lookRange,
    rx,
    ry,
    pairHalf,
    rest: {
      left: { x: midX - pairHalf, y: restY },
      right: { x: midX + pairHalf, y: restY },
    },
    minX: pad + rx,
    maxX: size - pad - rx,
    minY: pad + ry,
    maxY: size - pad - ry,
  };
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {number} mouse
 * @param {number} rest
 * @param {number} min
 * @param {number} max
 * @param {number} range
 */
function axisLook(mouse, rest, min, max, range) {
  if (!(range > 0)) return clamp(rest, min, max);
  const t = clamp((mouse - rest) / range, -1, 1);
  if (t >= 0) return rest + t * (max - rest);
  return rest + t * (rest - min);
}

/**
 * @param {ReturnType<typeof getFeedbackEyeGeom>} geom
 * @param {EyePoint | null} mouse
 * @returns {EyePair}
 */
function rigidPair(geom, mouse) {
  const { rest, pairHalf, lookRange } = geom;
  const midRestX = (rest.left.x + rest.right.x) / 2;
  const midRestY = rest.left.y;
  const midMinX = geom.minX + pairHalf;
  const midMaxX = geom.maxX - pairHalf;

  if (!mouse) {
    return {
      left: { x: rest.left.x, y: rest.left.y },
      right: { x: rest.right.x, y: rest.right.y },
    };
  }

  const midX = axisLook(mouse.x, midRestX, midMinX, midMaxX, lookRange);
  const midY = axisLook(mouse.y, midRestY, geom.minY, geom.maxY, lookRange);
  return {
    left: { x: midX - pairHalf, y: midY },
    right: { x: midX + pairHalf, y: midY },
  };
}

/**
 * @param {EyePoint} mouse
 * @param {ReturnType<typeof getFeedbackEyeGeom>} geom
 */
export function isMouseOnButton(mouse, geom) {
  return (
    mouse.x >= 0 &&
    mouse.x <= geom.size &&
    mouse.y >= 0 &&
    mouse.y <= geom.size
  );
}

/**
 * @param {number} mouseX
 * @param {EyePoint} left
 * @param {EyePoint} right
 * @param {number} rx
 */
export function isMouseBetweenEyes(mouseX, left, right, rx) {
  return mouseX > left.x + rx && mouseX < right.x - rx;
}

/**
 * Схождение только над самой кнопкой и между внутренними краями глаз.
 * @param {EyePoint} mouse
 * @param {EyePoint} left
 * @param {EyePoint} right
 * @param {ReturnType<typeof getFeedbackEyeGeom>} geom
 */
export function shouldSqueezeEyes(mouse, left, right, geom) {
  return (
    isMouseOnButton(mouse, geom) &&
    isMouseBetweenEyes(mouse.x, left, right, geom.rx)
  );
}

/**
 * @param {ReturnType<typeof getFeedbackEyeGeom>} geom
 * @param {EyePoint} mouse
 * @returns {EyePair}
 */
function independentLook(geom, mouse) {
  const minGap = geom.minGap;
  const minCenterDist = geom.eyeWidth + minGap;
  let leftX = mouse.x - geom.rx - minGap / 2;
  let rightX = mouse.x + geom.rx + minGap / 2;

  if (leftX < geom.minX) {
    leftX = geom.minX;
    rightX = leftX + minCenterDist;
  }
  if (rightX > geom.maxX) {
    rightX = geom.maxX;
    leftX = rightX - minCenterDist;
  }

  leftX = clamp(leftX, geom.minX, geom.maxX);
  rightX = clamp(rightX, geom.minX, geom.maxX);

  const y = axisLook(
    mouse.y,
    geom.rest.left.y,
    geom.minY,
    geom.maxY,
    geom.lookRange,
  );
  return {
    left: { x: leftX, y },
    right: { x: rightX, y },
  };
}

/**
 * @param {number} t
 */
function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Idle-взгляд по сторонам: центр → право → лево → центр.
 * phase 0..1 за `--motion-feedback-idle-duration`.
 * @param {number} phase
 * @returns {number} −1..1
 */
export function idleLookShift(phase) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.48) return 0;
  if (p < 0.56) return smoothstep((p - 0.48) / 0.08);
  if (p < 0.64) return 1;
  if (p < 0.72) return lerpNum(1, -1, smoothstep((p - 0.64) / 0.08));
  if (p < 0.8) return -1;
  if (p < 0.88) return lerpNum(-1, 0, smoothstep((p - 0.8) / 0.08));
  return 0;
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
function lerpNum(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Пара в покое со сдвигом idle-взгляда (−1..1 по горизонтали).
 * @param {number} phase
 * @param {Partial<typeof FEEDBACK_EYE_DEFAULTS> | ReturnType<typeof getFeedbackEyeGeom>} [geomInput]
 * @returns {EyePair}
 */
export function idleFeedbackEyePositions(phase, geomInput = {}) {
  const geom = resolveGeom(geomInput);
  const dx = idleLookShift(phase) * (geom.rest.left.x - geom.minX);
  return {
    left: { x: geom.rest.left.x + dx, y: geom.rest.left.y },
    right: { x: geom.rest.right.x + dx, y: geom.rest.right.y },
  };
}

/**
 * @param {Partial<typeof FEEDBACK_EYE_DEFAULTS> | ReturnType<typeof getFeedbackEyeGeom>} geomInput
 * @returns {ReturnType<typeof getFeedbackEyeGeom>}
 */
function resolveGeom(geomInput) {
  if (geomInput && "rest" in geomInput && geomInput.rest) return geomInput;
  return getFeedbackEyeGeom(geomInput);
}

/**
 * @param {EyePoint | null} mouse локальные координаты относительно квадрата FAB
 * @param {Partial<typeof FEEDBACK_EYE_DEFAULTS> | ReturnType<typeof getFeedbackEyeGeom>} [geomInput]
 * @returns {EyePair}
 */
export function computeFeedbackEyePositions(mouse, geomInput = {}) {
  const geom = resolveGeom(geomInput);

  if (!mouse) {
    return {
      left: { x: geom.rest.left.x, y: geom.rest.left.y },
      right: { x: geom.rest.right.x, y: geom.rest.right.y },
    };
  }

  const rigid = rigidPair(geom, mouse);
  if (!shouldSqueezeEyes(mouse, rigid.left, rigid.right, geom)) {
    return rigid;
  }
  return independentLook(geom, mouse);
}

/**
 * @param {EyePair} from
 * @param {EyePair} to
 * @param {number} t
 * @returns {EyePair}
 */
export function lerpEyes(from, to, t) {
  const k = clamp(t, 0, 1);
  return {
    left: {
      x: from.left.x + (to.left.x - from.left.x) * k,
      y: from.left.y + (to.left.y - from.left.y) * k,
    },
    right: {
      x: from.right.x + (to.right.x - from.right.x) * k,
      y: from.right.y + (to.right.y - from.right.y) * k,
    },
  };
}

/**
 * @param {EyePair} a
 * @param {EyePair} b
 * @param {number} [eps]
 */
export function eyesSettled(a, b, eps = 0.05) {
  return (
    Math.hypot(a.left.x - b.left.x, a.left.y - b.left.y) < eps &&
    Math.hypot(a.right.x - b.right.x, a.right.y - b.right.y) < eps
  );
}

/**
 * Зазор между внутренними краями (при схождении не меньше `minGap`).
 * @param {EyePair} pair
 * @param {number} rx
 */
export function eyeInnerGap(pair, rx) {
  return pair.right.x - rx - (pair.left.x + rx);
}

/**
 * Геометрия из CSS-токенов на элементе FAB.
 * @param {Element} el
 */
export function readFeedbackEyeGeom(el) {
  const cs = getComputedStyle(el);

  /**
   * @param {string} name
   * @param {number} fallback
   */
  function px(name, fallback) {
    const value = Number.parseFloat(cs.getPropertyValue(name).trim());
    return Number.isFinite(value) ? value : fallback;
  }

  return getFeedbackEyeGeom({
    size: px("--feedback-size", FEEDBACK_EYE_DEFAULTS.size),
    pad: px("--feedback-eye-pad", FEEDBACK_EYE_DEFAULTS.pad),
    eyeWidth: px("--feedback-eye-width", FEEDBACK_EYE_DEFAULTS.eyeWidth),
    eyeHeight: px("--feedback-eye-height", FEEDBACK_EYE_DEFAULTS.eyeHeight),
    gap: px("--feedback-eye-gap", FEEDBACK_EYE_DEFAULTS.gap),
    minGap: px("--feedback-eye-gap-min", FEEDBACK_EYE_DEFAULTS.minGap),
    lookRange: px("--feedback-eye-look-range", FEEDBACK_EYE_DEFAULTS.lookRange),
  });
}
