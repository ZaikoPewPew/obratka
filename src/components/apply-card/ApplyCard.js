import { getFounderAvatarSourcesForPage } from "../../i18n.js";
import { attachAccessModalToCta } from "../access-modal/AccessModal.js";
import { createCtaButton } from "../cta-button/CtaButton.js";
import { createDividerOr } from "../divider-or/DividerOr.js";
import { createEmailField } from "../email-field/EmailField.js";
import { getFormattedDisplayCount } from "../../config.js";
import { fillCountTemplate } from "../../utils/countTemplate.js";

function ctaWithPrice(t, mobile) {
  const template = mobile ? (t.ctaPrimaryMobile ?? t.ctaPrimary) : t.ctaPrimary;
  const price = t.ctaAccessPrice ?? "";
  return String(template).replace(/\{price\}/g, price);
}

/**
 * Двухстрочный текст CTA: основной заголовок + спокойная вторичная подпись.
 * @param {HTMLButtonElement} cta
 * @param {string} mainText
 * @param {string} subText
 */
function setCtaText(cta, mainText, subText) {
  cta.textContent = "";
  const main = document.createElement("span");
  main.className = "apply-card__cta-main";
  main.textContent = mainText;
  cta.append(main);

  const secondary = String(subText || "").trim();
  if (!secondary) {
    return;
  }
  const sub = document.createElement("span");
  sub.className = "apply-card__cta-sub";
  sub.textContent = secondary;
  cta.append(sub);
}

/**
 * Центральный блок заявки (ширина — `styles/apply.css` `--apply-card-width`, min-height 398).
 * @param {object} opts
 * @param {{ applyTitle: string; applySubtitle: string; ctaPrimary: string; dividerOr: string; emailPlaceholder: string; emailInvalidCaption: string; foundersWaiting: string; emailSubmitAria: string }} opts.t
 * @param {string} opts.locale
 * @param {string} [opts.modifier]
 * @returns {HTMLDivElement}
 */
export function createApplyCard({ t, locale, modifier = "" }) {
  const card = document.createElement("div");
  card.className = modifier ? `apply-card ${modifier}` : "apply-card";

  const title = document.createElement("h1");
  title.className = "apply-card__title";
  fillCountTemplate(title, t.applyTitle, getFormattedDisplayCount(locale));

  const subtitle = document.createElement("p");
  subtitle.className = "apply-card__subtitle";
  subtitle.textContent = t.applySubtitle;

  const cta = createCtaButton({
    text: ctaWithPrice(t, false),
    className: "apply-card__cta",
  });
  setCtaText(cta, ctaWithPrice(t, false), String(t.ctaSecondary || ""));

  const divider = createDividerOr({
    text: t.dividerOr,
    className: "apply-card__divider divider-or",
  });

  const emailBlock = createEmailField({
    placeholder: t.emailPlaceholder,
    foundersText: t.foundersWaiting,
    submitAria: t.emailSubmitAria,
    invalidCaption: t.emailInvalidCaption,
    className: "apply-card__email email-field-block",
    avatarSources: getFounderAvatarSourcesForPage(),
  });

  attachAccessModalToCta(cta, t, locale);

  card.append(title, subtitle, cta, divider, emailBlock);
  return card;
}

/**
 * Мобилка: только заголовок + подзаголовок.
 */
export function createApplyCardHero({ t, locale }) {
  const card = document.createElement("div");
  card.className = "apply-card apply-card--mobile apply-card--hero";

  const title = document.createElement("h1");
  title.className = "apply-card__title";
  fillCountTemplate(title, t.applyTitle, getFormattedDisplayCount(locale));

  const subtitle = document.createElement("p");
  subtitle.className = "apply-card__subtitle";
  subtitle.textContent = t.applySubtitle;

  card.append(title, subtitle);
  return card;
}

/**
 * Мобилка: CTA, разделитель, email (нижний блок у края экрана).
 * CTA открывает ту же модалку «Полный доступ», что и на десктопе.
 */
export function createApplyCardForm({ t, locale }) {
  const wrap = document.createElement("div");
  wrap.className = "mobile-apply-form";

  const cta = createCtaButton({
    text: ctaWithPrice(t, true),
    className: "apply-card__cta",
  });
  setCtaText(cta, ctaWithPrice(t, true), String(t.ctaSecondary || ""));

  attachAccessModalToCta(cta, t, locale);

  const divider = createDividerOr({
    text: t.dividerOr,
    className: "apply-card__divider divider-or",
  });

  const emailBlock = createEmailField({
    placeholder: t.emailPlaceholder,
    foundersText: t.foundersWaiting,
    submitAria: t.emailSubmitAria,
    invalidCaption: t.emailInvalidCaption,
    className: "apply-card__email email-field-block",
    avatarCount: 2,
    avatarSources: getFounderAvatarSourcesForPage(),
  });

  wrap.append(cta, divider, emailBlock);
  return wrap;
}
