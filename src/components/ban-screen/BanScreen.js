import { getStrings } from "../../i18n.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import { banBrandMarkSvg } from "../../assets/brand/brandMarks.js";

/** Контакт админа сообщества (кнопка «Связаться»). */
export const BAN_CONTACT_URL = "https://t.me/ezzzz12345";

const BRAND_MARK_SVG = banBrandMarkSvg();

const TELEGRAM_ICON_SVG = `
<svg class="ban-screen__btn-icon ban-screen__btn-icon--telegram" width="29" height="28" viewBox="0 0 29 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M1.98628 12.0538C9.74232 8.10237 14.9142 5.49734 17.502 4.23871C24.8906 0.645084 26.4259 0.0208329 27.4266 0.000219782C27.6467 -0.00431385 28.1388 0.0594683 28.4576 0.361928C28.7267 0.61732 28.8008 0.962317 28.8362 1.20446C28.8717 1.44659 28.9158 1.99819 28.8807 2.4292C28.4803 7.3486 26.7478 19.2867 25.8664 24.7965C25.4935 27.1279 24.7591 27.9096 24.0482 27.9861C22.5032 28.1524 21.3299 26.7921 19.8335 25.6451C17.4919 23.8502 16.169 22.7328 13.896 20.9813C11.2693 18.9572 12.9721 17.8447 14.4691 16.0265C14.8609 15.5507 21.6683 8.31018 21.8001 7.65336C21.8165 7.57121 21.8318 7.265 21.6763 7.10332C21.5207 6.94163 21.2911 6.99692 21.1254 7.04089C20.8906 7.10322 17.1498 9.99446 9.90307 15.7146C8.84126 16.5672 7.87951 16.9826 7.01781 16.9608C6.06786 16.9368 4.24053 16.3328 2.8821 15.8164C1.21593 15.1831 -0.108312 14.8482 0.00699973 13.7727C0.0670611 13.2124 0.726821 12.6395 1.98628 12.0538Z" fill="currentColor" />
</svg>
`;


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
  contactBtn.innerHTML = TELEGRAM_ICON_SVG;

  const contactLabel = document.createElement("span");
  contactLabel.className = "ban-screen__btn-label";
  contactBtn.append(contactLabel);

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
    contactLabel.textContent = t.banContact ?? "";
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
