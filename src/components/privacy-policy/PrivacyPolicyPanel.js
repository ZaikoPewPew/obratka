import { getPrivacyPolicyHtml } from "../../i18n.js";

/** Та же иконка закрытия, что в `AccessModal.js` */
const CLOSE_SVG = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M4.70605 4.70605L14.1178 14.1178M14.1178 4.70605L4.70605 14.1178" stroke="#242426" stroke-width="1.01961" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const PANEL_CLOSE_FALLBACK_MS = 400;

/**
 * @param {object} t
 * @param {string} locale
 * @returns {{ open: () => void; close: () => void; backdrop: HTMLDivElement }}
 */
function buildPrivacyPolicyPanel(t, locale) {
  const backdrop = document.createElement("div");
  backdrop.className = "privacy-panel__backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  if ("inert" in backdrop) {
    backdrop.inert = true;
  }

  const panel = document.createElement("div");
  panel.className = "privacy-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "privacy-panel-title");

  const header = document.createElement("div");
  header.className = "privacy-panel__header";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "access-modal__close";
  closeBtn.setAttribute("aria-label", t.accessModalCloseAria);
  closeBtn.innerHTML = CLOSE_SVG;

  const title = document.createElement("h2");
  title.id = "privacy-panel-title";
  title.className = "privacy-panel__title";
  title.textContent = t.privacyPolicyTitle;

  header.append(closeBtn, title);

  const body = document.createElement("div");
  body.className = "privacy-panel__body";

  panel.append(header, body);
  backdrop.append(panel);

  let lastFocus = null;
  let onKeyDown = null;
  let closing = false;

  function teardownAfterClose() {
    document.body.style.overflow = "";
    if (onKeyDown) {
      document.removeEventListener("keydown", onKeyDown);
      onKeyDown = null;
    }
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
    closing = false;
  }

  function close() {
    if (!backdrop.classList.contains("privacy-panel__backdrop--open") || closing) {
      return;
    }
    closing = true;
    if (onKeyDown) {
      document.removeEventListener("keydown", onKeyDown);
      onKeyDown = null;
    }
    backdrop.classList.remove("privacy-panel__backdrop--open");
    backdrop.setAttribute("aria-hidden", "true");
    if ("inert" in backdrop) {
      backdrop.inert = true;
    }

    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      backdrop.removeEventListener("transitionend", onTransitionEnd);
      clearTimeout(fallbackId);
      teardownAfterClose();
    };

    const onTransitionEnd = (e) => {
      if (e.target === backdrop && e.propertyName === "opacity") {
        finish();
      }
    };

    backdrop.addEventListener("transitionend", onTransitionEnd);
    const fallbackId = window.setTimeout(finish, PANEL_CLOSE_FALLBACK_MS);
  }

  function open() {
    if (backdrop.classList.contains("privacy-panel__backdrop--open") || closing) {
      return;
    }

    body.innerHTML = getPrivacyPolicyHtml(locale);
    title.textContent = t.privacyPolicyTitle;

    lastFocus = document.activeElement;
    if ("inert" in backdrop) {
      backdrop.inert = false;
    }
    backdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backdrop.classList.add("privacy-panel__backdrop--open");
        closeBtn.focus();
      });
    });

    onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
  }

  closeBtn.addEventListener("click", () => close());
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      close();
    }
  });
  panel.addEventListener("click", (e) => e.stopPropagation());

  return { open, close, backdrop };
}

/**
 * @param {HTMLAnchorElement} trigger
 * @param {object} t
 * @param {string} locale
 */
export function attachPrivacyPolicyPanel(trigger, t, locale) {
  let panel = null;

  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    if (!panel) {
      panel = buildPrivacyPolicyPanel(t, locale);
      document.body.appendChild(panel.backdrop);
    }
    panel.open();
  });
}
