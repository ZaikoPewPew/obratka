import { getFounderAvatarSourcesForPage } from "../../i18n.js";
import { createEmailField } from "../email-field/EmailField.js";
import { fillCountTemplate, getFormattedStartupCount } from "../startup-count/startupCount.js";

const CLOSE_SVG = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M4.70605 4.70605L14.1178 14.1178M14.1178 4.70605L4.70605 14.1178" stroke="#242426" stroke-width="1.01961" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const ICON_EARLY = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M12 15H12.0784C14.2443 15 16 13.2443 16 11.0784V11M12 15H11.9216C9.75575 15 8 13.2443 8 11.0784V11M12 15V20M12 20H16M12 20H8M8 6V4H16V6M8 6H5.56863C4.7023 6 4 6.7023 4 7.56863V8.77525C4 9.49505 4.48988 10.1225 5.18818 10.297L8 11M8 6V11M16 11L18.8118 10.297C19.5101 10.1225 20 9.49505 20 8.77525V7.56863C20 6.7023 19.2977 6 18.4314 6H16M16 11V6" stroke="#242426" stroke-width="1.01961" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const ICON_FOLDER = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M3 8V18.4314C3 19.2977 3.7023 20 4.56863 20H18M15.5 6L13.9594 4.45944C13.6653 4.16527 13.2663 4 12.8503 4L8.56863 4C7.7023 4 7 4.7023 7 5.56863V14.4314C7 15.2977 7.7023 16 8.56863 16H20.4314C21.2977 16 22 15.2977 22 14.4314V7.56863C22 6.7023 21.2977 6 20.4314 6H15.5Z" stroke="#242426" stroke-width="1.01961" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const ICON_FLAME = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M17.7266 8.74334C17.1215 9.52852 16.3455 10.0002 15.4995 10.0002C13.5665 10.0002 11.9995 7.5378 11.9995 4.50023C11.9995 4.01177 12.04 3.53818 12.1161 3.0873L11.9995 2.9707L6.74212 8.22806C3.83856 11.1316 3.83856 15.8392 6.74212 18.7428C9.64568 21.6463 14.3533 21.6463 17.2568 18.7428C19.9943 16.0053 20.1509 11.6643 17.7266 8.74334Z" stroke="#242426" stroke-width="1.01961" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M9.99951 16.0002L11.9995 14.0002L13.9995 16.0002C15.1041 17.1048 15.1041 18.8957 13.9995 20.0002C12.8949 21.1048 11.1041 21.1048 9.99951 20.0002C8.89494 18.8957 8.89494 17.1048 9.99951 16.0002Z" stroke="#242426" stroke-width="1.01961" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const ICON_SEARCH = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M13.3891 13.3891L19 19M9.5 15C12.5376 15 15 12.5376 15 9.5C15 6.46243 12.5376 4 9.5 4C6.46243 4 4 6.46243 4 9.5C4 12.5376 6.46243 15 9.5 15Z" stroke="#242426" stroke-width="1.01961" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/** Запас к длительности transition у `.access-modal__backdrop` (opacity) */
const MODAL_CLOSE_FALLBACK_MS = 400;

function createBenefitRow(iconHtml, titleEl, subtitleText) {
  const row = document.createElement("div");
  row.className = "access-modal__benefit";

  const iconWrap = document.createElement("div");
  iconWrap.className = "access-modal__benefit-icon";
  iconWrap.innerHTML = iconHtml;

  const textCol = document.createElement("div");
  textCol.className = "access-modal__benefit-text";

  const titleWrap = document.createElement("div");
  titleWrap.className = "access-modal__benefit-title";
  if (typeof titleEl === "string") {
    titleWrap.textContent = titleEl;
  } else {
    titleWrap.append(titleEl);
  }

  const sub = document.createElement("div");
  sub.className = "access-modal__benefit-sub";
  sub.textContent = subtitleText;

  textCol.append(titleWrap, sub);
  row.append(iconWrap, textCol);
  return row;
}

/**
 * @param {object} t
 * @param {string} locale
 * @returns {{ open: () => void; close: () => void; backdrop: HTMLDivElement }}
 */
