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
 *   withBrandSlot?: boolean;
 *   markPending?: boolean;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: (opts?: { handoff?: boolean; prepare?: () => void }) => void;
 *   close: (opts?: { handoff?: boolean }) => Promise<void>;
 *   setContent: (el: HTMLElement) => void;
 *   getFormPane: () => HTMLElement;
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
  withBrandSlot = false,
  markPending = false,
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
    withBrandSlot,
    markPending,
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
   * @param {{ handoff?: boolean; prepare?: () => void }} [opts]
   */
  function open(opts = {}) {
    closing = false;
    const { prepare, ...transitionOpts } = opts;
    openBrandScreen({
      root,
      meshWash,
      opts: transitionOpts,
      prepare,
    });
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
    getFormPane: () => formPane,
    getVisualRoot: () => brandVisual.root,
    getBrandVisual: () => brandVisual,
    setVariant: (variant) => brandVisual.setVariant(variant),
    meshWash,
  };
}
