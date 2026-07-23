import { getStrings } from "../../i18n.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";

/** Контакт админа сообщества (кнопка «Связаться»). */
export const BAN_CONTACT_URL = "https://t.me/ezzzz12345";

const BRAND_MARK_SVG = `
  <svg class="ban-screen__brand-mark" width="44" height="37" viewBox="0 0 44 37" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M2.65069 0.988146C1.6879 4.12991 1.61843 8.13208 2.47148 11.3188C2.73608 12.3069 2.95288 13.3175 2.95324 13.5645C2.9536 13.8116 2.66322 14.6605 2.30785 15.451L17 13.4512L31.8292 15.451C31.7002 15.167 31.5615 14.8862 31.4127 14.6082L30.9615 13.7652L31.4302 12.0929C32.2938 9.01045 32.4523 6.6743 32.0001 3.68309C31.8583 2.74435 31.6008 1.53971 31.4283 1.00629L31.1144 0.0362912L30.9005 1.31064C30.4572 3.95025 29.3041 6.63836 27.7387 8.68059C26.9475 9.71293 24.6271 11.9476 24.3464 11.9476C24.1468 11.9476 24.1112 12.0389 24.9429 10.4204C25.9906 8.38199 23.9458 10.2137 22.5 9.45117C18.9111 7.55842 21.2353 8.40392 17.5 9.45117C16.3935 9.76145 12.8289 8.88667 12 9.45117C11.7902 9.594 8.73374 9.64395 9.84315 11.8128C10.0605 12.2379 9.42263 11.7916 8.21028 10.6705C5.42359 8.09363 3.86017 5.17142 3.17397 1.25764L2.9536 0L2.65069 0.988146Z" fill="white"/>
    <path d="M14.6249 36.9512C11.6748 36.9512 9.10235 36.4097 6.90772 35.3266C4.71308 34.2436 3.00414 32.7273 1.7809 30.7779C0.593632 28.8284 0 26.536 0 23.9006C0 20.6515 0.755531 17.7634 2.26659 15.2364C3.77766 12.6732 5.84637 10.6515 8.47274 9.17139C11.1351 7.69124 14.1572 6.95117 17.5391 6.95117C20.5253 6.95117 23.0977 7.49269 25.2563 8.57572C27.451 9.65875 29.1419 11.175 30.3292 13.1245C31.5524 15.0378 32.1641 17.3302 32.1641 20.0017C32.1641 23.2147 31.4085 26.1028 29.8975 28.666C28.3864 31.2291 26.3177 33.2508 23.6913 34.731C21.0649 36.2111 18.0428 36.9512 14.6249 36.9512ZM15.1646 30.0198C16.8196 30.0198 18.2767 29.6227 19.5359 28.8284C20.8311 27.9981 21.8385 26.8609 22.558 25.4169C23.2776 23.9728 23.6373 22.2941 23.6373 20.3808C23.6373 18.4313 23.0617 16.8609 21.9104 15.6696C20.7591 14.4782 19.1401 13.8826 17.0534 13.8826C15.3984 13.8826 13.9234 14.2977 12.6282 15.1281C11.3689 15.9223 10.3616 17.0414 9.60604 18.4855C8.88649 19.9295 8.52671 21.6082 8.52671 23.5216C8.52671 25.5071 9.10235 27.0956 10.2536 28.2869C11.4049 29.4421 13.0419 30.0198 15.1646 30.0198Z" fill="white"/>
    <path d="M38.4415 36.9512C37.0023 36.9512 35.8151 36.4999 34.8797 35.5974C33.9442 34.6588 33.4765 33.4855 33.4765 32.0775C33.4765 30.3808 34.0162 29.027 35.0955 28.0162C36.2108 26.9692 37.542 26.4458 39.0891 26.4458C40.5282 26.4458 41.6974 26.897 42.5969 27.7995C43.5323 28.7021 44 29.8754 44 31.3194C44 32.4385 43.7302 33.4313 43.1905 34.2977C42.6868 35.1281 42.0212 35.7779 41.1937 36.2472C40.3663 36.7165 39.4488 36.9512 38.4415 36.9512Z" fill="white"/>
  </svg>
`;

/**
 * Экран блокировки аккаунта: тайтл + подтайтл + «Связаться», справа красный mesh.
 * Из экрана нельзя уйти навигацией — только контакт с админом.
 *
 * @returns {{
 *   root: HTMLElement;
 *   open: () => void;
 *   close: () => Promise<void>;
 * }}
 */
export function createBanScreen() {
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

  const contactBtn = document.createElement("button");
  contactBtn.type = "button";
  contactBtn.className =
    "iframe-shell__btn ban-screen__btn ban-screen__btn--contact";

  actions.append(contactBtn);
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

  return { root, open, close };
}
