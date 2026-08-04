import { getStrings } from "../../i18n.js";
import { COMMUNITY_CONTACT_URL } from "../../config/contacts.js";

/**
 * Lottie-кепка вместо SVG-иконки (preview точки входа).
 * @returns {HTMLElement}
 */
function createFeedbackLottie() {
  const root = document.createElement("span");
  root.className = "feedback__lottie";
  root.setAttribute("aria-hidden", "true");

  void Promise.all([
    import("lottie-web"),
    import("../../assets/lottie/cap-lottie.json"),
  ])
    .then(([lottieMod, dataMod]) => {
      lottieMod.default.loadAnimation({
        container: root,
        renderer: "svg",
        loop: true,
        autoplay: true,
        animationData: dataMod.default ?? dataMod,
      });
    })
    .catch(() => {});

  return root;
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

  root.append(createFeedbackLottie(), tip);

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
