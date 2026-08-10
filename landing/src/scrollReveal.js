/**
 * Word-by-word reveal при входе панели и reverse при уходе.
 * Скролл вниз и вверх: появился → исчез → снова появился.
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Пробелы без NBSP — висячие предлоги остаются склеенными. */
const SPLIT_RE = /([ \t\n\r]+)/;

/**
 * @param {CSSStyleDeclaration} styles
 * @param {string} name
 * @param {number} fallback
 */
function readTokenNumber(styles, name, fallback) {
  const n = Number.parseFloat(styles.getPropertyValue(name));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {Element} el
 */
function wrapWords(el) {
  /** @type {HTMLElement[]} */
  const words = [];

  /**
   * @param {ChildNode[]} nodes
   * @returns {DocumentFragment}
   */
  function fragmentFromNodes(nodes) {
    const frag = document.createDocumentFragment();
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? "";
        for (const part of text.split(SPLIT_RE)) {
          if (!part) continue;
          if (/^[ \t\n\r]+$/.test(part)) {
            frag.append(document.createTextNode(part));
            continue;
          }
          const word = document.createElement("span");
          word.className = "landing-scroll-reveal__word";
          word.textContent = part;
          frag.append(word);
          words.push(word);
        }
        continue;
      }
      if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === "BR") {
        frag.append(document.createElement("br"));
        continue;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const clone = /** @type {HTMLElement} */ (node.cloneNode(false));
        clone.append(fragmentFromNodes([...node.childNodes]));
        frag.append(clone);
      }
    }
    return frag;
  }

  const next = fragmentFromNodes([...el.childNodes]);
  el.replaceChildren(next);
  return words;
}

/**
 * @param {object} [opts]
 * @param {string} [opts.selector]
 * @returns {(() => void) | null}
 */
export function initLandingScrollReveal(opts = {}) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return null;
  }

  const selector = opts.selector ?? "[data-landing-scroll-reveal]";
  const elements = [...document.querySelectorAll(selector)];
  if (!elements.length) return null;

  const styles = getComputedStyle(document.documentElement);
  const baseOpacity = readTokenNumber(
    styles,
    "--landing-scroll-reveal-base-opacity",
    0.1,
  );
  const baseRotation = readTokenNumber(
    styles,
    "--landing-scroll-reveal-base-rotation",
    3,
  );
  const blurStrength = readTokenNumber(
    styles,
    "--landing-scroll-reveal-blur",
    4,
  );
  const stagger = readTokenNumber(
    styles,
    "--landing-scroll-reveal-stagger",
    0.08,
  );
  const duration = readTokenNumber(
    styles,
    "--landing-scroll-reveal-duration",
    1.05,
  );
  const enableBlur =
    styles.getPropertyValue("--landing-scroll-reveal-blur-enabled").trim() !==
    "0";

  /** @type {ScrollTrigger[]} */
  const triggers = [];
  /** @type {gsap.core.Timeline[]} */
  const timelines = [];

  for (const el of elements) {
    if (!(el instanceof HTMLElement)) continue;

    el.classList.add("landing-scroll-reveal");
    const words = wrapWords(el);
    if (!words.length) continue;

    const triggerEl = el.closest("[data-landing-panel]") ?? el;

    gsap.set(el, {
      transformOrigin: "50% 50%",
      rotate: baseRotation,
    });
    gsap.set(words, {
      opacity: baseOpacity,
      ...(enableBlur ? { filter: `blur(${blurStrength}px)` } : {}),
    });

    const tl = gsap.timeline({ paused: true });
    tl.to(
      el,
      {
        rotate: 0,
        duration,
        ease: "power2.out",
      },
      0,
    );
    tl.to(
      words,
      {
        opacity: 1,
        ...(enableBlur ? { filter: "blur(0px)" } : {}),
        duration,
        stagger,
        ease: "power2.out",
      },
      0,
    );
    timelines.push(tl);

    // play при входе, reverse при уходе — в обе стороны скролла.
    const st = ScrollTrigger.create({
      trigger: triggerEl,
      start: "top 78%",
      end: "bottom 22%",
      animation: tl,
      toggleActions: "play reverse play reverse",
    });
    triggers.push(st);
  }

  ScrollTrigger.refresh();

  return () => {
    for (const t of triggers) t.kill();
    for (const tl of timelines) tl.kill();
  };
}
