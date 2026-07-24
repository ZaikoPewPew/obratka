/**
 * Оценка яркости фона под элементом (для адаптивного контраста UI).
 * Картинки: CORS-probe в кэш; при ошибке — эвристика «превью ≈ тёмное».
 */

/** Порог relative luminance: ниже → считаем фон тёмным. */
export const BACKDROP_DARK_LUMA = 0.42;

/** Fallback-luma для cross-origin превью, которые не удалось прочитать. */
const PREVIEW_FALLBACK_LUMA = 0.28;

/** Luma светлой поверхности UI (карточка / empty / body). */
const UI_SURFACE_LUMA = 0.92;

/** @type {Map<string, number | 'failed' | Promise<number | 'failed'>>} */
const imageLumaCache = new Map();

/**
 * Relative luminance (sRGB), 0…1.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number}
 */
export function relativeLuminance(r, g, b) {
  const linearize = (channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = linearize(r);
  const G = linearize(g);
  const B = linearize(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * @param {string} color
 * @returns {{ r: number; g: number; b: number; a: number } | null}
 */
function parseCssColor(color) {
  if (!color || color === "transparent") return null;
  const comma = color.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );
  if (comma) {
    return {
      r: Number(comma[1]),
      g: Number(comma[2]),
      b: Number(comma[3]),
      a: comma[4] === undefined ? 1 : Number(comma[4]),
    };
  }
  const space = color.match(
    /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i,
  );
  if (space) {
    const alphaRaw = space[4];
    let a = 1;
    if (alphaRaw !== undefined) {
      a = alphaRaw.endsWith("%")
        ? Number.parseFloat(alphaRaw) / 100
        : Number(alphaRaw);
    }
    return {
      r: Number(space[1]),
      g: Number(space[2]),
      b: Number(space[3]),
      a,
    };
  }
  return null;
}

/**
 * Непрозрачный фон вверх по дереву от el (или null).
 * @param {Element | null} el
 * @returns {number | null}
 */
function solidAncestorLuma(el) {
  let node = el;
  while (node && node instanceof Element) {
    const bg = parseCssColor(getComputedStyle(node).backgroundColor);
    if (bg && bg.a >= 0.85) {
      return relativeLuminance(bg.r, bg.g, bg.b);
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * @param {string} src
 * @returns {Promise<number | 'failed'>}
 */
function probeImageLuma(src) {
  const cached = imageLumaCache.get(src);
  if (cached !== undefined) {
    return cached instanceof Promise ? cached : Promise.resolve(cached);
  }

  const pending = new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 16;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          imageLumaCache.set(src, "failed");
          resolve("failed");
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let sum = 0;
        const pixels = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          sum += relativeLuminance(data[i], data[i + 1], data[i + 2]);
        }
        const avg = sum / pixels;
        imageLumaCache.set(src, avg);
        resolve(avg);
      } catch {
        imageLumaCache.set(src, "failed");
        resolve("failed");
      }
    };
    img.onerror = () => {
      imageLumaCache.set(src, "failed");
      resolve("failed");
    };
    img.src = src;
  });

  imageLumaCache.set(src, pending);
  return pending;
}

/**
 * @param {Element} el
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ luma: number; pendingSrc?: string }}
 */
function sampleElementLuma(el, clientX, clientY) {
  if (el instanceof HTMLImageElement) {
    const src = el.currentSrc || el.src;
    if (!src || el.naturalWidth === 0) {
      return { luma: solidAncestorLuma(el) ?? UI_SURFACE_LUMA };
    }
    const cached = imageLumaCache.get(src);
    if (typeof cached === "number") {
      return { luma: cached };
    }
    if (cached === "failed") {
      const isPreview = el.classList.contains("home-screen__preview-img");
      return { luma: isPreview ? PREVIEW_FALLBACK_LUMA : UI_SURFACE_LUMA };
    }
    const isPreview = el.classList.contains("home-screen__preview-img");
    return {
      luma: isPreview ? PREVIEW_FALLBACK_LUMA : UI_SURFACE_LUMA,
      pendingSrc: src,
    };
  }

  if (el instanceof Element && el.classList.contains("home-screen__preview")) {
    const img = el.querySelector("img.home-screen__preview-img");
    if (img instanceof HTMLImageElement) {
      return sampleElementLuma(img, clientX, clientY);
    }
    return { luma: solidAncestorLuma(el) ?? UI_SURFACE_LUMA };
  }

  const solid = solidAncestorLuma(el);
  if (solid !== null) return { luma: solid };

  return { luma: UI_SURFACE_LUMA };
}

/**
 * Средняя яркость «за» target (сам target и его потомки пропускаются).
 *
 * @param {HTMLElement} target
 * @param {{ sampleCount?: number }} [opts]
 * @returns {{ luma: number; pendingSrcs: string[] }}
 */
export function sampleBackdropLuminance(target, opts = {}) {
  const sampleCount = opts.sampleCount ?? 5;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return { luma: UI_SURFACE_LUMA, pendingSrcs: [] };
  }

  const prevEvents = target.style.pointerEvents;
  target.style.pointerEvents = "none";

  /** @type {number[]} */
  const samples = [];
  /** @type {Set<string>} */
  const pending = new Set();

  try {
    const y = rect.top + rect.height / 2;
    for (let i = 0; i < sampleCount; i += 1) {
      const t = sampleCount === 1 ? 0.5 : i / (sampleCount - 1);
      const x = rect.left + rect.width * (0.15 + t * 0.7);
      const stack = document.elementsFromPoint(x, y);
      const hit =
        stack.find(
          (el) => el instanceof Element && !target.contains(el),
        ) ?? null;
      if (!hit) {
        samples.push(UI_SURFACE_LUMA);
        continue;
      }
      const { luma, pendingSrc } = sampleElementLuma(hit, x, y);
      samples.push(luma);
      if (pendingSrc) pending.add(pendingSrc);
    }
  } finally {
    target.style.pointerEvents = prevEvents;
  }

  if (!samples.length) {
    return { luma: UI_SURFACE_LUMA, pendingSrcs: [...pending] };
  }

  const luma = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return { luma, pendingSrcs: [...pending] };
}

/**
 * Подтянуть CORS-probe для src и вернуть, были ли обновления кэша.
 * @param {string[]} srcs
 * @returns {Promise<boolean>}
 */
export async function resolveImageLumaProbes(srcs) {
  if (!srcs.length) return false;
  const unique = [...new Set(srcs)];
  const before = unique.map((src) => imageLumaCache.get(src));
  await Promise.all(unique.map((src) => probeImageLuma(src)));
  return unique.some((src, index) => imageLumaCache.get(src) !== before[index]);
}

/**
 * @param {HTMLElement} target
 * @param {{ sampleCount?: number; threshold?: number }} [opts]
 * @returns {Promise<boolean>}
 */
export async function isBackdropDark(target, opts = {}) {
  const threshold = opts.threshold ?? BACKDROP_DARK_LUMA;
  let { luma, pendingSrcs } = sampleBackdropLuminance(target, opts);
  if (pendingSrcs.length) {
    const updated = await resolveImageLumaProbes(pendingSrcs);
    if (updated) {
      ({ luma } = sampleBackdropLuminance(target, opts));
    }
  }
  return luma < threshold;
}
