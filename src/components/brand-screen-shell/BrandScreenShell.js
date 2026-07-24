import { createBrandScreenVisual } from "../brand-screen-visual/BrandScreenVisual.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import {
  closeBrandScreen,
  openBrandScreen,
} from "../../utils/brandScreenTransition.js";

/**
 * Общий split-каркас: левый слот + правый brand visual (эталон — UrlScreen).
 * Open/close + handoff — через brandScreenTransition (классы url-screen).
 *
 * @param {{
 *   labelledById: string;
 *   content: HTMLElement;
 *   rootClassName?: string;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: (opts?: { handoff?: boolean }) => void;
 *   close: (opts?: { handoff?: boolean }) => Promise<void>;
 *   setContent: (el: HTMLElement) => void;
 *   getVisualRoot: () => HTMLElement;
 *   getBrandVisual: () => ReturnType<typeof createBrandScreenVisual>;
 *   setVariant: (variant: "default" | "invalid" | "done") => void;
 *   meshWash: ReturnType<typeof createBrandScreenVisual>["meshWash"];
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

  const brandVisual = createBrandScreenVisual({
    classPrefix: rootClassName,
    markClassName: `${rootClassName}__brand-mark`,
    markPending: true,
  });
  brandVisual.bindScreenRoot(root);
  const { meshWash } = brandVisual;

  layout.append(formPane, brandVisual.root);
  root.append(layout);

  let closing = false;

  function setContent(el) {
    formPane.replaceChildren(el);
  }

  /**
   * @param {{ handoff?: boolean }} [opts]
   */
  function open(opts = {}) {
    closing = false;
    openBrandScreen({ root, meshWash, opts });
  }

  /**
   * @param {{ handoff?: boolean }} [opts]
   * @returns {Promise<void>}
   */
  function close(opts = {}) {
    return closeBrandScreen({
      root,
      meshWash,
      opts,
      isClosing: () => closing,
      setClosing: (value) => {
        closing = value;
      },
      getFallbackMs: getScreenCloseFallbackMs,
    });
  }

  return {
    root,
    open,
    close,
    setContent,
    getVisualRoot: () => brandVisual.root,
    getBrandVisual: () => brandVisual,
    setVariant: (variant) => brandVisual.setVariant(variant),
    meshWash,
  };
}
