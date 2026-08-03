import { getStrings } from "../../i18n.js";
import "../../../styles/desktop-only-screen.css";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import { brandMarkSvg } from "../../assets/brand/brandMarks.js";
import { fixHangingPrepositions } from "../../utils/hangingPrepositions.js";

const BRAND_MARK_SVG = brandMarkSvg("desktop-only-screen__brand-mark");

/**
 * Заглушка «только десктоп»: полный оверлей на узком viewport.
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
  root.setAttribute("aria-describedby", "desktop-only-screen-body");
  root.hidden = true;

  const layout = document.createElement("div");
  layout.className = "desktop-only-screen__layout";

  const visual = document.createElement("div");
  visual.className = "desktop-only-screen__visual";
  visual.setAttribute("aria-hidden", "true");

  const glow = document.createElement("div");
  glow.className = "desktop-only-screen__glow";

  const noise = document.createElement("span");
  noise.className = "desktop-only-screen__noise";

  const brand = document.createElement("div");
  brand.className = "desktop-only-screen__brand";

  const brandSlot = document.createElement("div");
  brandSlot.className = "desktop-only-screen__brand-slot";
  brandSlot.innerHTML = BRAND_MARK_SVG;
  brand.append(brandSlot);

  visual.append(glow, noise, brand);
  const meshWash = mountMeshGradientWash(glow);
  meshWash.setActive(false);

  const card = document.createElement("div");
  card.className = "desktop-only-screen__card";

  const title = document.createElement("h1");
  title.className = "desktop-only-screen__title";
  title.id = "desktop-only-screen-title";

  const body = document.createElement("p");
  body.className = "desktop-only-screen__body";
  body.id = "desktop-only-screen-body";

  card.append(title, body);
  layout.append(visual, card);
  root.append(layout);

  function applyCopy() {
    const t = getStrings();
    title.textContent = fixHangingPrepositions(t.desktopOnlyTitle ?? "");
    body.textContent = fixHangingPrepositions(t.desktopOnlyBody ?? "");
    if (t.metaTitleDesktopOnly) {
      document.title = t.metaTitleDesktopOnly;
    }
  }

  function open() {
    closing = false;
    applyCopy();
    root.hidden = false;
    root.classList.remove("desktop-only-screen--open");
    meshWash.refresh();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("desktop-only-screen--open");
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

    if (!root.classList.contains("desktop-only-screen--open")) {
      meshWash.setActive(false);
      root.hidden = true;
      return Promise.resolve();
    }

    closing = true;
    meshWash.setActive(false);
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
