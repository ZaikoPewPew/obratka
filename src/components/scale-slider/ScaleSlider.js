/**
 * Шкала оценки с анимированной сеткой на треке.
 * Нативный range (без Radix): drag / keyboard / form value.
 */

import { fixHangingPrepositions } from "../../utils/hangingPrepositions.js";

/**
 * @param {{
 *   name: string;
 *   from: number;
 *   to: number;
 *   title: string;
 *   description?: string;
 *   ariaLabel?: string;
 *   ends: { low: string; high: string };
 *   valueTitles?: Record<number, string> | Record<string, string>;
 *   valueHints?: Record<number, string> | Record<string, string>;
 * }} opts
 * @returns {HTMLElement}
 */
export function createScaleSlider({
  name,
  from,
  to,
  title,
  description = "",
  ariaLabel,
  ends,
  valueTitles = {},
  valueHints = {},
}) {
  const min = Math.min(from, to);
  const max = Math.max(from, to);
  const stops = [];
  for (let v = min; v <= max; v += 1) stops.push(v);
  const idleTitle = fixHangingPrepositions(title);
  const idleDescription = fixHangingPrepositions(String(description || "").trim());

  const block = document.createElement("div");
  block.className = "review-panel__scale-block";

  const readout = document.createElement("div");
  readout.className = "review-panel__scale-readout";
  readout.setAttribute("role", "status");
  readout.setAttribute("aria-live", "polite");

  const viewport = document.createElement("span");
  viewport.className = "review-panel__scale-readout-viewport";

  const readoutWord = document.createElement("span");
  readoutWord.className = "review-panel__scale-readout-word";
  readoutWord.textContent = idleTitle;
  viewport.append(readoutWord);

  const readoutHint = document.createElement("p");
  readoutHint.className = "review-panel__scale-readout-hint";
  if (idleDescription) {
    readoutHint.textContent = idleDescription;
    readoutHint.hidden = false;
  } else {
    readoutHint.hidden = true;
  }

  readout.append(viewport, readoutHint);

  const slider = document.createElement("div");
  slider.className = "review-panel__slider";

  const track = document.createElement("div");
  track.className = "review-panel__slider-track";
  track.setAttribute("aria-hidden", "true");

  const canvas = document.createElement("canvas");
  canvas.className = "review-panel__slider-canvas";

  const stopsEl = document.createElement("div");
  stopsEl.className = "review-panel__slider-stops";

  /** @type {HTMLElement[]} */
  const stopNodes = [];
  for (const stop of stops) {
    const dot = document.createElement("span");
    dot.className = "review-panel__slider-stop";
    dot.dataset.value = String(stop);
    stopsEl.append(dot);
    stopNodes.push(dot);
  }

  track.append(canvas, stopsEl);

  const thumb = document.createElement("span");
  thumb.className = "review-panel__slider-thumb";
  thumb.setAttribute("aria-hidden", "true");

  const input = document.createElement("input");
  input.className = "review-panel__slider-input";
  input.type = "range";
  input.name = name;
  input.min = String(min);
  input.max = String(max);
  input.step = "1";
  input.value = String(min);
  input.dataset.touched = "0";
  input.autocomplete = "off";
  input.setAttribute(
    "aria-label",
    ariaLabel ? `${ariaLabel}: ${title}` : title,
  );

  slider.append(track, thumb, input);

  const endsRow = document.createElement("div");
  endsRow.className = "review-panel__scale-ends";

  const low = document.createElement("span");
  low.className = "review-panel__scale-end";
  low.textContent = fixHangingPrepositions(ends.low);

  const high = document.createElement("span");
  high.className = "review-panel__scale-end review-panel__scale-end--high";
  high.textContent = fixHangingPrepositions(ends.high);

  endsRow.append(low, high);

  const control = document.createElement("div");
  control.className = "review-panel__scale-control";
  control.append(slider, endsRow);

  block.append(readout, control);

  let visualProgress = 0;
  let targetProgress = 0;
  let lerpRaf = 0;
  let drawRaf = 0;
  let dragging = false;
  let animating = false;
  let inView = true;
  let tabVisible = typeof document !== "undefined" ? !document.hidden : true;
  let canvasW = 0;
  let canvasH = 0;
  let dpr = 1;
  /** @type {ReturnType<typeof createNoise> | null} */
  let noise = null;
  let displayedTitle = idleTitle;
  let lastValue = min;
  let titleGen = 0;
  /** @type {Animation | null} */
  let titleAnim = null;

  const reducedMotionMq = window.matchMedia("(prefers-reduced-motion: reduce)");

  function prefersReducedMotion() {
    return reducedMotionMq.matches;
  }

  /**
   * @param {number} value
   * @returns {string}
   */
  function titleForValue(value) {
    if (input.dataset.touched !== "1") return title;
    const mapped = valueTitles[value] ?? valueTitles[String(value)];
    return typeof mapped === "string" && mapped ? mapped : title;
  }

  /**
   * @param {number} value
   * @returns {string}
   */
  function hintForValue(value) {
    const mapped = valueHints[value] ?? valueHints[String(value)];
    return typeof mapped === "string" ? mapped.trim() : "";
  }

  /**
   * Приписка всегда на месте (без появления при первом drag):
   * до касания — статичное дополнение к вопросу (`description`);
   * после — ступень `valueHints` (меняется вместе с ползунком).
   * @param {number} value
   */
  function syncReadoutHint(value) {
    const touched = input.dataset.touched === "1";
    const stepHint = hintForValue(value);
    const text = touched && stepHint ? stepHint : idleDescription;
    if (!text) {
      readoutHint.textContent = "";
      readoutHint.hidden = true;
      return;
    }
    readoutHint.textContent = fixHangingPrepositions(text);
    readoutHint.hidden = false;
  }

  function readTitleMotion() {
    const root = getComputedStyle(document.documentElement);
    const durationRaw = root
      .getPropertyValue("--shell-review-slider-title-duration")
      .trim();
    const shiftRaw = root
      .getPropertyValue("--shell-review-slider-title-shift")
      .trim();
    const blurRaw = root
      .getPropertyValue("--shell-review-slider-title-blur")
      .trim();
    const easing =
      root.getPropertyValue("--shell-review-slider-title-ease").trim() ||
      "cubic-bezier(0.22, 1, 0.36, 1)";
    const durationMs =
      durationRaw.endsWith("s") && !durationRaw.endsWith("ms")
        ? Number.parseFloat(durationRaw) * 1000
        : Number.parseFloat(durationRaw) || 320;
    const shiftPx = Number.parseFloat(shiftRaw) || 12;
    const blurPx = Number.parseFloat(blurRaw) || 5;
    return { durationMs, shiftPx, blurPx, easing };
  }

  /**
   * @param {string} next
   * @param {{ immediate?: boolean; direction?: number }} [opts]
   */
  function setReadoutTitle(next, { immediate = false, direction = 1 } = {}) {
    const nextText = fixHangingPrepositions(next);
    const snap = immediate || dragging || prefersReducedMotion();
    if (nextText === displayedTitle && !titleAnim) return;

    displayedTitle = nextText;
    const gen = ++titleGen;
    syncReadoutAria(Number(input.value));

    if (titleAnim) {
      titleAnim.cancel();
      titleAnim = null;
    }

    if (snap) {
      readoutWord.textContent = nextText;
      readoutWord.style.opacity = "";
      readoutWord.style.transform = "";
      readoutWord.style.filter = "";
      return;
    }

    const fromText = readoutWord.textContent || idleTitle;
    const { durationMs, shiftPx, blurPx, easing } = readTitleMotion();
    const dir = direction >= 0 ? 1 : -1;
    const blur = `blur(${blurPx}px)`;

    readoutWord.textContent = fromText;
    readoutWord.style.opacity = "1";
    readoutWord.style.transform = "translateY(0)";
    readoutWord.style.filter = "blur(0px)";

    // Один короткий кроссфейд — без двухфазной очереди, чтобы не отставать от стопа.
    const anim = readoutWord.animate(
      [
        {
          opacity: 1,
          transform: "translateY(0)",
          filter: "blur(0px)",
          offset: 0,
        },
        {
          opacity: 0,
          transform: `translateY(${-dir * shiftPx * 0.5}px)`,
          filter: blur,
          offset: 0.45,
        },
        {
          opacity: 0,
          transform: `translateY(${dir * shiftPx * 0.5}px)`,
          filter: blur,
          offset: 0.46,
        },
        {
          opacity: 1,
          transform: "translateY(0)",
          filter: "blur(0px)",
          offset: 1,
        },
      ],
      { duration: durationMs, easing, fill: "forwards" },
    );

    // Смена текста в середине кроссфейда.
    const swapAt = window.setTimeout(() => {
      if (gen !== titleGen) return;
      readoutWord.textContent = nextText;
    }, durationMs * 0.45);

    titleAnim = anim;
    anim.finished
      .then(() => {
        window.clearTimeout(swapAt);
        if (gen !== titleGen) return;
        titleAnim = null;
        readoutWord.textContent = nextText;
        readoutWord.style.opacity = "";
        readoutWord.style.transform = "";
        readoutWord.style.filter = "";
      })
      .catch(() => {
        window.clearTimeout(swapAt);
      });
  }

  /**
   * @param {number} value
   * @param {{ immediate?: boolean }} [opts]
   */
  function syncReadoutTitle(value, { immediate = false } = {}) {
    const next = titleForValue(value);
    const direction = value >= lastValue ? 1 : -1;
    lastValue = value;
    setReadoutTitle(next, {
      immediate: immediate || dragging,
      direction,
    });
    syncReadoutHint(value);
  }

  function readTokenPx(token, fallback) {
    const raw = getComputedStyle(slider).getPropertyValue(token).trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function thumbWidth() {
    return readTokenPx("--shell-review-slider-thumb-width", 24);
  }

  function cellSize() {
    return readTokenPx("--shell-review-slider-cell", 6);
  }

  function readLerp(token) {
    const raw = getComputedStyle(slider).getPropertyValue(token).trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0.2;
  }

  function clampProgress(value) {
    return Math.min(1, Math.max(0, value));
  }

  function progressFromValue(value) {
    return max === min ? 0 : (value - min) / (max - min);
  }

  function rawFromProgress(progress) {
    return min + clampProgress(progress) * (max - min);
  }

  /** Drag: сегмент [n, n+1) → ступень n (не midpoint). */
  function valueFromProgressFloor(progress) {
    const raw = rawFromProgress(progress);
    return Math.min(max, Math.max(min, Math.floor(raw)));
  }

  /** Release: ближайший стоп. */
  function valueFromProgressNearest(progress) {
    return snapToStop(rawFromProgress(progress));
  }

  function snapToStop(raw) {
    let best = stops[0];
    let bestDist = Math.abs(raw - best);
    for (let i = 1; i < stops.length; i += 1) {
      const dist = Math.abs(raw - stops[i]);
      if (dist < bestDist) {
        best = stops[i];
        bestDist = dist;
      }
    }
    return best;
  }

  function progressFromClientX(clientX) {
    const rect = slider.getBoundingClientRect();
    if (rect.width <= 0) return targetProgress;
    const tw = thumbWidth();
    const start = tw / 2;
    const travel = Math.max(rect.width - tw, 1);
    return clampProgress((clientX - rect.left - start) / travel);
  }

  function syncReadoutAria(value) {
    const label = titleForValue(value);
    const hint =
      input.dataset.touched === "1" ? hintForValue(value) : idleDescription;
    const full = hint ? `${label}. ${hint}` : label;
    readout.setAttribute(
      "aria-label",
      `${full}, ${value} (${ends.low} — ${ends.high})`,
    );
    input.setAttribute("aria-valuetext", full);
  }

  function syncStops(value) {
    for (const dot of stopNodes) {
      const v = Number(dot.dataset.value);
      const passed = v <= value;
      dot.classList.toggle("review-panel__slider-stop--passed", passed);
      const fraction = progressFromValue(v);
      dot.style.left = `calc(${fraction} * (100% - var(--shell-review-slider-thumb-width)) + (var(--shell-review-slider-thumb-width) / 2))`;
    }
  }

  function applyVisual(progress) {
    const p = clampProgress(progress);
    slider.style.setProperty("--shell-review-slider-progress", String(p));
  }

  function parseCssColor(color) {
    const m = String(color).match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
    );
    if (!m) return { r: 36, g: 36, b: 38, a: 1 };
    return {
      r: Number(m[1]),
      g: Number(m[2]),
      b: Number(m[3]),
      a: m[4] != null ? Number(m[4]) : 1,
    };
  }

  function fillColor() {
    return parseCssColor(
      getComputedStyle(track).color || getComputedStyle(slider).color,
    );
  }

  function createNoise(seed) {
    const table = new Float32Array(256);
    let s = seed >>> 0;
    for (let i = 0; i < 256; i += 1) {
      s = (s * 1664525 + 1013904223) >>> 0;
      table[i] = (s & 0xffff) / 0xffff;
    }
    return (x, y, t) => {
      const ix = (Math.floor(x) + Math.floor(t * 7)) & 255;
      const iy = (Math.floor(y) + Math.floor(t * 3)) & 255;
      return table[(ix + table[iy] * 255) & 255];
    };
  }

  function resizeCanvas() {
    const rect = track.getBoundingClientRect();
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === canvasW && h === canvasH && nextDpr === dpr) return;
    canvasW = w;
    canvasH = h;
    dpr = nextDpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    noise = createNoise((w * 31 + h * 17) >>> 0);
  }

  function drawFrame(timeMs) {
    const ctx = canvas.getContext("2d");
    if (!ctx || canvasW <= 0 || canvasH <= 0) return;

    const tw = thumbWidth();
    const cell = Math.max(4, cellSize());
    const sq = Math.max(2, cell - 1);
    const progress = visualProgress;
    const travel = Math.max(canvasW - tw, 1);
    const thumbCenter = tw / 2 + progress * travel;
    const rgb = fillColor();
    const t = (timeMs || 0) / 1000;
    const flickerSpeed = 0.55 + progress * 2.4;
    const hintStrength = Math.max(0, 1 - progress) * 0.55;
    const n = noise || createNoise(1);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);

    const cols = Math.ceil(canvasW / cell) + 1;
    const rows = Math.ceil(canvasH / cell) + 1;
    const hintX =
      thumbCenter + 18 + ((Math.sin(t * 0.7) * 0.5 + 0.5) * (canvasW - thumbCenter - 24));

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = col * cell;
        const y = row * cell;
        const cx = x + sq / 2;
        const inTail = cx <= thumbCenter;
        let alpha = 0;

        if (inTail) {
          const along = thumbCenter <= 0 ? 1 : cx / thumbCenter;
          const flicker = n(col, row, t * flickerSpeed);
          const pulse = 0.55 + 0.45 * Math.sin(t * flickerSpeed * 6 + col * 0.4 + row);
          alpha = (0.35 + along * 0.45) * (0.55 + flicker * 0.45) * (0.75 + pulse * 0.25);
          if (prefersReducedMotion()) {
            alpha = 0.55 + along * 0.35;
          }
        } else if (hintStrength > 0.02) {
          const dx = cx - hintX;
          const dy = y + sq / 2 - canvasH / 2;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const blob = Math.max(0, 1 - dist / 28);
          const flicker = prefersReducedMotion()
            ? 0.5
            : 0.35 + 0.65 * n(col + 3, row + 5, t * 1.2);
          alpha = blob * hintStrength * flicker * 0.55;
        }

        if (alpha <= 0.02) continue;
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(1, alpha * rgb.a)})`;
        ctx.fillRect(x, y, sq, sq);
      }
    }
  }

  function shouldAnimate() {
    return (
      !prefersReducedMotion() &&
      inView &&
      tabVisible &&
      block.isConnected
    );
  }

  function stopDrawLoop() {
    if (drawRaf) {
      cancelAnimationFrame(drawRaf);
      drawRaf = 0;
    }
    animating = false;
  }

  function paintOnce() {
    resizeCanvas();
    drawFrame(performance.now());
  }

  function drawLoop(now) {
    drawRaf = 0;
    if (!shouldAnimate()) {
      animating = false;
      paintOnce();
      return;
    }
    resizeCanvas();
    drawFrame(now);
    drawRaf = requestAnimationFrame(drawLoop);
  }

  function ensureDrawLoop() {
    if (prefersReducedMotion()) {
      stopDrawLoop();
      paintOnce();
      return;
    }
    if (!shouldAnimate()) {
      stopDrawLoop();
      paintOnce();
      return;
    }
    if (animating) return;
    animating = true;
    drawRaf = requestAnimationFrame(drawLoop);
  }

  function tickLerp() {
    const lerp = readLerp(
      dragging
        ? "--shell-review-slider-lerp-drag"
        : "--shell-review-slider-lerp",
    );
    const diff = targetProgress - visualProgress;
    if (Math.abs(diff) < 0.0004) {
      visualProgress = targetProgress;
      applyVisual(visualProgress);
      lerpRaf = 0;
      if (prefersReducedMotion()) paintOnce();
      return;
    }
    visualProgress += diff * lerp;
    applyVisual(visualProgress);
    if (prefersReducedMotion()) paintOnce();
    lerpRaf = requestAnimationFrame(tickLerp);
  }

  function setTargetProgress(progress, { immediate = false } = {}) {
    targetProgress = clampProgress(progress);
    if (immediate) {
      visualProgress = targetProgress;
      applyVisual(visualProgress);
      if (lerpRaf) {
        cancelAnimationFrame(lerpRaf);
        lerpRaf = 0;
      }
      if (prefersReducedMotion()) paintOnce();
      return;
    }
    if (!lerpRaf) {
      lerpRaf = requestAnimationFrame(tickLerp);
    }
  }

  function syncFromInputValue({ immediate = false } = {}) {
    const value = Number(input.value);
    setTargetProgress(progressFromValue(value), { immediate });
    syncStops(value);
    syncReadoutTitle(value, { immediate });
    syncReadoutAria(value);
    slider.classList.toggle(
      "review-panel__slider--touched",
      input.dataset.touched === "1",
    );
  }

  function setFromClientX(clientX) {
    const progress = progressFromClientX(clientX);
    const value = valueFromProgressFloor(progress);
    const prev = Number(input.value);
    const wasIdle = input.dataset.touched !== "1";
    input.dataset.touched = "1";
    input.value = String(value);
    setTargetProgress(progress);
    syncStops(value);
    // Drag: текст = левая ступень сегмента (floor), без очереди анимаций.
    if (value !== prev || wasIdle || displayedTitle === idleTitle) {
      syncReadoutTitle(value, { immediate: true });
    }
    syncReadoutAria(value);
    slider.classList.add("review-panel__slider--touched");
  }

  function snapToValue() {
    const snapped = valueFromProgressNearest(targetProgress);
    input.value = String(snapped);
    setTargetProgress(progressFromValue(snapped));
    syncStops(snapped);
    syncReadoutTitle(snapped, { immediate: true });
    syncReadoutAria(snapped);
  }

  input.addEventListener("pointerdown", (event) => {
    dragging = true;
    slider.classList.add("review-panel__slider--dragging");
    try {
      input.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    setFromClientX(event.clientX);
  });

  input.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    setFromClientX(event.clientX);
  });

  const endPointer = () => {
    if (!dragging) return;
    dragging = false;
    slider.classList.remove("review-panel__slider--dragging");
    snapToValue();
  };

  input.addEventListener("pointerup", endPointer);
  input.addEventListener("pointercancel", endPointer);
  input.addEventListener("lostpointercapture", endPointer);

  input.addEventListener("input", () => {
    if (dragging) return;
    input.dataset.touched = "1";
    syncFromInputValue();
  });

  input.addEventListener("keydown", (event) => {
    const keys = new Set([
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ]);
    if (!keys.has(event.key)) return;

    event.preventDefault();
    const current = Number(input.value);
    const idx = Math.max(0, stops.indexOf(current));
    let nextIdx = idx;

    if (event.key === "Home") nextIdx = 0;
    else if (event.key === "End") nextIdx = stops.length - 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextIdx = Math.max(0, idx - 1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextIdx = Math.min(stops.length - 1, idx + 1);
    } else if (event.key === "PageDown") {
      nextIdx = Math.max(0, idx - 2);
    } else if (event.key === "PageUp") {
      nextIdx = Math.min(stops.length - 1, idx + 2);
    }

    input.dataset.touched = "1";
    input.value = String(stops[nextIdx]);
    syncFromInputValue();
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  input.addEventListener("reset-visual", () => {
    dragging = false;
    slider.classList.remove("review-panel__slider--dragging");
    input.dataset.touched = "0";
    input.value = String(min);
    lastValue = min;
    setTargetProgress(0, { immediate: true });
    syncStops(min);
    setReadoutTitle(title, { immediate: true });
    syncReadoutHint(min);
    syncReadoutAria(min);
    slider.classList.remove("review-panel__slider--touched");
    paintOnce();
  });

  const io = new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting);
      ensureDrawLoop();
    },
    { threshold: 0.05 },
  );
  io.observe(block);

  const ro = new ResizeObserver(() => {
    paintOnce();
    ensureDrawLoop();
  });
  ro.observe(track);

  function onVisibility() {
    tabVisible = !document.hidden;
    ensureDrawLoop();
  }

  function onMotionChange() {
    ensureDrawLoop();
  }

  document.addEventListener("visibilitychange", onVisibility);
  if (typeof reducedMotionMq.addEventListener === "function") {
    reducedMotionMq.addEventListener("change", onMotionChange);
  } else {
    reducedMotionMq.addListener(onMotionChange);
  }

  const mo = new MutationObserver(() => {
    paintOnce();
  });
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });

  const cleanup = () => {
    stopDrawLoop();
    if (lerpRaf) cancelAnimationFrame(lerpRaf);
    io.disconnect();
    ro.disconnect();
    mo.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    if (typeof reducedMotionMq.removeEventListener === "function") {
      reducedMotionMq.removeEventListener("change", onMotionChange);
    } else {
      reducedMotionMq.removeListener(onMotionChange);
    }
  };

  block.addEventListener("remove-scale-slider", cleanup, { once: true });

  syncFromInputValue({ immediate: true });
  queueMicrotask(() => {
    paintOnce();
    ensureDrawLoop();
  });

  return block;
}
