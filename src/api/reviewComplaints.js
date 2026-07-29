import { getSupabase } from "../lib/supabaseClient.js";
import { getSession, setSession } from "../app/session.js";
import { formatPortfolioRole } from "./portfolios.js";
import { parseReviewAnswers } from "../utils/reviewReport.js";

/** @typedef {'low_effort' | 'spam' | 'harassment' | 'offensive' | 'ai_slop'} ReviewComplaintTag */

/** Теги жалобы v1 (веса только на сервере). */
export const REVIEW_COMPLAINT_TAGS = /** @type {const} */ ([
  "low_effort",
  "spam",
  "harassment",
  "offensive",
  "ai_slop",
]);

/** Стартовое значение, если в сессии/профиле ещё нет поля. */
export const REPUTATION_DEFAULT = 20;

/** Пол шкалы / порог автобана (зеркало SQL `review_complaint_ban_threshold`). */
export const REPUTATION_FLOOR = -100;

/** Окно жалобы после submit ревью (зеркало SQL `review_complaint_window`). */
export const COMPLAINT_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * @typedef {{
 *   id: string;
 *   portfolioId: string;
 *   reviewerId: string;
 *   reviewerDisplayName: string | null;
 *   reviewerAvatarUrl: string | null;
 *   reviewerGrade: string | null;
 *   reviewerRole: string | null;
 *   createdAt: string | null;
 *   complained: boolean;
 *   canComplain: boolean;
 *   complaintOpenUntil: string | null;
 *   answers: import("../utils/reviewReport.js").ReviewAnswers | null;
 * }} PortfolioReviewSheet
 */

/**
 * @typedef {{
 *   ok: true;
 *   reviewId: string;
 *   tags: ReviewComplaintTag[];
 *   penalty: number;
 *   reviewerReputation: number;
 *   reviewerBanned: boolean;
 * }} SubmitReviewComplaintResult
 */

/**
 * EN Title Case должность ревьюера (как на карточке ленты).
 * @param {string | null | undefined} grade
 * @param {string | null | undefined} role
 * @returns {string}
 */
export function formatReviewerTitle(grade, role) {
  const g = typeof grade === "string" ? grade.trim() : "";
  const r = typeof role === "string" ? role.trim() : "";
  if (!g && !r) return "";
  return formatPortfolioRole(g || null, r || null);
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function clampReputation(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return REPUTATION_DEFAULT;
  }
  return Math.min(
    Number.MAX_SAFE_INTEGER,
    Math.max(REPUTATION_FLOOR, Math.trunc(value)),
  );
}

/**
 * @returns {number}
 */
export function getReputation() {
  const session = getSession();
  const value = session?.reputation;
  return typeof value === "number" && Number.isFinite(value)
    ? clampReputation(value)
    : REPUTATION_DEFAULT;
}

/**
 * Подпись чипа / title: абсолют со знаком (`+20` / `0` / `-40`).
 * @param {number} [reputation]
 * @returns {string}
 */
export function formatReputation(reputation = getReputation()) {
  const n = clampReputation(reputation);
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : String(n);
}

/**
 * @deprecated Используй formatReputation — чип теперь абсолют, не дельта.
 * @param {number} [reputation]
 * @returns {string}
 */
export function formatReputationDelta(reputation = getReputation()) {
  return formatReputation(reputation);
}

/**
 * @param {number} next
 * @returns {number}
 */
export function writeReputationLocal(next) {
  const value = clampReputation(next);
  const session = getSession() ?? {};
  setSession({ ...session, reputation: value });
  return value;
}

/**
 * Deadline окна жалобы (ISO) или null, если createdAt битый.
 * @param {string | null | undefined} createdAt
 * @returns {string | null}
 */
export function complaintOpenUntil(createdAt) {
  if (typeof createdAt !== "string" || !createdAt) return null;
  const start = Date.parse(createdAt);
  if (!Number.isFinite(start)) return null;
  return new Date(start + COMPLAINT_WINDOW_MS).toISOString();
}

/**
 * Можно ли ещё жаловаться на лист (клиентское зеркало окна 6ч).
 * @param {{ createdAt?: string | null; complained?: boolean }} sheet
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function canComplainAboutReview(sheet, nowMs = Date.now()) {
  if (!sheet || sheet.complained) return false;
  const until = complaintOpenUntil(sheet.createdAt);
  if (!until) return false;
  return nowMs <= Date.parse(until);
}

/**
 * @param {unknown} tag
 * @returns {tag is ReviewComplaintTag}
 */
export function isReviewComplaintTag(tag) {
  return (
    typeof tag === "string" &&
    REVIEW_COMPLAINT_TAGS.includes(/** @type {ReviewComplaintTag} */ (tag))
  );
}

/**
 * @param {string} message
 * @returns {string}
 */
