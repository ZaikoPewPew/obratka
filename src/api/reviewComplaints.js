import { getSupabase } from "../lib/supabaseClient.js";
import { getSession, setSession } from "../app/session.js";

/** @typedef {'low_effort' | 'spam' | 'harassment' | 'offensive' | 'irrelevant'} ReviewComplaintTag */

/** Теги жалобы v1 (веса только на сервере). */
export const REVIEW_COMPLAINT_TAGS = /** @type {const} */ ([
  "low_effort",
  "spam",
  "harassment",
  "offensive",
  "irrelevant",
]);

/** Стартовое значение, если в сессии/профиле ещё нет поля. */
export const REPUTATION_DEFAULT = 100;

/**
 * @typedef {{
 *   id: string;
 *   portfolioId: string;
 *   reviewerId: string;
 *   reviewerDisplayName: string | null;
 *   reviewerAvatarUrl: string | null;
 *   createdAt: string | null;
 *   complained: boolean;
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
 * @returns {number}
 */
export function getReputation() {
  const session = getSession();
  const value = session?.reputation;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : REPUTATION_DEFAULT;
}

/**
 * @param {number} next
 * @returns {number}
 */
export function writeReputationLocal(next) {
  const value = Math.max(0, Math.floor(next));
  const session = getSession() ?? {};
  setSession({ ...session, reputation: value });
  return value;
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
    "invalid_tag",
    "review_not_found",
    "portfolio_not_found",
    "not_portfolio_owner",
    "cannot_complain_own_review",
    "complaint_already_exists",
    "reviewer_profile_not_found",
  ];
  for (const code of codes) {
    if (raw.includes(code)) return code;
  }
  return "complaint_failed";
}

/**
 * Листы ревью портфолио для автора (+ флаг «уже жаловался»).
 *
 * @param {string} portfolioId
 * @returns {Promise<PortfolioReviewSheet[]>}
 */
export async function listPortfolioReviewSheets(portfolioId) {
  const supabase = getSupabase();
  if (!supabase || !portfolioId) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data: rows, error } = await supabase
    .from("reviews")
    .select(
      "id, portfolio_id, reviewer_id, reviewer_avatar_url, reviewer_display_name, created_at",
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

  return (rows || [])
    .map((row) => {
      if (!row || typeof row.id !== "string") return null;
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
        createdAt:
          typeof row.created_at === "string" ? row.created_at : null,
        complained: complainedIds.has(row.id),
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
