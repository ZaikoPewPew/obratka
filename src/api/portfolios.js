import { getSession } from "../app/session.js";
import { getStrings } from "../i18n.js";
import { getSupabase } from "../lib/supabaseClient.js";

/**
 * Очередь портфолио на ревью (Supabase) + свои карточки.
 * Матчинг лиг — RLS / `can_review_portfolio` (см. `leagues.js`).
 *
 * @typedef {{
 *   id: string;
 *   url: string;
 *   name?: string;
 *   role?: string;
 *   avatarUrl?: string;
 *   ownerId?: string;
 *   isOwn?: boolean;
 *   reviewsCount?: number;
 *   targetReviews?: number;
 *   status?: 'pending' | 'done' | 'skipped';
 * }} PortfolioQueueItem
 */

/** Целевое число ревьюеров для новой карточки. */
export const DEFAULT_TARGET_REVIEWS = 3;

/**
 * Подписи роли на карточке всегда на английском (Title Case),
 * независимо от UI-локали онбординга.
 *
 * @type {Readonly<Record<string, string>>}
 */
const ROLE_LABELS_EN = Object.freeze({
  "web-designer": "Web Designer",
  "product-designer": "Product Designer",
  "emotional-designer": "Emotional Designer",
  "ux-ui-designer": "UX / UI Designer",
  other: "Designer",
});

/** @type {Readonly<Record<string, string>>} */
const GRADE_LABELS_EN = Object.freeze({
  junior: "Junior",
  middle: "Middle",
  senior: "Senior",
  lead: "Lead",
  head: "Head",
});

/**
 * @param {string} url
 * @returns {string}
 */
function labelFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || url;
  } catch {
    return url;
  }
}

/**
 * Грейд + специализация → английская строка для карточки
 * (напр. `Senior Product Designer`).
 *
 * @param {string | null | undefined} grade
 * @param {string | null | undefined} role
 * @returns {string}
 */
export function formatPortfolioRole(grade, role) {
  const t = getStrings();
  const gradeLabel = grade ? GRADE_LABELS_EN[grade] || "" : "";
  const roleLabel = role ? ROLE_LABELS_EN[role] || "" : "";
  const combined = [gradeLabel, roleLabel].filter(Boolean).join(" ").trim();
  return combined || t.homeDefaultRole;
}

/**
 * Превью-скриншот страницы (внешний сервис; fallback в UI при ошибке).
 * @param {string} url
 * @returns {string}
 */
export function portfolioPreviewUrl(url) {
  return `https://image.thum.io/get/maxAge/24/width/1000/crop/500/${url}`;
}

/**
 * @param {Record<string, unknown>} row
 * @param {string | null | undefined} viewerId
 * @returns {PortfolioQueueItem}
 */
function mapPortfolioRow(row, viewerId) {
  const ownerId = typeof row.owner_id === "string" ? row.owner_id : "";
  const reviewsCount =
    typeof row.reviews_count === "number" && Number.isFinite(row.reviews_count)
      ? Math.max(0, Math.floor(row.reviews_count))
      : 0;
  const targetReviews =
    typeof row.target_reviews === "number" && Number.isFinite(row.target_reviews)
      ? Math.max(1, Math.floor(row.target_reviews))
      : DEFAULT_TARGET_REVIEWS;

  /** @type {PortfolioQueueItem} */
  const item = {
    id: String(row.id),
    url: String(row.url || ""),
    name: typeof row.name === "string" ? row.name : undefined,
    role: typeof row.role === "string" ? row.role : undefined,
    ownerId,
    isOwn: Boolean(viewerId && ownerId && viewerId === ownerId),
    reviewsCount,
    targetReviews,
    status:
      row.status === "done" || row.status === "skipped" || row.status === "pending"
        ? row.status
        : "pending",
  };
  if (typeof row.avatar_url === "string" && row.avatar_url.trim()) {
    item.avatarUrl = row.avatar_url.trim();
  }
  return item;
}

/**
 * No-op: очередь живёт в Supabase (раньше чистила localStorage).
 */
