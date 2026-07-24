import { getStrings } from "../../i18n.js";
import { logoDoneMarkSvg } from "../../assets/brand/brandMarks.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import {
  normalizeSuccessPreset,
  SUCCESS_PRESETS,
} from "./successPresets.js";

/**
 * @typedef {import("./successPresets.js").SuccessPresetId} SuccessPresetId
 */

const BRAND_MARK_SVG = logoDoneMarkSvg("success-screen__brand-mark");


/**
 * Экран успеха после подачи портфолио: тайтл + кнопка «На главную», справа зелёный mesh.
 *
 * @param {{
 *   onPrimary?: (preset: SuccessPresetId) => void | Promise<void>;
 *   onSecondary?: (preset: SuccessPresetId) => void | Promise<void>;
 * }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   open: (opts?: { preset?: SuccessPresetId | string }) => void;
 *   close: () => Promise<void>;
 * }}
 */
export function createSuccessScreen(opts = {}) {
  const onPrimary =
    typeof opts.onPrimary === "function" ? opts.onPrimary : null;
  const onSecondary =
    typeof opts.onSecondary === "function" ? opts.onSecondary : null;

  /** @type {SuccessPresetId} */
  let activePreset = "generic";
  let closing = false;

  const root = document.createElement("section");
  root.className = "success-screen";
  root.setAttribute("aria-labelledby", "success-screen-title");
  root.hidden = true;

  const layout = document.createElement("div");
  layout.className = "success-screen__layout";

  const panel = document.createElement("div");
  panel.className = "success-screen__panel";

  const card = document.createElement("div");
  card.className = "success-screen__card";

  const title = document.createElement("h1");
  title.className = "success-screen__title";
  title.id = "success-screen-title";

  const body = document.createElement("p");
  body.className = "success-screen__body";
  body.hidden = true;

  const actions = document.createElement("div");
  actions.className = "success-screen__actions";

  const primaryBtn = document.createElement("button");
  primaryBtn.type = "button";
  primaryBtn.className =
    "iframe-shell__btn success-screen__btn success-screen__btn--exit";

  const secondaryBtn = document.createElement("button");
  secondaryBtn.type = "button";
  secondaryBtn.className =
    "iframe-shell__btn success-screen__btn success-screen__btn--secondary";
  secondaryBtn.hidden = true;

  actions.append(primaryBtn, secondaryBtn);
  card.append(title, body, actions);
  panel.append(card);

  const visual = document.createElement("div");
  visual.className = "success-screen__visual";
  visual.setAttribute("aria-hidden", "true");

  const glow = document.createElement("div");
  glow.className = "success-screen__glow";

  const noise = document.createElement("span");
  noise.className = "success-screen__noise";

  const brand = document.createElement("div");
  brand.className = "success-screen__brand";

  const brandSlot = document.createElement("div");
  brandSlot.className = "success-screen__brand-slot";
  brandSlot.innerHTML = BRAND_MARK_SVG;
  brand.append(brandSlot);

  visual.append(glow, noise, brand);
  const meshWash = mountMeshGradientWash(glow);
  meshWash.setActive(false);

  layout.append(panel, visual);
  root.append(layout);

  /**
   * @param {SuccessPresetId} presetId
   */
  function applyPreset(presetId) {
    const t = getStrings();
    const preset = SUCCESS_PRESETS[presetId];
    activePreset = presetId;
    root.dataset.preset = presetId;

    title.textContent = t[preset.titleKey] ?? "";

    if (preset.bodyKey && t[preset.bodyKey]) {
      body.textContent = t[preset.bodyKey];
      body.hidden = false;
    } else {
      body.textContent = "";
      body.hidden = true;
    }

    primaryBtn.textContent = t[preset.primaryKey] ?? "";

    if (preset.secondaryKey && t[preset.secondaryKey]) {
      secondaryBtn.textContent = t[preset.secondaryKey];
      secondaryBtn.hidden = false;
    } else {
      secondaryBtn.textContent = "";
      secondaryBtn.hidden = true;
    }
  }

  /**
   * @param {{ preset?: SuccessPresetId | string }} [openOpts]
   */
  function open(openOpts = {}) {
    closing = false;
    applyPreset(normalizeSuccessPreset(openOpts.preset));
    root.hidden = false;
    root.classList.remove("success-screen--open");
    meshWash.refresh();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("success-screen--open");
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

    if (!root.classList.contains("success-screen--open")) {
      meshWash.setActive(false);
      root.hidden = true;
      return Promise.resolve();
    }

    closing = true;
    meshWash.setActive(false);
    root.classList.remove("success-screen--open");

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
    void onPrimary?.(activePreset);
  });

  secondaryBtn.addEventListener("click", () => {
    void onSecondary?.(activePreset);
  });

  return { root, open, close };
}
