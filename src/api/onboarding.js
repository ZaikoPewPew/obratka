import { updateMyProfile } from "./profiles.js";

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
 * Пишет ответы онбординга в `public.profiles`.
 *
 * @param {Record<string, unknown>} answers
 * @returns {Promise<void>}
 */
export async function saveOnboardingAnswers(answers) {
  const role = typeof answers.role === "string" ? answers.role : null;
  const grade = typeof answers.grade === "string" ? answers.grade : null;
  const domains = asStringArray(/** @type {string | string[]} */ (answers.domain));
  const goals = asStringArray(/** @type {string | string[]} */ (answers.goal));

  await updateMyProfile({
    role,
    grade,
    domains,
    goals,
    onboarding: answers,
    onboarding_done: true,
  });
}