function buildAccessModal(t, locale) {
  const backdrop = document.createElement("div");
  backdrop.className = "access-modal__backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  if ("inert" in backdrop) {
    backdrop.inert = true;
  }

  const panel = document.createElement("div");
  panel.className = "access-modal";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "access-modal-title");

  const header = document.createElement("div");
  header.className = "access-modal__header";

  const headText = document.createElement("div");
  headText.className = "access-modal__head-text";

  const title = document.createElement("h2");
  title.id = "access-modal-title";
  title.className = "access-modal__title";
  title.textContent = t.accessModalTitle;

  const headSub = document.createElement("p");
  headSub.className = "access-modal__subtitle";
  headSub.textContent = t.accessModalSubtitle;

  headText.append(title, headSub);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "access-modal__close";
  closeBtn.setAttribute("aria-label", t.accessModalCloseAria);
  closeBtn.innerHTML = CLOSE_SVG;

  header.append(headText, closeBtn);

  const body = document.createElement("div");
  body.className = "access-modal__body";

  const mediaPlaceholder = document.createElement("div");
  mediaPlaceholder.className = "access-modal__media-placeholder";
  mediaPlaceholder.setAttribute("aria-hidden", "true");

  const mediaVideo = document.createElement("video");
  mediaVideo.className = "access-modal__media-video";
  mediaVideo.src = "/video/video.mov";
  mediaVideo.autoplay = true;
  mediaVideo.muted = true;
  mediaVideo.loop = true;
  mediaVideo.playsInline = true;
  mediaVideo.preload = "metadata";
  mediaVideo.setAttribute("aria-hidden", "true");
  mediaPlaceholder.append(mediaVideo);

  const content = document.createElement("div");
  content.className = "access-modal__content";

  const benefits = document.createElement("div");
  benefits.className = "access-modal__benefits";

  const countFormatted = getFormattedStartupCount(locale);
  const row1 = createBenefitRow(ICON_FOLDER, "", t.accessModalBenefit1Subtitle);
  const benefit1Title = row1.querySelector(".access-modal__benefit-title");
  if (benefit1Title) {
    fillCountTemplate(benefit1Title, t.accessModalBenefit1Title, countFormatted);
  }

  benefits.append(
    row1,
    createBenefitRow(ICON_SEARCH, t.accessModalBenefit3Title, t.accessModalBenefit3Subtitle),
    createBenefitRow(ICON_FLAME, t.accessModalBenefit2Title, t.accessModalBenefit2Subtitle),
    createBenefitRow(ICON_EARLY, t.accessModalBenefitEarlyTitle, t.accessModalBenefitEarlySubtitle),
  );

  const emailBlock = createEmailField({
    placeholder: t.emailPlaceholder,
    foundersText: t.foundersWaiting,
    submitAria: t.emailSubmitAria,
    invalidCaption: t.emailInvalidCaption,
    className: "access-modal__email email-field-block email-field-block--compact",
    avatarCount: 4,
    avatarSources: getFounderAvatarSourcesForPage(),
  });

  const emailTitle = document.createElement("h3");
  emailTitle.className = "access-modal__email-title";
  emailTitle.textContent = t.accessModalEmailTitle || "Оставь свой email";

  const emailSection = document.createElement("div");
  emailSection.className = "access-modal__email-section";
  emailSection.append(emailTitle, emailBlock);

  content.append(benefits, emailSection);
  body.append(mediaPlaceholder, content);
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
    if (!backdrop.classList.contains("access-modal__backdrop--open") || closing) {
      return;
    }
    closing = true;
    if (onKeyDown) {
      document.removeEventListener("keydown", onKeyDown);
      onKeyDown = null;
    }
    backdrop.classList.remove("access-modal__backdrop--open");
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
    const fallbackId = window.setTimeout(finish, MODAL_CLOSE_FALLBACK_MS);
  }

  function open() {
    if (backdrop.classList.contains("access-modal__backdrop--open") || closing) {
      return;
    }

    lastFocus = document.activeElement;
    if ("inert" in backdrop) {
      backdrop.inert = false;
    }
    backdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backdrop.classList.add("access-modal__backdrop--open");
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
 * @param {HTMLButtonElement} cta
 * @param {object} t
 * @param {string} locale
 */
export function attachAccessModalToCta(cta, t, locale) {
  let modal = null;

  cta.addEventListener("click", () => {
    if (!modal) {
      modal = buildAccessModal(t, locale);
      document.body.appendChild(modal.backdrop);
    }
    modal.open();
  });
}
