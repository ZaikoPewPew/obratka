/**
 * Brand marks for mesh / gradient frames (white fill on colorful wash).
 * Source SVG: logo-default.svg / logo-devil.svg / logo-angel.svg
 */

import {
  LOGO_DONE_ACCENTS,
  LOGO_DONE_BLOB,
  LOGO_DONE_CROWN,
} from "./logoDonePaths.js";

/** logo-default.svg — body + accents (evenodd compound). */
const MARK_PATH =
  "M20.6027 0.281684C23.3488 0.880657 26.0451 2.69035 27.384 4.83325C28.8171 7.12673 29.1719 10.6683 28.2486 13.4616C27.2673 16.4296 25.1995 18.9102 22.6865 20.1339L21.3828 20.7686L22.4604 20.9055C23.967 21.0965 25.27 21.586 28.6272 23.2215C31.2482 24.4983 31.6574 24.6408 32.7155 24.6434C34.444 24.6479 35.4647 23.9487 36.9599 21.7358C37.5987 20.7905 38.3827 19.843 38.7021 19.6301C41.4913 17.772 44.3529 23.1105 43.9644 29.4478C43.4588 37.697 38.1852 44.8245 30.5204 47.6186C27.5948 48.6851 25.4959 49.0022 21.377 49C17.9954 48.998 17.3783 48.9446 15.4507 48.4861C7.63366 46.6273 2.66689 41.6391 2.27083 35.2498C1.99402 30.7849 3.72284 26.6919 7.49003 22.8939C10.3035 20.057 10.4169 19.1903 8.5185 15.0282C7.59746 13.0083 7.36227 11.8359 7.50397 9.96944C7.71768 7.15523 9.30616 3.97067 11.3345 2.29032C12.452 1.36444 14.2575 0.461946 15.5308 0.19283C16.8914 -0.0947631 19.0502 -0.0570194 20.6027 0.281684ZM1.38425 6.36892C3.00468 7.74595 4.64543 7.99875 6.44433 7.14835C7.34117 6.72433 7.46389 6.70467 7.35065 7.00288C6.74147 8.60853 6.51208 11.1585 6.84562 12.6181L7.01693 13.3671L5.92148 13.2317C3.10727 12.8835 1.29791 11.835 0.453147 10.0628C0.102 9.32604 0.0116029 8.79017 0.000569105 7.37933C-0.00736752 6.3583 0.0683179 5.59401 0.180398 5.56314C0.286865 5.53405 0.828686 5.89654 1.38425 6.36892ZM6.82529 14.0687C7.15843 14.1369 7.44763 14.5247 7.93487 15.5576C8.29743 16.3258 8.57386 16.9743 8.54908 16.9987C8.52431 17.0232 7.8706 16.8271 7.09629 16.5631C6.32199 16.2991 4.785 15.9804 3.68064 15.8552C1.38928 15.5951 1.26501 15.4111 2.86085 14.6421C3.84596 14.1676 5.87464 13.8741 6.82529 14.0687Z";

/** logo-devil.svg — right horn (morph overlay). */
const BAN_HORN_RIGHT_PATH =
  "M27.8474 5.48888C27.9738 3.89688 27.4852 2.16314 26.5386 0.845056C26.1071 0.244029 25.8695 0.00708043 25.6986 0.00708043C25.6118 0.00708043 25.5421 0.0400361 25.5178 0.092648C25.4961 0.139735 25.464 0.662283 25.4464 1.25392C25.4205 2.12632 25.3949 2.40155 25.3106 2.71023C25.1537 3.28485 24.8614 3.89134 24.4639 4.44254C24.4071 4.52122 24.4269 4.6321 24.509 4.68383C24.8226 4.88125 25.5456 5.34729 26.0074 5.73105C26.4569 6.10453 27.0215 6.70107 27.303 7.00652C27.385 7.09549 27.5331 7.06957 27.5751 6.95618C27.7623 6.45054 27.7943 6.15867 27.8474 5.48888Z";

