import { getStrings } from "../../i18n.js";
import { COMMUNITY_CONTACT_URL } from "../../config/contacts.js";
import telegramIconSvg from "../../assets/home/telegram.svg?raw";

/**
 * Иконка Telegram — inline SVG, чтобы `currentColor` наследовал цвет кнопки.
 * @returns {SVGElement}
 */
function createTelegramIcon() {
  const wrap = document.createElement("span");
  wrap.innerHTML = telegramIconSvg.trim();
  const svg = wrap.firstElementChild;
  if (!(svg instanceof SVGElement)) {
    throw new Error("telegram.svg must be a root <svg>");
  }
  svg.classList.add("contact-fab__icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  return svg;
}

/**
 * Fixed FAB «быстрая связь» (Figma 478:1814) — Telegram админа.
 *
 * @param {{ href?: string }} [opts]
 * @returns {{
 *   root: HTMLAnchorElement;
 *   syncCopy: () => void;
 * }}
 */
export function createContactFab({ href = COMMUNITY_CONTACT_URL } = {}) {
  const root = document.createElement("a");
  root.className = "contact-fab";
  root.href = href;
  root.target = "_blank";
  root.rel = "noopener noreferrer";

  const tip = document.createElement("span");
  tip.className = "contact-fab__tip";
  tip.setAttribute("aria-hidden", "true");

  root.append(createTelegramIcon(), tip);

  function syncCopy() {
    const t = getStrings();
    const label = t.homeContactFabAria ?? "";
    const tooltip = t.homeContactFabTooltip ?? "";
    root.setAttribute("aria-label", label);
    root.title = tooltip;
    tip.textContent = tooltip;
  }

  syncCopy();

  return { root, syncCopy };
}
