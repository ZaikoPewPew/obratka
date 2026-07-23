import { getStrings } from "../../i18n.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import {
  normalizeSuccessPreset,
  SUCCESS_PRESETS,
} from "./successPresets.js";

/**
 * @typedef {import("./successPresets.js").SuccessPresetId} SuccessPresetId
 */

const BRAND_MARK_SVG = `
  <svg class="success-screen__brand-mark" width="44" height="30" viewBox="0 0 44 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14.6249 30C11.6748 30 9.10235 29.4585 6.90772 28.3755C4.71308 27.2924 3.00414 25.7762 1.7809 23.8267C0.593632 21.8773 0 19.5848 0 16.9495C0 13.7004 0.755531 10.8123 2.26659 8.2852C3.77766 5.72202 5.84637 3.70036 8.47274 2.22022C11.1351 0.740072 14.1572 0 17.5391 0C20.5253 0 23.0977 0.541516 25.2563 1.62455C27.451 2.70758 29.1419 4.22383 30.3292 6.17328C31.5524 8.08664 32.1641 10.3791 32.1641 13.0505C32.1641 16.2635 31.4085 19.1516 29.8975 21.7148C28.3864 24.278 26.3177 26.2996 23.6913 27.7798C21.0649 29.2599 18.0428 30 14.6249 30ZM15.1646 23.0686C16.8196 23.0686 18.2767 22.6715 19.5359 21.8773C20.8311 21.0469 21.8385 19.9097 22.558 18.4657C23.2776 17.0217 23.6373 15.343 23.6373 13.4296C23.6373 11.4801 23.0617 9.90975 21.9104 8.71841C20.7591 7.52708 19.1401 6.93141 17.0534 6.93141C15.3984 6.93141 13.9234 7.34657 12.6282 8.1769C11.3689 8.97112 10.3616 10.0903 9.60604 11.5343C8.88649 12.9783 8.52671 14.657 8.52671 16.5704C8.52671 18.556 9.10235 20.1444 10.2536 21.3357C11.4049 22.491 13.0419 23.0686 15.1646 23.0686Z" fill="white"/>
    <path d="M38.4415 30C37.0023 30 35.8151 29.5487 34.8797 28.6462C33.9442 27.7076 33.4765 26.5343 33.4765 25.1264C33.4765 23.4296 34.0162 22.0758 35.0955 21.065C36.2108 20.0181 37.542 19.4946 39.089 19.4946C40.5282 19.4946 41.6974 19.9458 42.5969 20.8484C43.5323 21.7509 44 22.9242 44 24.3682C44 25.4874 43.7302 26.4801 43.1905 27.3466C42.6868 28.1769 42.0212 28.8267 41.1937 29.296C40.3663 29.7653 39.4488 30 38.4415 30Z" fill="white"/>
  </svg>
`;

/**
 * Экран успеха после подачи портфолио: тайтл + кнопка «Выйти», справа зелёный mesh.
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