/** logo-devil.svg — left accents (evenodd). */
const BAN_ACCENTS_PATH =
  "M6.44433 10.8C4.64543 11.6574 3.00468 11.4025 1.38425 10.014C0.828687 9.53774 0.286866 9.17223 0.180399 9.20157C0.0683189 9.23268 -0.00736652 10.0033 0.000570104 11.0329C0.0116039 12.4555 0.102001 12.9958 0.453148 13.7387C1.29791 15.5256 3.10727 16.5829 5.92148 16.9339L7.01693 17.0705L6.84562 16.3153C6.51209 14.8435 6.74147 12.2723 7.35065 10.6533C7.46389 10.3526 7.34117 10.3724 6.44433 10.8ZM7.93487 19.2792C7.44764 18.2378 7.15843 17.8467 6.82529 17.7779C5.87464 17.5817 3.84596 17.8776 2.86085 18.3561C1.26501 19.1315 1.38928 19.317 3.68065 19.5793C4.785 19.7055 6.32199 20.0268 7.09629 20.293C7.8706 20.5592 8.52431 20.7571 8.54909 20.7323C8.57386 20.7077 8.29743 20.0538 7.93487 19.2792Z";

/** logo-devil.svg — body + left horn. */
const BAN_MARK_PATH =
  "M10.1937 0.309892C9.37789 1.16219 8.80963 2.34171 8.52572 3.77205C8.37768 4.51771 8.3666 5.73815 8.50213 6.36353C8.62384 6.92495 8.84317 7.53683 9.07545 7.96291L9.28126 8.35801C8.30529 9.95975 7.63725 11.8748 7.50397 13.6445C7.36227 15.5266 7.59747 16.7087 8.5185 18.7454C10.4169 22.9422 10.3035 23.8161 7.49003 26.6765C3.72284 30.5062 1.99402 34.6333 2.27083 39.1353C2.66689 45.5779 7.63367 50.6075 15.4507 52.4819C17.3783 52.9441 17.9954 52.998 21.377 53C25.4959 53.0022 27.5949 52.6824 30.5204 51.6071C38.1852 48.7897 43.4588 41.6029 43.9644 33.285C44.3529 26.895 41.4913 21.5121 38.7021 23.3856C38.3827 23.6003 37.5987 24.5556 36.9599 25.5089C35.4647 27.7402 34.444 28.4452 32.7155 28.4406C31.6574 28.4381 31.2482 28.2944 28.6272 27.007C25.27 25.3578 23.967 24.8643 22.4604 24.6716L21.3828 24.5336L22.6865 23.8936C25.1995 22.6597 27.2673 20.1585 28.2486 17.1658C29.1719 14.3492 28.8171 10.7782 27.384 8.4656C26.0451 6.30486 23.3488 4.4801 20.6027 3.87614C19.0502 3.53462 16.8914 3.49656 15.5308 3.78655C14.8074 3.9407 14.3049 4.05286 13.4617 4.50647L13.887 5.23532C14.1777 5.65792 13.8801 6.25351 13.4057 6.05847C13.2906 6.01113 13.182 5.95892 13.0855 5.9015C12.7271 5.68834 12.2513 5.23532 12.2513 5.23532C11.7326 4.62383 11.2852 3.91869 11.0614 3.29107C10.8602 2.72671 10.7878 2.1472 10.7875 1.09902C10.7874 0.583512 10.774 0.126973 10.7576 0.0844335C10.6936 -0.0817142 10.491 -0.00064506 10.1937 0.309892Z";

const VIEWBOX_DEFAULT = "0 0 44 49";
const VIEWBOX_DONE = "0 0 52 59";
const VIEWBOX_EVIL = "0 0 44 53";
const SIZE_DEFAULT = { width: "44", height: "49" };
const SIZE_DONE = { width: "52", height: "59" };
const SIZE_EVIL = { width: "44", height: "53" };
/** Horns in logo-devil (canvas 53) → поверх default (canvas 49), без смены размеров SVG. */
const EVIL_HORN_DY =
  Number.parseFloat(SIZE_DEFAULT.height) - Number.parseFloat(SIZE_EVIL.height);

/** @type {WeakMap<SVGElement, Animation[]>} */
const morphAnims = new WeakMap();