function mapComplaintError(message) {
  const raw = String(message || "");
  const codes = [
    "not_authenticated",
    "reporter_banned",
    "review_required",
    "tags_required",
    "too_many_tags",
    "invalid_tag",
    "review_not_found",
    "portfolio_not_found",
    "not_portfolio_owner",
    "cannot_complain_own_review",
    "complaint_already_exists",
    "complaint_window_closed",
    "reviewer_profile_not_found",
  ];
  for (const code of codes) {
    if (raw.includes(code)) return code;
  }
  return "complaint_failed";
}

/**
 * Lazy +10 за чистые ревью после окна (идемпотентно).
 * @returns {Promise<void>}
 */
export async function settleReviewReputationRewards() {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.rpc("settle_review_reputation_rewards");
  if (error && import.meta.env.DEV) {
    console.warn("[reviewComplaints] settle", error.message);
  }
}

/**
 * Листы ревью портфолио для автора (+ флаг «уже жаловался» / окно жалобы).
 *
 * @param {string} portfolioId
 * @returns {Promise<PortfolioReviewSheet[]>}
 */
export async function listPortfolioReviewSheets(portfolioId) {
  const supabase = getSupabase();
  if (!supabase || !portfolioId) return [];

  await settleReviewReputationRewards();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data: rows, error } = await supabase
    .from("reviews")
    .select(
      "id, portfolio_id, reviewer_id, reviewer_avatar_url, reviewer_display_name, reviewer_grade, reviewer_role, created_at, answers",
    )
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: true });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[reviewComplaints] listPortfolioReviewSheets", error.message);
    }
    return [];
  }

  const reviewIds = (rows || [])
    .map((row) => (row && typeof row.id === "string" ? row.id : ""))
    .filter(Boolean);

  /** @type {Set<string>} */
  const complainedIds = new Set();
  if (reviewIds.length > 0) {
    const { data: complaints, error: complaintsError } = await supabase
      .from("review_complaints")
      .select("review_id")
      .eq("reporter_id", user.id)
      .in("review_id", reviewIds);

    if (complaintsError && import.meta.env.DEV) {
      console.warn(
        "[reviewComplaints] list complaints",
        complaintsError.message,
      );
    }
    for (const row of complaints || []) {
      if (row && typeof row.review_id === "string") {
        complainedIds.add(row.review_id);
      }
    }
  }

  const nowMs = Date.now();

  return (rows || [])
    .map((row) => {
      if (!row || typeof row.id !== "string") return null;
      const createdAt =
        typeof row.created_at === "string" ? row.created_at : null;
      const complained = complainedIds.has(row.id);
      const openUntil = complaintOpenUntil(createdAt);
      return {
        id: row.id,
        portfolioId:
          typeof row.portfolio_id === "string" ? row.portfolio_id : portfolioId,
        reviewerId:
          typeof row.reviewer_id === "string" ? row.reviewer_id : "",
        reviewerDisplayName:
          typeof row.reviewer_display_name === "string"
            ? row.reviewer_display_name
            : null,
        reviewerAvatarUrl:
          typeof row.reviewer_avatar_url === "string"
            ? row.reviewer_avatar_url
            : null,
        reviewerGrade:
          typeof row.reviewer_grade === "string" && row.reviewer_grade.trim()
            ? row.reviewer_grade.trim()
            : null,
        reviewerRole:
          typeof row.reviewer_role === "string" && row.reviewer_role.trim()
            ? row.reviewer_role.trim()
            : null,
        createdAt,
        complained,
        complaintOpenUntil: openUntil,
        canComplain: canComplainAboutReview({ createdAt, complained }, nowMs),
        answers: parseReviewAnswers(row.answers),
      };
    })
    .filter(Boolean);
}

/**
 * @param {string} reviewId
 * @param {ReviewComplaintTag[]} tags
 * @returns {Promise<SubmitReviewComplaintResult>}
 */
export async function submitReviewComplaint(reviewId, tags) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("not_configured");
  }

  const clean = [...new Set(tags.filter(isReviewComplaintTag))];
  if (!reviewId || clean.length === 0) {
    throw new Error("tags_required");
  }
  if (clean.length > 1) {
    throw new Error("too_many_tags");
  }

  const { data, error } = await supabase.rpc("submit_review_complaint", {
    p_review_id: reviewId,
    p_tags: clean,
  });

  if (error) {
    throw new Error(mapComplaintError(error.message));
  }

  const payload = data && typeof data === "object" ? data : {};
  return {
    ok: true,
    reviewId:
      typeof payload.review_id === "string" ? payload.review_id : reviewId,
    tags: Array.isArray(payload.tags)
      ? payload.tags.filter(isReviewComplaintTag)
      : clean,
    penalty:
      typeof payload.penalty === "number" && Number.isFinite(payload.penalty)
        ? payload.penalty
        : 0,
    reviewerReputation:
      typeof payload.reviewer_reputation === "number"
        ? payload.reviewer_reputation
        : 0,
    reviewerBanned: Boolean(payload.reviewer_banned),
  };
}
