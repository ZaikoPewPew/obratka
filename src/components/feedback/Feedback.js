import { getStrings } from "../../i18n.js";
import { COMMUNITY_CONTACT_URL } from "../../config/contacts.js";
import feedbackIconSvg from "../../assets/home/feedback.svg?raw";

/**
 * Иконка feedback — inline SVG, чтобы `currentColor` наследовал цвет кнопки.
 * @returns {SVGElement}
 */
function createFeedbackIcon() {
  const wrap = document.createElement("span");
  wrap.innerHTML = feedbackIconSvg.trim();
  const svg = wrap.firstElementChild;
  if (!(svg instanceof SVGElement)) {
    throw new Error("feedback.svg must be a root <svg>");
  }
  svg.classList.add("feedback__icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  return svg;
}

/**
 * Fixed FAB feedback — Telegram админа (`COMMUNITY_CONTACT_URL`).
 *
 * @param {{ href?: string }} [opts]
 * @returns {{
 *   root: HTMLAnchorElement;
 *   syncCopy: () => void;
 * }}
 */
export function createFeedback({ href = COMMUNITY_CONTACT_URL } = {}) {
  const root = document.createElement("a");
  root.className = "feedback";
  root.href = href;
  root.target = "_blank";
  root.rel = "noopener noreferrer";

  const tip = document.createElement("span");
  tip.className = "feedback__tip";
  tip.setAttribute("aria-hidden", "true");

  root.append(createFeedbackIcon(), tip);

  function syncCopy() {
    const t = getStrings();
    const label = t.homeFeedbackAria ?? "";
    const tooltip = t.homeFeedbackTooltip ?? "";
    root.setAttribute("aria-label", label);
    root.title = tooltip;
    tip.textContent = tooltip;
  }

  syncCopy();

  return { root, syncCopy };
}