/**
 * @returns {string}
 */
function defaultMarkInnerHtml() {
  return `<path data-brand-part="blob" fill-rule="evenodd" clip-rule="evenodd" d="${MARK_PATH}" fill="white" />`;
}

/**
 * @param {{ extrasOpacity?: number }} [opts]
 * @returns {string}
 */
function logoDoneInnerHtml(opts = {}) {
  const op = opts.extrasOpacity ?? 1;
  return `
  <path data-brand-part="accents" fill-rule="evenodd" clip-rule="evenodd" d="${LOGO_DONE_ACCENTS}" fill="white" opacity="${op}" />
  <path data-brand-part="blob" d="${LOGO_DONE_BLOB}" fill="white" />
  <path data-brand-part="crown" fill-rule="evenodd" clip-rule="evenodd" d="${LOGO_DONE_CROWN}" fill="white" opacity="${op}" />
`;
}

/**
 * @param {string} className
 * @returns {string}
 */
export function brandMarkSvg(className) {
  return `<svg class="${className}" width="${SIZE_DEFAULT.width}" height="${SIZE_DEFAULT.height}" viewBox="${VIEWBOX_DEFAULT}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-brand-mark="default">
  ${defaultMarkInnerHtml()}
</svg>`;
}

/**
 * Ban frame mark (horns + accents + blob).
 * @param {string} [className="ban-screen__brand-mark"]
 * @returns {string}
 */
export function banBrandMarkSvg(className = "ban-screen__brand-mark") {
  return `<svg class="${className}" width="${SIZE_EVIL.width}" height="${SIZE_EVIL.height}" viewBox="${VIEWBOX_EVIL}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-brand-mark="evil">
  <path data-brand-part="flame" d="${BAN_HORN_RIGHT_PATH}" fill="white" />
  <path data-brand-part="accents" fill-rule="evenodd" clip-rule="evenodd" d="${BAN_ACCENTS_PATH}" fill="white" />
  <path data-brand-part="blob" d="${BAN_MARK_PATH}" fill="white" />
</svg>`;
}

/**
 * @param {SVGElement} svg
 * @returns {SVGPathElement[]}
 */
function evilHornPaths(svg) {
  return /** @type {SVGPathElement[]} */ ([
    ...svg.querySelectorAll("[data-brand-part='flame']"),
  ]);
}

/**
 * @param {SVGElement} svg
 * @param {string} d
 * @param {{ evenodd?: boolean }} [pathOpts]
 * @returns {SVGPathElement}
 */
function createHornPath(svg, d, pathOpts = {}) {
  const horn = document.createElementNS("http://www.w3.org/2000/svg", "path");
  horn.setAttribute("data-brand-part", "flame");
  if (pathOpts.evenodd) {
    horn.setAttribute("fill-rule", "evenodd");
    horn.setAttribute("clip-rule", "evenodd");
  }
  horn.setAttribute("d", d);
  horn.setAttribute("fill", "white");
  horn.setAttribute("transform", `translate(0 ${EVIL_HORN_DY})`);
  // After blob so horns paint on top (left horn tip / right horn not covered).
  svg.appendChild(horn);
  return horn;
}

/**
 * Рожки поверх default blob: тот же SVG size/viewBox, horns сдвинуты в координаты 49-tall.
 * Body+left horn + right horn tip — white overlay без смены canvas.
 * @param {SVGElement} svg
 * @param {{ opacity?: number }} [opts]
 * @returns {SVGPathElement[]}
 */
function ensureEvilHorns(svg, opts = {}) {
  const opacity = opts.opacity ?? 1;
  let horns = evilHornPaths(svg);
  if (horns.length === 0) {
    // Body (incl. left horn) then right horn tip on top.
    createHornPath(svg, BAN_MARK_PATH);
    createHornPath(svg, BAN_HORN_RIGHT_PATH);
    horns = evilHornPaths(svg);
  } else {
    for (const horn of horns) {
      if (!horn.getAttribute("transform")) {
        horn.setAttribute("transform", `translate(0 ${EVIL_HORN_DY})`);
      }
    }
  }
  for (const horn of horns) {
    horn.setAttribute("opacity", String(opacity));
    horn.style.opacity = "";
  }
  return horns;
}

