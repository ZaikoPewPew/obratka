/**
 * Open/close хелперы для split brand-экранов (url / referral / auth).
 * `handoff: true` — смена соседа без переигрывания правого visual.
 */

/**
 * @typedef {{ handoff?: boolean }} BrandScreenTransitionOpts
 */

/**
 * @param {object} args
 * @param {HTMLElement} args.root
 * @param {{ refresh: () => void; setActive: (active: boolean) => void }} args.meshWash
 * @param {BrandScreenTransitionOpts} [args.opts]
 * @param {() => void} [args.prepare]
 * @returns {void}
 */
export function openBrandScreen({ root, meshWash, opts = {}, prepare }) {
  const handoff = Boolean(opts.handoff);

  root.hidden = false;
  root.classList.toggle("url-screen--handoff", handoff);
  prepare?.();

  if (handoff) {
    // Корень остаётся видимым за счёт --handoff; сброс --open только
    // перезапускает reveal левой формы, visual/brand-mark не анимируются.
    root.classList.remove("url-screen--open");
    void root.offsetWidth;
    root.classList.add("url-screen--open");
    meshWash.setActive(true);
    return;
  }

  root.classList.remove("url-screen--open");
  meshWash.refresh();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.add("url-screen--open");
      meshWash.setActive(true);
    });
  });
}

/**
 * @param {object} args
 * @param {HTMLElement} args.root
 * @param {{ setActive: (active: boolean) => void }} args.meshWash
 * @param {() => boolean} args.isClosing
 * @param {(value: boolean) => void} args.setClosing
 * @param {() => number} args.getFallbackMs
 * @param {BrandScreenTransitionOpts} [args.opts]
 * @returns {Promise<void>}
 */
export function closeBrandScreen({
  root,
  meshWash,
  isClosing,
  setClosing,
  getFallbackMs,
  opts = {},
}) {
  const handoff = Boolean(opts.handoff);

  if (root.hidden || isClosing()) {
    return Promise.resolve();
  }

  if (handoff) {
    root.classList.add("url-screen--handoff");
    root.classList.remove("url-screen--open");
    root.hidden = true;
    root.classList.remove("url-screen--handoff");
    setClosing(false);
    return Promise.resolve();
  }

  root.classList.remove("url-screen--handoff");

  if (!root.classList.contains("url-screen--open")) {
    meshWash.setActive(false);
    root.hidden = true;
    return Promise.resolve();
  }

  setClosing(true);
  meshWash.setActive(false);
  root.classList.remove("url-screen--open");

  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      root.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(fallbackId);
      root.hidden = true;
      setClosing(false);
      resolve();
    };

    /** @param {TransitionEvent} event */
    const onTransitionEnd = (event) => {
      if (event.target === root && event.propertyName === "opacity") {
        finish();
      }
    };

    root.addEventListener("transitionend", onTransitionEnd);
    const fallbackId = window.setTimeout(finish, getFallbackMs());
  });
}
