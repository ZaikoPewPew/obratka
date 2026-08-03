import { updateMyProfile } from "./profiles.js";

/** Пока шаг specialization скрыт — все катаем как product. */
export const DEFAULT_ONBOARDING_ROLE = "product-designer";

/**
 * @param {string | string[] | undefined} value
 * @returns {string[]}
 */
function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string" && value) return [value];
  return [];
}

/**
 * Нормализует ответы: без `role` подставляет DEFAULT_ONBOARDING_ROLE.
 *
 * @param {Record<string, unknown>} answers
 * @returns {Record<string, unknown> & { role: string }}
 */
export function normalizeOnboardingAnswers(answers) {
  const role =
    typeof answers.role === "string" && answers.role
      ? answers.role
      : DEFAULT_ONBOARDING_ROLE;
  return { ...answers, role };
}

/**
 * Пишет ответы онбординга в `public.profiles`.
 *
 * @param {Record<string, unknown>} answers
 * @returns {Promise<Record<string, unknown> & { role: string }>}
 */
export async function saveOnboardingAnswers(answers) {
  const payload = normalizeOnboardingAnswers(answers);
  const grade = typeof payload.grade === "string" ? payload.grade : null;
  const domains = asStringArray(/** @type {string | string[]} */ (payload.domain));
  const goals = asStringArray(/** @type {string | string[]} */ (payload.goal));

  /** Видео-шаг не пишем в профиль. */
  const { watch: _watch, ...onboardingPayload } = payload;

  await updateMyProfile({
    role: payload.role,
    grade,
    domains,
    goals,
    onboarding: onboardingPayload,
    onboarding_done: true,
  });
  return onboardingPayload;
}
