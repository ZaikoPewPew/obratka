import { getStrings } from "../../i18n.js";
import "../../../styles/desktop-only-screen.css";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import { fixHangingPrepositions } from "../../utils/hangingPrepositions.js";

/**
 * Заглушка «только десктоп»: белый оверлей с короткой фразой по центру на узком viewport.
 * Не маршрут флоу — монтируется из `main.js` по matchMedia.
 *
 * @returns {{
 *   root: HTMLElement;
 *   open: () => void;
 *   close: () => Promise<void>;
 * }}
 */
export function createDesktopOnlyScreen() {
  let closing = false;

  const root = document.createElement("section");
  root.className = "desktop-only-screen";
  root.setAttribute("role", "alertdialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "desktop-only-screen-title");
  root.hidden = true;

  const title = document.createElement("p");
  title.className = "desktop-only-screen__title";
  title.id = "desktop-only-screen-title";
  root.append(title);

  function applyCopy() {
    const t = getStrings();
    title.textContent = fixHangingPrepositions(t.desktopOnlyTitle ?? "");
  }

  function open() {
    closing = false;
    applyCopy();
    root.hidden = false;
    root.classList.remove("desktop-only-screen--open");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("desktop-only-screen--open");
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

    if (!root.classList.contains("desktop-only-screen--open")) {
      root.hidden = true;
      return Promise.resolve();
    }

    closing = true;
    root.classList.remove("desktop-only-screen--open");

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

  return { root, open, close };
}
