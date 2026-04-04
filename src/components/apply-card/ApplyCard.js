import { getFounderAvatarSourcesForPage } from "../../i18n.js";
import { attachAccessModalToCta } from "../access-modal/AccessModal.js";
import { createCtaButton } from "../cta-button/CtaButton.js";
import { createDividerOr } from "../divider-or/DividerOr.js";
import { createEmailField } from "../email-field/EmailField.js";
import { fillCountTemplate, getFormattedStartupCount } from "../startup-count/startupCount.js";

function ctaWithPrice(t, mobile) {
  const template = mobile ? (t.ctaPrimaryMobile ?? t.ctaPrimary) : t.ctaPrimary;
  const price = t.ctaAccessPrice ?? "";
  return String(template).replace(/\{price\}/g, price);
}

/**
 * Центральный блок заявки (530×398 по макету).
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
  fillCountTemplate(title, t.applyTitle, getFormattedStartupCount(locale));

  const subtitle = document.createElement("p");
  subtitle.className = "apply-card__subtitle";
  subtitle.textContent = t.applySubtitle;

  const cta = createCtaButton({
    text: ctaWithPrice(t, false),
    className: "apply-card__cta",
  });

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
 * Мобилка: только заголовок + подзаголовок (барьер для Matter.js остаётся в `.apply-card`).
 */
export function createApplyCardHero({ t, locale }) {
  const card = document.createElement("div");
  card.className = "apply-card apply-card--mobile apply-card--hero";

  const title = document.createElement("h1");
  title.className = "apply-card__title";
  fillCountTemplate(title, t.applyTitle, getFormattedStartupCount(locale));

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
