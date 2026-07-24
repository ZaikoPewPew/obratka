/**
 * Правый brand visual: mesh + noise + марка.
 * Варианты: default | invalid (evil) | done (logo-done).
 */

import {
  brandMarkSvg,
  morphBrandMarkToDefault,
  morphBrandMarkToDone,
  morphBrandMarkToEvil,
  resetBrandMarkToDefault,
} from "../../assets/brand/brandMarks.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import {
  getBrandMarkMorphMotion,
  getMotionFieldErrorVisual,
  getReviewMeshDoneMotion,
} from "../../utils/motionTokens.js";

/** @typedef {"default" | "invalid" | "done"} BrandScreenVisualVariant */

const INVALID_CLASS = "url-screen--invalid";
const DONE_CLASS = "url-screen--done";

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
 * @param {{
 *   classPrefix?: string;
 *   markClassName?: string;
 *   withBrandSlot?: boolean;
 *   markPending?: boolean;
 * }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   glow: HTMLElement;
 *   brand: HTMLElement;
 *   brandSlot: HTMLElement;
 *   meshWash: ReturnType<typeof mountMeshGradientWash>;
 *   bindScreenRoot: (screenRoot: HTMLElement) => void;
 *   setActive: (active: boolean) => void;
 *   setVariant: (variant: BrandScreenVisualVariant) => void;
 *   getVariant: () => BrandScreenVisualVariant;
 *   getMarkSvg: () => SVGElement | null;
 *   ensureMark: () => SVGElement | null;
 * }}
 */
export function createBrandScreenVisual(opts = {}) {
  const classPrefix = opts.classPrefix ?? "url-screen";
  const markClassName = opts.markClassName ?? `${classPrefix}__brand-mark`;
  const withBrandSlot = Boolean(opts.withBrandSlot);
  const markPending = Boolean(opts.markPending);

  const root = document.createElement("div");
  root.className = `${classPrefix}__visual`;
  root.setAttribute("aria-hidden", "true");

  const glow = document.createElement("div");
  glow.className = `${classPrefix}__glow`;

  const noise = document.createElement("span");
  noise.className = `${classPrefix}__noise`;

  const brand = document.createElement("div");
  brand.className = `${classPrefix}__brand`;

  /** @type {HTMLElement} */
  let brandSlot = brand;
  if (withBrandSlot) {
    brandSlot = document.createElement("div");
    brandSlot.className = `${classPrefix}__brand-slot`;
    brand.append(brandSlot);
  }

  if (markPending) {
    brand.dataset.brandMark = "pending";
  } else {
    brandSlot.innerHTML = brandMarkSvg(markClassName);
  }

  root.append(glow, noise, brand);
  const meshWash = mountMeshGradientWash(glow);
  meshWash.setActive(false);

  /** @type {HTMLElement | null} */
  let screenRoot = null;
  /** @type {BrandScreenVisualVariant} */
  let variant = "default";

  /**
   * @param {HTMLElement} next
   */
  function bindScreenRoot(next) {
    screenRoot = next;
  }

  /**
   * @returns {SVGElement | null}
   */
  function getMarkSvg() {
    return /** @type {SVGElement | null} */ (
      brandSlot.querySelector("svg") ?? brand.querySelector("svg") ?? null
    );
  }

  /**
   * @returns {SVGElement | null}
   */
  function ensureMark() {
    let svg = getMarkSvg();
    if (svg) return svg;
    brandSlot.innerHTML = brandMarkSvg(markClassName);
    delete brand.dataset.brandMark;
    return getMarkSvg();
  }

  /**
   * @param {BrandScreenVisualVariant} next
   */
  function setVariant(next) {
    if (!screenRoot) {
      throw new Error("brand-screen-visual: call bindScreenRoot before setVariant");
    }

    const target = next === "invalid" || next === "done" ? next : "default";
    if (target === variant) return;

    const reduced = prefersReducedMotion();
    const svg = ensureMark();

    if (target === "invalid") {
      screenRoot.classList.remove(DONE_CLASS);
      screenRoot.classList.add(INVALID_CLASS);
      const { durationMs, easing } = getMotionFieldErrorVisual();
      morphBrandMarkToEvil(svg, { durationMs, easing, reducedMotion: reduced });
      meshWash.transitionToCssColors({ durationMs, easing });
      variant = "invalid";
      return;
    }

    if (target === "done") {
      screenRoot.classList.remove(INVALID_CLASS);
      screenRoot.classList.add(DONE_CLASS);
      const { durationMs, easing } = getBrandMarkMorphMotion();
      morphBrandMarkToDone(svg, { durationMs, easing, reducedMotion: reduced });
      const mesh = getReviewMeshDoneMotion();
      meshWash.transitionToCssColors({
        durationMs: mesh.durationMs,
        easing: mesh.easing,
      });
      variant = "done";
      return;
    }

    const wasInvalid = screenRoot.classList.contains(INVALID_CLASS);
    const wasDone = screenRoot.classList.contains(DONE_CLASS);
    screenRoot.classList.remove(INVALID_CLASS, DONE_CLASS);

    if (wasInvalid && svg) {
      const { durationMs, easing } = getMotionFieldErrorVisual();
      morphBrandMarkToDefault(svg, {
        durationMs,
        easing,
        reducedMotion: reduced,
      });
      meshWash.transitionToCssColors({ durationMs, easing });
    } else if (wasDone) {
      if (svg) resetBrandMarkToDefault(svg);
      else ensureMark();
      meshWash.refresh();
    } else if (svg?.dataset.brandMark === "evil") {
      const { durationMs, easing } = getMotionFieldErrorVisual();
      morphBrandMarkToDefault(svg, {
        durationMs,
        easing,
        reducedMotion: reduced,
      });
      meshWash.transitionToCssColors({ durationMs, easing });
    } else {
      if (svg) resetBrandMarkToDefault(svg);
      meshWash.refresh();
    }

    variant = "default";
  }

  return {
    root,
    glow,
    brand,
    brandSlot,
    meshWash,
    bindScreenRoot,
    setActive(active) {
      meshWash.setActive(active);
    },
    setVariant,
    getVariant: () => variant,
    getMarkSvg,
    ensureMark,
  };
}
