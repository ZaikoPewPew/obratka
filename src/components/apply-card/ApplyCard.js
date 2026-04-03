import { createCtaButton } from "../cta-button/CtaButton.js";
import { createDividerOr } from "../divider-or/DividerOr.js";
import { createEmailField } from "../email-field/EmailField.js";

/**
 * Центральный блок заявки (530×398 по макету).
 * @param {object} opts
 * @param {{ applyTitle: string; applySubtitle: string; ctaPrimary: string; dividerOr: string; emailPlaceholder: string; emailInvalidHint: string; foundersWaiting: string; emailSubmitAria: string }} opts.t
 * @param {string} [opts.modifier]
 * @returns {HTMLDivElement}
 */
export function createApplyCard({ t, modifier = "" }) {
  const card = document.createElement("div");
  card.className = modifier ? `apply-card ${modifier}` : "apply-card";

  const title = document.createElement("h1");
  title.className = "apply-card__title";
  title.textContent = t.applyTitle;

  const subtitle = document.createElement("p");
  subtitle.className = "apply-card__subtitle";
  subtitle.textContent = t.applySubtitle;

  const cta = createCtaButton({
    text: t.ctaPrimary,
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
    invalidEmailMessage: t.emailInvalidHint,
    className: "apply-card__email email-field-block",
  });

  card.append(title, subtitle, cta, divider, emailBlock);
  return card;
}
