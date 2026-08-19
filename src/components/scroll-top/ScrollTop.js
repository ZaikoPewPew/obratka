import { getStrings } from "../../i18n.js";
import scrollTopIconSvg from "../../assets/home/scroll-top.svg?raw";
import scrollTopGooSvg from "../../assets/home/scroll-top-goo.svg?raw";

/**
 * Стрелка «наверх» — inline SVG, чтобы currentColor наследовал цвет кнопки.
 * @returns {SVGElement}
 */
function createArrowIcon() {
  const wrap = document.createElement("span");
  wrap.innerHTML = scrollTopIconSvg.trim();
  const svg = wrap.firstElementChild;
  if (!(svg instanceof SVGElement)) {
    throw new Error("scroll-top.svg must be a root <svg>");
  }
  svg.classList.add("scroll-top__arrow");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  return svg;
}

/**
 * Липкий мост между кубиком и FAB — inline SVG, fill через currentColor.
 * @returns {HTMLSpanElement}
 */
function createGoo() {
  const wrap = document.createElement("span");
  wrap.className = "scroll-top__goo";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML = scrollTopGooSvg.trim();
  const svg = wrap.firstElementChild;
  if (!(svg instanceof SVGElement)) {
    throw new Error("scroll-top-goo.svg must be a root <svg>");
  }
  svg.classList.add("scroll-top__goo-svg");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  return wrap;
}

/**
 * Кубик «наверх» у FAB feedback: вылет влево при скролле вниз.
 *
 * @param {{ onActivate?: () => void }} [opts]
 * @returns {{
 *   root: HTMLButtonElement;
 *   syncCopy: () => void;
 *   syncFromScroller: (scroller: HTMLElement) => void;
 *   setVisible: (visible: boolean) => void;
 * }}
 */
export function createScrollTop({ onActivate } = {}) {
  const root = document.createElement("button");
  root.type = "button";
  root.className = "scroll-top";
  root.setAttribute("aria-hidden", "true");
  root.tabIndex = -1;
  root.append(createArrowIcon(), createGoo());

  let visible = false;

  function applyVisible() {
    root.classList.toggle("scroll-top--visible", visible);
    root.setAttribute("aria-hidden", visible ? "false" : "true");
    root.tabIndex = visible ? 0 : -1;
    root.inert = !visible;
  }

  /**
   * @param {boolean} next
   */
  function setVisible(next) {
    if (visible === next) return;
    visible = next;
    applyVisible();
  }

  /**
   * @param {HTMLElement} scroller
   */
  function syncFromScroller(scroller) {
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    if (maxScroll <= 0) setVisible(false);
  }

  function syncCopy() {
    const t = getStrings();
    const label = t.homeScrollTopAria ?? "";
    root.setAttribute("aria-label", label);
  }

  root.addEventListener("click", () => {
    if (!visible) return;
    onActivate?.();
  });

  applyVisible();
  syncCopy();

  return { root, syncCopy, syncFromScroller, setVisible };
}