export function clearSubmittedPortfolios() {
  /* intentionally empty */
}

/**
 * Очередь на ревью: чужие pending в лиге ревьюера (RLS), без своих,
 * минус уже отревьюенные этим пользователем.
 *
 * @returns {Promise<PortfolioQueueItem[]>}
 */
export async function listPortfoliosForReview() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data: rows, error } = await supabase
    .from("portfolios")
    .select(
      "id, owner_id, url, name, role, avatar_url, target_reviews, reviews_count, status, created_at",
    )
    .eq("status", "pending")
    .neq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[portfolios] listPortfoliosForReview", error.message);
    }
    return [];
  }

  const { data: myReviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("portfolio_id")
    .eq("reviewer_id", user.id);

  if (reviewsError && import.meta.env.DEV) {
    console.warn("[portfolios] list reviews", reviewsError.message);
  }

  const reviewedIds = new Set(
    (myReviews || [])
      .map((r) => (r && typeof r.portfolio_id === "string" ? r.portfolio_id : ""))
      .filter(Boolean),
  );

  return (rows || [])
    .map((row) => mapPortfolioRow(row, user.id))
    .filter((item) => !reviewedIds.has(item.id));
}

/**
 * Портфолио текущего пользователя (для вкладки «Мои»; UI переключателя — снаружи).
 *
 * @returns {Promise<PortfolioQueueItem[]>}
 */
export async function listMyPortfolios() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data: rows, error } = await supabase
    .from("portfolios")
    .select(
      "id, owner_id, url, name, role, avatar_url, target_reviews, reviews_count, status, created_at",
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[portfolios] listMyPortfolios", error.message);
    }
    return [];
  }

  return (rows || []).map((row) => mapPortfolioRow(row, user.id));
}

/**
 * @param {string} id
 * @returns {Promise<PortfolioQueueItem | null>}
 */
export async function getPortfolio(id) {
  const supabase = getSupabase();
  if (!supabase || !id) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("portfolios")
    .select(
      "id, owner_id, url, name, role, avatar_url, target_reviews, reviews_count, status",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[portfolios] getPortfolio", error.message);
    }
    return null;
  }
  if (!data) return null;
  return mapPortfolioRow(data, user?.id);
}

/**
 * Подача своего портфолио в общую очередь.
 *
 * @param {string} rawUrl
 * @returns {Promise<PortfolioQueueItem>}
 */
export async function submitPortfolio(rawUrl) {
  const url = String(rawUrl || "").trim();
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("not_authenticated");
  }

  const session = getSession();
  const displayName =
    typeof session?.displayName === "string" ? session.displayName.trim() : "";
  const avatarUrl =
    typeof session?.avatarUrl === "string" ? session.avatarUrl.trim() : "";

  /** @type {Record<string, unknown>} */
  const insert = {
    owner_id: user.id,
    url,
    name: displayName || labelFromUrl(url),
    role: formatPortfolioRole(session?.grade, session?.role),
    target_reviews: DEFAULT_TARGET_REVIEWS,
    reviews_count: 0,
    status: "pending",
  };
  if (avatarUrl) {
    insert.avatar_url = avatarUrl;
  }

  const { data, error } = await supabase
    .from("portfolios")
    .insert(insert)
    .select(
      "id, owner_id, url, name, role, avatar_url, target_reviews, reviews_count, status",
    )
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "portfolio_submit_failed");
  }
  return mapPortfolioRow(data, user.id);
}

/**
 * Зафиксировать завершённое ревью (один раз на пару user↔portfolio).
 *
 * @param {string} portfolioId
 * @returns {Promise<void>}
 */
export async function submitPortfolioReview(portfolioId) {
  const id = String(portfolioId || "").trim();
  if (!id) {
    throw new Error("portfolio_id_required");
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("not_authenticated");
  }

  const { error } = await supabase.from("reviews").insert({
    portfolio_id: id,
    reviewer_id: user.id,
  });

  if (error) {
    throw new Error(error.message || "review_submit_failed");
  }
}