/**
 * Success / done mark (halo + body + accents). Class `logo-done` is always included.
 * @param {string} className
 * @returns {string}
 */
export function logoDoneMarkSvg(className) {
  const classes = ["logo-done", className].filter(Boolean).join(" ");
  return `<svg class="${classes}" width="${SIZE_DONE.width}" height="${SIZE_DONE.height}" viewBox="${VIEWBOX_DONE}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" data-brand-mark="done">${logoDoneInnerHtml({ extrasOpacity: 1 })}
</svg>`;
}

/**
 * @param {SVGElement} svg
 */
function cancelBrandMarkMorph(svg) {
  const running = morphAnims.get(svg);
  if (!running) return;
  for (const anim of running) {
    try {
      anim.cancel();
    } catch {
      /* ignore */
    }
  }
  morphAnims.delete(svg);
}

/**
 * @param {SVGElement} svg
 * @returns {NodeListOf<Element>}
 */
function logoDoneExtras(svg) {
  return svg.querySelectorAll(
    "[data-brand-part='crown'], [data-brand-part='accents']",
  );
}

/**
 * Smart-animate default mark → logo-done (angel) on the same SVG node
 * (avoids re-firing entrance animation from DOM replace of the <svg>).
 * Body stays; halo + accents fade in.
 *
 * @param {SVGElement | null | undefined} svg
 * @param {{
 *   durationMs?: number;
 *   easing?: string;
 *   reducedMotion?: boolean;
 * }} [opts]
 */
export function morphBrandMarkToDone(svg, opts = {}) {
  if (!svg || !(svg instanceof SVGElement)) return;
  if (svg.dataset.brandMark === "done") return;

  const durationMs = opts.durationMs ?? 800;
  const easing = opts.easing || "cubic-bezier(0.16, 1, 0.3, 1)";
  const reduced =
    opts.reducedMotion === true ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  cancelBrandMarkMorph(svg);
  svg.classList.remove("brand-mark--evil");
  svg.classList.add("logo-done");
  svg.dataset.brandMark = "done";
  svg.setAttribute("viewBox", VIEWBOX_DONE);
  svg.setAttribute("width", SIZE_DONE.width);
  svg.setAttribute("height", SIZE_DONE.height);
  svg.innerHTML = logoDoneInnerHtml({ extrasOpacity: reduced ? 1 : 0 });

  if (reduced) return;

  const extras = [...logoDoneExtras(svg)];
  if (extras.length === 0) return;

  /** @type {Animation[]} */
  const animations = extras.map((el) =>
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: durationMs,
      easing,
      fill: "forwards",
    }),
  );
  morphAnims.set(svg, animations);

  void Promise.all(animations.map((a) => a.finished.catch(() => undefined))).then(
    () => {
      if (morphAnims.get(svg) !== animations) return;
      if (svg.dataset.brandMark === "done") {
        for (const el of extras) {
          el.style.opacity = "";
          el.setAttribute("opacity", "1");
        }
      }
      for (const anim of animations) {
        try {
          anim.cancel();
        } catch {
          /* ignore */
        }
      }
      morphAnims.delete(svg);
    },
  );
}

/**
 * Default mark → evil: рожки нарастают на тот же blob, без смены width/height/viewBox.
 *
 * @param {SVGElement | null | undefined} svg
 * @param {{
 *   durationMs?: number;
 *   easing?: string;
 *   reducedMotion?: boolean;
 * }} [opts]
 */
