import { getStrings } from "../../i18n.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import {
  normalizeSuccessPreset,
  SUCCESS_PRESETS,
} from "./successPresets.js";

/**
 * @typedef {import("./successPresets.js").SuccessPresetId} SuccessPresetId
 */

/**
 * Универсальный экран успеха с пресетами копирайта и CTA.
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
    "iframe-shell__btn success-screen__btn success-screen__btn--primary";

  const secondaryBtn = document.createElement("button");
  secondaryBtn.type = "button";
  secondaryBtn.className =
    "iframe-shell__btn success-screen__btn success-screen__btn--secondary";
  secondaryBtn.hidden = true;

  actions.append(primaryBtn, secondaryBtn);
  card.append(title, body, actions);
  root.append(card);

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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("success-screen--open");
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
      root.hidden = true;
      return Promise.resolve();
    }

    closing = true;
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
        if (event.target === root) finish();
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
