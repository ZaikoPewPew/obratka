import { applyDocumentI18n, getStrings } from "../../i18n.js";
import "../../../styles/not-found-screen.css";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import { fixHangingPrepositions } from "../../utils/hangingPrepositions.js";

/**
 * SPA not-found: тайтл + кнопка «На главную» (роут решает `onHome` снаружи).
 *
 * @param {{
 *   onHome?: () => void | Promise<void>;
 * }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   open: () => void;
 *   close: () => Promise<void>;
 * }}
 */
export function createNotFoundScreen(opts = {}) {
  const onHome = typeof opts.onHome === "function" ? opts.onHome : null;
  let closing = false;

  const root = document.createElement("section");
  root.className = "not-found-screen";
  root.setAttribute("aria-labelledby", "not-found-screen-title");
  root.hidden = true;

  const inner = document.createElement("div");
  inner.className = "not-found-screen__inner";

  const title = document.createElement("h1");
  title.className = "not-found-screen__title";
  title.id = "not-found-screen-title";

  const cta = document.createElement("button");
  cta.type = "button";
  cta.className = "iframe-shell__btn not-found-screen__btn";

  inner.append(title, cta);
  root.append(inner);

  function applyCopy() {
    const t = getStrings();
    title.textContent = fixHangingPrepositions(t.notFoundTitle ?? "");
    cta.textContent = t.notFoundCta ?? "";
    if (t.metaTitleNotFound) {
      document.title = t.metaTitleNotFound;
    }
  }

  function open() {
    closing = false;
    applyCopy();
    root.hidden = false;
    root.classList.remove("not-found-screen--open");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("not-found-screen--open");
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

    if (!root.classList.contains("not-found-screen--open")) {
      root.hidden = true;
      applyDocumentI18n();
      return Promise.resolve();
    }

    closing = true;
    root.classList.remove("not-found-screen--open");

    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        root.removeEventListener("transitionend", onEnd);
        window.clearTimeout(fallbackId);
        root.hidden = true;
        closing = false;
        applyDocumentI18n();
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

  cta.addEventListener("click", () => {
    if (!onHome) return;
    void onHome();
  });

  return { root, open, close };
}
