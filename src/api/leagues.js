/**
 * Лиги матчинга ревью (тихий фильтр).
 * Источник правды на сервере: `grade_league` / `can_review_grades` в Supabase.
 *
 * | Лига | Grades                         |
 * |------|--------------------------------|
 * | 1    | junior, null/unknown           |
 * | 2    | middle                         |
 * | 3    | senior, lead, head             |
 *
 * Ревьюер видит / может ревьюить:
 * - junior (и null) → junior (и null)
 * - middle → junior, middle
 * - senior+ → middle, senior+
 *
 * UI для null/unknown — `gradeUndefined`, не подставляем «Junior».
 */

/** @typedef {1 | 2 | 3} LeagueId */

/** @type {Readonly<Record<string, LeagueId>>} */
export const GRADE_TO_LEAGUE = Object.freeze({
  junior: 1,
  middle: 2,
  senior: 3,
  lead: 3,
  head: 3,
});

/**
 * @param {string | null | undefined} grade
 * @returns {LeagueId}
 */
export function gradeToLeague(grade) {
  if (!grade || typeof grade !== "string") return 1;
  return GRADE_TO_LEAGUE[grade] ?? 1;
}

/**
 * Может ли ревьюер с данным грейдом ревьюить владельца портфолио.
 *
 * @param {string | null | undefined} reviewerGrade
 * @param {string | null | undefined} ownerGrade
 * @returns {boolean}
 */
export function canReviewGrades(reviewerGrade, ownerGrade) {
  const reviewerLeague = gradeToLeague(reviewerGrade);
  const ownerLeague = gradeToLeague(ownerGrade);
  if (reviewerLeague === 1) return ownerLeague === 1;
  if (reviewerLeague === 2) return ownerLeague === 1 || ownerLeague === 2;
  return ownerLeague === 2 || ownerLeague === 3;
}
