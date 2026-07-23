/**
 * Пресеты экрана успеха.
 *
 * @typedef {'quizComplete' | 'portfolioSubmitted' | 'generic'} SuccessPresetId
 *
 * @typedef {{
 *   id: SuccessPresetId;
 *   titleKey: string;
 *   bodyKey?: string;
 *   primaryKey: string;
 *   secondaryKey?: string;
 * }} SuccessPreset
 */

/** @type {Readonly<Record<SuccessPresetId, SuccessPreset>>} */
export const SUCCESS_PRESETS = Object.freeze({
  quizComplete: Object.freeze({
    id: "quizComplete",
    titleKey: "successQuizTitle",
    primaryKey: "successQuizPrimary",
    secondaryKey: "successQuizSecondary",
  }),
  portfolioSubmitted: Object.freeze({
    id: "portfolioSubmitted",
    titleKey: "successPortfolioTitle",
    bodyKey: "successPortfolioBody",
    primaryKey: "successPortfolioPrimary",
  }),
  generic: Object.freeze({
    id: "generic",
    titleKey: "successGenericTitle",
    bodyKey: "successGenericBody",
    primaryKey: "successGenericPrimary",
  }),
});

/** @type {readonly SuccessPresetId[]} */
export const SUCCESS_PRESET_IDS = Object.freeze(
  /** @type {SuccessPresetId[]} */ (Object.keys(SUCCESS_PRESETS)),
);

/**
 * @param {string | null | undefined} id
 * @returns {SuccessPresetId}
 */
export function normalizeSuccessPreset(id) {
  if (id && id in SUCCESS_PRESETS) {
    return /** @type {SuccessPresetId} */ (id);
  }
  return "generic";
}
