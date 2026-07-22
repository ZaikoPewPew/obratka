import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";

/** Запас к --url-screen-transition-duration / --brand-screen-transition-duration */
const CLOSE_FALLBACK_MS = 700;

/**
 * Общий split-каркас: левый слот + правый brand visual (эталон — UrlScreen).
 * Stub: разметка и open/close; стили пока завязаны на классы url-screen / будущий brand-screen.
 *
 * @param {{
 *   labelledById: string;
 *   content: HTMLElement;
 *   rootClassName?: string;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: () => void;
 *   close: () => Promise<void>;
 *   setContent: (el: HTMLElement) => void;
 *   getVisualRoot: () => HTMLElement;
 * }}
 */
export function createBrandScreenShell({
  labelledById,
  content,
  rootClassName = "brand-screen",
}) {
  const root = document.createElement("section");
  root.className = rootClassName;
  root.setAttribute("aria-labelledby", labelledById);
  root.hidden = true;

  const layout = document.createElement("div");
  layout.className = `${rootClassName}__layout`;

  const formPane = document.createElement("div");
  formPane.className = `${rootClassName}__form-pane`;
  formPane.append(content);

  const visual = document.createElement("div");
  visual.className = `${rootClassName}__visual`;
  visual.setAttribute("aria-hidden", "true");

  const glow = document.createElement("div");
  glow.className = `${rootClassName}__glow`;

  const noise = document.createElement("span");
  noise.className = `${rootClassName}__noise`;

  const brand = document.createElement("div");
  brand.className = `${rootClassName}__brand`;
  // Mark SVG подставляется при реализации (как в UrlScreen).
  brand.dataset.brandMark = "pending";

  visual.append(glow, noise, brand);
  const meshWash = mountMeshGradientWash(glow);
  meshWash.setActive(false);

  layout.append(formPane, visual);
  root.append(layout);

  let closing = false;

  function setContent(el) {
    formPane.replaceChildren(el);
  }

  function open() {
    closing = false;
    root.hidden = false;
    root.classList.remove(`${rootClassName}--open`);
    meshWash.refresh();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add(`${rootClassName}--open`);
        meshWash.setActive(true);
      });
    });
  }

  /**
   * @returns {Promise<void>}
   */
  function close() {
    if (root.hidden || closing) {
      return Promise.resolve();
    }

    if (!root.classList.contains(`${rootClassName}--open`)) {
      meshWash.setActive(false);
      root.hidden = true;
      return Promise.resolve();
    }

    closing = true;
    meshWash.setActive(false);
    root.classList.remove(`${rootClassName}--open`);

    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        root.removeEventListener("transitionend", onTransitionEnd);
        window.clearTimeout(fallbackId);
        root.hidden = true;
        closing = false;
        resolve();
      };

      /** @param {TransitionEvent} event */
      const onTransitionEnd = (event) => {
        if (event.target === root && event.propertyName === "opacity") {
          finish();
        }
      };

      root.addEventListener("transitionend", onTransitionEnd);
      const fallbackId = window.setTimeout(finish, CLOSE_FALLBACK_MS);
    });
  }

  return {
    root,
    open,
    close,
    setContent,
    getVisualRoot: () => visual,
  };
}