export function morphBrandMarkToEvil(svg, opts = {}) {
  if (!svg || !(svg instanceof SVGElement)) return;

  const durationMs = opts.durationMs ?? 600;
  const easing = opts.easing || "cubic-bezier(0.16, 1, 0.3, 1)";
  const reduced =
    opts.reducedMotion === true ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  cancelBrandMarkMorph(svg);

  if (svg.dataset.brandMark === "done" || svg.classList.contains("logo-done")) {
    resetBrandMarkToDefault(svg);
  }

  const alreadyEvil =
    svg.dataset.brandMark === "evil" && evilHornPaths(svg).length > 0;
  svg.classList.remove("logo-done");
  svg.classList.add("brand-mark--evil");
  svg.dataset.brandMark = "evil";
  // Размеры SVG не трогаем — рожки рисуются overflow поверх default canvas.

  if (alreadyEvil) {
    const horns = ensureEvilHorns(svg, { opacity: 1 });
    for (const horn of horns) {
      horn.setAttribute("opacity", "1");
      horn.style.opacity = "";
    }
    return;
  }

  const horns = ensureEvilHorns(svg, { opacity: reduced ? 1 : 0 });
  if (reduced) {
    for (const horn of horns) horn.setAttribute("opacity", "1");
    return;
  }

  /** @type {Animation[]} */
  const animations = horns.map((horn) =>
    horn.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: durationMs,
      easing,
      fill: "forwards",
    }),
  );
  morphAnims.set(svg, animations);

  void Promise.all(animations.map((a) => a.finished.catch(() => undefined))).then(
    () => {
      if (morphAnims.get(svg) !== animations) return;
      if (svg.dataset.brandMark === "evil") {
        for (const horn of horns) {
          horn.style.opacity = "";
          horn.setAttribute("opacity", "1");
        }
      }
      for (const anim of animations) {
        try {
          anim.cancel();
        } catch {
          /* ignore */
        }
      }
      morphAnims.delete(svg);
    },
  );
}

/**
 * Evil → default: рожки гаснут; size/viewBox не меняются.
 *
 * @param {SVGElement | null | undefined} svg
 * @param {{
 *   durationMs?: number;
 *   easing?: string;
 *   reducedMotion?: boolean;
 * }} [opts]
 */
export function morphBrandMarkToDefault(svg, opts = {}) {
  if (!svg || !(svg instanceof SVGElement)) return;
  if (svg.dataset.brandMark === "default") return;

  const durationMs = opts.durationMs ?? 600;
  const easing = opts.easing || "cubic-bezier(0.16, 1, 0.3, 1)";
  const reduced =
    opts.reducedMotion === true ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  if (svg.dataset.brandMark !== "evil" || reduced) {
    resetBrandMarkToDefault(svg);
    return;
  }

  cancelBrandMarkMorph(svg);
  const horns = evilHornPaths(svg);
  if (horns.length === 0) {
    svg.classList.remove("brand-mark--evil");
    svg.dataset.brandMark = "default";
    return;
  }

  /** @type {Animation[]} */
  const animations = horns.map((horn) => {
    const fromOp = Number.parseFloat(horn.getAttribute("opacity") || "1") || 1;
    return horn.animate([{ opacity: fromOp }, { opacity: 0 }], {
      duration: durationMs,
      easing,
      fill: "forwards",
    });
  });
  morphAnims.set(svg, animations);

  void Promise.all(animations.map((a) => a.finished.catch(() => undefined))).then(
    () => {
      if (morphAnims.get(svg) !== animations) return;
      for (const anim of animations) {
        try {
          anim.cancel();
        } catch {
          /* ignore */
        }
      }
      morphAnims.delete(svg);
      if (svg.dataset.brandMark !== "evil") return;
      for (const horn of horns) horn.remove();
      svg.classList.remove("brand-mark--evil");
      svg.dataset.brandMark = "default";
    },
  );
}

/**
 * Snap mark back to default (cancel in-flight morph).
 *
 * @param {SVGElement | null | undefined} svg
 */
export function resetBrandMarkToDefault(svg) {
  if (!svg || !(svg instanceof SVGElement)) return;

  cancelBrandMarkMorph(svg);
  svg.classList.remove("logo-done", "brand-mark--evil");
  svg.dataset.brandMark = "default";
  svg.setAttribute("viewBox", VIEWBOX_DEFAULT);
  svg.setAttribute("width", SIZE_DEFAULT.width);
  svg.setAttribute("height", SIZE_DEFAULT.height);
  svg.innerHTML = defaultMarkInnerHtml();
}
