import { getStrings } from "../../i18n.js";
import { logoDoneMarkSvg } from "../../assets/brand/brandMarks.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";

const BRAND_MARK_SVG = logoDoneMarkSvg("report-screen__brand-mark");

/**
 * Каркас отчёта для автора портфолио (дизайн как done/success).
 * Контент отчёта — позже; сейчас заглушка.
 *
 * @param {{
 *   onPrimary?: () => void | Promise<void>;
 * }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   open: (opts?: { portfolioId?: string | null }) => void;
 *   close: () => Promise<void>;
 *   getPortfolioId: () => string | null;
 * }}
 */
export function createReportScreen(opts = {}) {
  const onPrimary =
    typeof opts.onPrimary === "function" ? opts.onPrimary : null;

  /** @type {string | null} */
  let portfolioId = null;
  let closing = false;

  const root = document.createElement("section");
  root.className = "report-screen";
  root.setAttribute("aria-labelledby", "report-screen-title");
  root.hidden = true;

  const layout = document.createElement("div");
  layout.className = "report-screen__layout";

  const panel = document.createElement("div");
  panel.className = "report-screen__panel";

  const card = document.createElement("div");
  card.className = "report-screen__card";

  const title = document.createElement("h1");
  title.className = "report-screen__title";
  title.id = "report-screen-title";

  const body = document.createElement("p");
  body.className = "report-screen__body";

  const actions = document.createElement("div");
  actions.className = "report-screen__actions";

  const primaryBtn = document.createElement("button");
  primaryBtn.type = "button";
  primaryBtn.className =
    "iframe-shell__btn report-screen__btn report-screen__btn--exit";

  actions.append(primaryBtn);
  card.append(title, body, actions);
  panel.append(card);

  const visual = document.createElement("div");
  visual.className = "report-screen__visual";
  visual.setAttribute("aria-hidden", "true");

  const glow = document.createElement("div");
  glow.className = "report-screen__glow";

  const noise = document.createElement("span");
  noise.className = "report-screen__noise";

  const brand = document.createElement("div");
  brand.className = "report-screen__brand";

  const brandSlot = document.createElement("div");
  brandSlot.className = "report-screen__brand-slot";
  brandSlot.innerHTML = BRAND_MARK_SVG;
  brand.append(brandSlot);

  visual.append(glow, noise, brand);
  const meshWash = mountMeshGradientWash(glow);
  meshWash.setActive(false);

  layout.append(panel, visual);
  root.append(layout);

  function applyCopy() {
    const t = getStrings();
    title.textContent = t.reportScreenTitle ?? "";
    body.textContent = t.reportScreenBody ?? "";
    primaryBtn.textContent = t.reportScreenPrimary ?? "";
  }

  /**
   * @param {{ portfolioId?: string | null }} [openOpts]
   */
  function open(openOpts = {}) {
    closing = false;
    portfolioId =
      typeof openOpts.portfolioId === "string" && openOpts.portfolioId.trim()
        ? openOpts.portfolioId.trim()
        : null;
    applyCopy();
    root.hidden = false;
    root.classList.remove("report-screen--open");
    meshWash.refresh();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("report-screen--open");
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

    if (!root.classList.contains("report-screen--open")) {
      meshWash.setActive(false);
      root.hidden = true;
      return Promise.resolve();
    }

    closing = true;
    meshWash.setActive(false);
    root.classList.remove("report-screen--open");

    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        root.removeEventListener("transitionend", onEnd);
        window.clearTimeout(fallbackId);
        root.hidden = true;
        closing = false;
        resolve();
      };
      const onEnd = (event) => {
        if (event.target === root && event.propertyName === "opacity") {
          finish();
        }
      };
      root.addEventListener("transitionend", onEnd);
      const fallbackId = window.setTimeout(finish, getScreenCloseFallbackMs());
    });
  }

  primaryBtn.addEventListener("click", () => {
    void onPrimary?.();
  });

  return {
    root,
    open,
    close,
    getPortfolioId: () => portfolioId,
  };
}
