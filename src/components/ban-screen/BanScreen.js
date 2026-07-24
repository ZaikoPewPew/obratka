import { getStrings } from "../../i18n.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import { banBrandMarkSvg } from "../../assets/brand/brandMarks.js";

/** Контакт админа сообщества (кнопка «Связаться»). */
export const BAN_CONTACT_URL = "https://t.me/ezzzz12345";

const BRAND_MARK_SVG = banBrandMarkSvg();


/**
 * Экран блокировки аккаунта: тайтл + «Выйти» / «Связаться», справа красный mesh.
 * Deep link / history не пускают в приложение; «Выйти» — выход из сессии наверх.
 *
 * @param {{
 *   onExit?: () => void | Promise<void>;
 * }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   open: () => void;
 *   close: () => Promise<void>;
 * }}
 */
export function createBanScreen(opts = {}) {
  const onExit = typeof opts.onExit === "function" ? opts.onExit : null;
  let closing = false;

  const root = document.createElement("section");
  root.className = "ban-screen";
  root.setAttribute("aria-labelledby", "ban-screen-title");
  root.hidden = true;

  const layout = document.createElement("div");
  layout.className = "ban-screen__layout";

  const panel = document.createElement("div");
  panel.className = "ban-screen__panel";

  const card = document.createElement("div");
  card.className = "ban-screen__card";

  const title = document.createElement("h1");
  title.className = "ban-screen__title";
  title.id = "ban-screen-title";

  const body = document.createElement("p");
  body.className = "ban-screen__body";

  const actions = document.createElement("div");
  actions.className = "ban-screen__actions";

  const exitBtn = document.createElement("button");
  exitBtn.type = "button";
  exitBtn.className = "iframe-shell__btn ban-screen__btn ban-screen__btn--exit";

  const contactBtn = document.createElement("button");
  contactBtn.type = "button";
  contactBtn.className = "iframe-shell__btn ban-screen__btn ban-screen__btn--contact";

  actions.append(exitBtn, contactBtn);
  card.append(title, body, actions);
  panel.append(card);

  const visual = document.createElement("div");
  visual.className = "ban-screen__visual";
  visual.setAttribute("aria-hidden", "true");

  const glow = document.createElement("div");
  glow.className = "ban-screen__glow";

  const noise = document.createElement("span");
  noise.className = "ban-screen__noise";

  const brand = document.createElement("div");
  brand.className = "ban-screen__brand";

  const brandSlot = document.createElement("div");
  brandSlot.className = "ban-screen__brand-slot";
  brandSlot.innerHTML = BRAND_MARK_SVG;
  brand.append(brandSlot);

  visual.append(glow, noise, brand);
  const meshWash = mountMeshGradientWash(glow);
  meshWash.setActive(false);

  layout.append(panel, visual);
  root.append(layout);

  function applyCopy() {
    const t = getStrings();
    title.textContent = t.banTitle ?? "";
    body.textContent = t.banBody ?? "";
    exitBtn.textContent = t.banExit ?? "";
    contactBtn.textContent = t.banContact ?? "";
  }

  function open() {
    closing = false;
    applyCopy();
    root.hidden = false;
    root.classList.remove("ban-screen--open");
    meshWash.refresh();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("ban-screen--open");
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

    if (!root.classList.contains("ban-screen--open")) {
      meshWash.setActive(false);
      root.hidden = true;
      return Promise.resolve();
    }

    closing = true;
    meshWash.setActive(false);
    root.classList.remove("ban-screen--open");

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

  contactBtn.addEventListener("click", () => {
    window.open(BAN_CONTACT_URL, "_blank", "noopener,noreferrer");
  });

  exitBtn.addEventListener("click", () => {
    void onExit?.();
  });

  return { root, open, close };
}
