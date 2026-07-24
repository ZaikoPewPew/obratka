import { getSession } from "../app/session.js";
import { getStrings } from "../i18n.js";
import { getSupabase } from "../lib/supabaseClient.js";

/**
 * Очередь портфолио на ревью (Supabase) + свои карточки.
 * Матчинг лиг — RLS / `can_review_portfolio` (см. `leagues.js`).
 * Claim-слоты: `claimPortfolioReview` / heartbeat / release.
 *
 * @typedef {{
 *   kind: 'completed' | 'active';
 *   reviewerId: string;
 *   avatarUrl?: string;
 *   displayName?: string;
 * }} PortfolioReviewerSlot
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
 *   reviewedByMe?: boolean;
 *   reviewerSlots?: PortfolioReviewerSlot[];
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
  staff: "Staff",
  lead: "Lead",
  head: "Head",
});

/**
 * Head Of {Discipline} — product/other → «Head Of Design».
 * @type {Readonly<Record<string, string>>}
 */
const HEAD_ROLE_LABELS_EN = Object.freeze({
  "web-designer": "Head Of Web Design",
  "product-designer": "Head Of Design",
  "emotional-designer": "Head Of Emotional Design",
  "ux-ui-designer": "Head Of UX / UI Design",
  other: "Head Of Design",
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
 * Грейд + специализация → английская строка для карточки.
 * Junior/Middle/Senior/Staff: `{Grade} {Role}`.
 * Lead: `Product Design Lead` (не `Lead Product Designer`).
 * Head: `Head Of Design` / `Head Of Emotional Design` / …
 *
 * @param {string | null | undefined} grade
 * @param {string | null | undefined} role
 * @returns {string}
 */
export function formatPortfolioRole(grade, role) {
  const t = getStrings();
  const roleKey = typeof role === "string" ? role : "";
  const roleLabel = roleKey ? ROLE_LABELS_EN[roleKey] || "" : "";

  if (grade === "head") {
    return HEAD_ROLE_LABELS_EN[roleKey] || "Head Of Design";
  }

  if (grade === "lead") {
    if (!roleLabel) return "Design Lead";
    if (/^Designer$/i.test(roleLabel)) return "Design Lead";
    return roleLabel.replace(/\s*Designer$/i, " Design Lead");
  }

  const gradeLabel = grade ? GRADE_LABELS_EN[grade] || "" : "";
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
 * @param {unknown} err
 * @returns {string}
 */
export function portfolioRpcErrorCode(err) {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String(/** @type {{ message?: unknown }} */ (err).message || "")
      : err instanceof Error
        ? err.message
        : String(err || "");
  const match = raw.match(
    /\b(no_slots|claim_not_found|already_reviewed|review_claim_required|portfolio_not_pending|portfolio_not_found|cannot_review_own_portfolio|review_league_mismatch|profile_banned|not_authenticated)\b/,
  );
  return match ? match[1] : raw || "unknown_error";
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
 * @param {unknown} row
 * @returns {PortfolioReviewerSlot | null}
 */
function mapSlotRow(row) {
  if (!row || typeof row !== "object") return null;
  const r = /** @type {Record<string, unknown>} */ (row);
  const kind = r.slot_kind === "active" ? "active" : "completed";
  const reviewerId =
    typeof r.reviewer_id === "string" ? r.reviewer_id : "";
  if (!reviewerId) return null;
  /** @type {PortfolioReviewerSlot} */
  const slot = { kind, reviewerId };
  if (typeof r.avatar_url === "string" && r.avatar_url.trim()) {
    slot.avatarUrl = r.avatar_url.trim();
  }
  if (typeof r.display_name === "string" && r.display_name.trim()) {
    slot.displayName = r.display_name.trim();
  }
  return slot;
}

/**
 * @param {Map<string, PortfolioReviewerSlot[]>} map
 * @param {string} portfolioId
 * @param {PortfolioReviewerSlot | null} slot
 */
function pushSlot(map, portfolioId, slot) {
  if (!portfolioId || !slot) return;
  const list = map.get(portfolioId) || [];
  list.push(slot);
  map.set(portfolioId, list);
}

/**
 * @param {Map<string, PortfolioReviewerSlot[]>} map
 */
function sortSlotsMap(map) {
  for (const [id, list] of map) {
    list.sort((a, b) => {
      if (a.kind === b.kind) return 0;
      return a.kind === "completed" ? -1 : 1;
    });
    map.set(id, list);
  }
}

/**
 * Fallback без RPC (RLS: автор видит все ревью своих кейсов; ревьюер — свои).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string[]} ids
 * @returns {Promise<Map<string, PortfolioReviewerSlot[]>>}
 */
async function fetchReviewerSlotsFallback(supabase, ids) {
  /** @type {Map<string, PortfolioReviewerSlot[]>} */
  const map = new Map();

  const [reviewsRes, claimsRes] = await Promise.all([
    supabase
      .from("reviews")
      .select(
        "portfolio_id, reviewer_id, reviewer_avatar_url, reviewer_display_name, created_at",
      )
      .in("portfolio_id", ids),
    supabase
      .from("review_claims")
      .select(
        "portfolio_id, reviewer_id, reviewer_avatar_url, reviewer_display_name, claimed_at, expires_at",
      )
      .in("portfolio_id", ids)
      .gt("expires_at", new Date().toISOString()),
  ]);

  if (reviewsRes.error && import.meta.env.DEV) {
    console.warn("[portfolios] slots fallback reviews", reviewsRes.error.message);
  }
  if (claimsRes.error && import.meta.env.DEV) {
    console.warn("[portfolios] slots fallback claims", claimsRes.error.message);
  }

  for (const row of reviewsRes.data || []) {
    const portfolioId =
      row && typeof row.portfolio_id === "string" ? row.portfolio_id : "";
    pushSlot(
      map,
      portfolioId,
      mapSlotRow({
        slot_kind: "completed",
        reviewer_id: row.reviewer_id,
        avatar_url: row.reviewer_avatar_url,
        display_name: row.reviewer_display_name,
      }),
    );
  }

  for (const row of claimsRes.data || []) {
    const portfolioId =
      row && typeof row.portfolio_id === "string" ? row.portfolio_id : "";
    pushSlot(
      map,
      portfolioId,
      mapSlotRow({
        slot_kind: "active",
        reviewer_id: row.reviewer_id,
        avatar_url: row.reviewer_avatar_url,
        display_name: row.reviewer_display_name,
      }),
    );
  }

  sortSlotsMap(map);
  return map;
}

/**
 * @param {string[]} portfolioIds
 * @returns {Promise<Map<string, PortfolioReviewerSlot[]>>}
 */
async function fetchReviewerSlotsByPortfolio(portfolioIds) {
  /** @type {Map<string, PortfolioReviewerSlot[]>} */
  const map = new Map();
  const ids = [...new Set(portfolioIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const supabase = getSupabase();
  if (!supabase) return map;

  const { data, error } = await supabase.rpc("portfolio_reviewer_slots", {
    p_ids: ids,
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[portfolios] portfolio_reviewer_slots", error.message);
    }
    return fetchReviewerSlotsFallback(supabase, ids);
  }

  for (const row of data || []) {
    const portfolioId =
      row && typeof row.portfolio_id === "string" ? row.portfolio_id : "";
    pushSlot(map, portfolioId, mapSlotRow(row));
  }

  sortSlotsMap(map);
  return map;
}

/**
 * @param {PortfolioQueueItem[]} items
 * @returns {Promise<PortfolioQueueItem[]>}
 */
async function attachReviewerSlots(items) {
  if (items.length === 0) return items;
  const slotsMap = await fetchReviewerSlotsByPortfolio(items.map((i) => i.id));
  return items.map((item) => {
    const slots = slotsMap.get(item.id) || [];
    return { ...item, reviewerSlots: slots };
  });
}

/**
 * No-op: очередь живёт в Supabase (раньше чистила localStorage).
 */
export function clearSubmittedPortfolios() {
  /* intentionally empty */
}

/**
 * Очередь на ревью: чужие pending в лиге ревьюера (RLS), без своих.
 * Карточка остаётся до 3/3 completed-отчётов (`status=pending`);
 * уже отревьюенные текущим юзером помечаются `reviewedByMe` (клик → notice).
 * Active claims не прячут карточку — только `no_slots` при открытии.
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

  const mapped = (rows || []).map((row) => {
    const item = mapPortfolioRow(row, user.id);
    item.reviewedByMe = reviewedIds.has(item.id);
    return item;
  });

  return attachReviewerSlots(mapped);
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

  const mapped = (rows || []).map((row) => mapPortfolioRow(row, user.id));
  return attachReviewerSlots(mapped);
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
  const [withSlots] = await attachReviewerSlots([
    mapPortfolioRow(data, user?.id),
  ]);
  return withSlots ?? null;
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
 * Занять слот ревью при открытии /review.
 *
 * @param {string} portfolioId
 * @returns {Promise<void>}
 */
export async function claimPortfolioReview(portfolioId) {
  const id = String(portfolioId || "").trim();
  if (!id) {
    throw new Error("portfolio_id_required");
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const { error } = await supabase.rpc("claim_portfolio_review", {
    p_portfolio_id: id,
  });

  if (error) {
    throw new Error(portfolioRpcErrorCode(error));
  }
}

/**
 * Продлить TTL claim, пока пользователь на review/quiz.
 *
 * @param {string} portfolioId
 * @returns {Promise<void>}
 */
export async function heartbeatPortfolioClaim(portfolioId) {
  const id = String(portfolioId || "").trim();
  if (!id) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.rpc("heartbeat_portfolio_claim", {
    p_portfolio_id: id,
  });

  if (error) {
    throw new Error(portfolioRpcErrorCode(error));
  }
}

/**
 * Освободить слот при уходе без submit.
 *
 * @param {string} portfolioId
 * @returns {Promise<void>}
 */
export async function releasePortfolioClaim(portfolioId) {
  const id = String(portfolioId || "").trim();
  if (!id) return;

  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.rpc("release_portfolio_claim", {
    p_portfolio_id: id,
  });

  if (error && import.meta.env.DEV) {
    console.warn("[portfolios] releasePortfolioClaim", error.message);
  }
}

/**
 * Зафиксировать завершённое ревью (один раз на пару user↔portfolio).
 * Требует живой claim; пишет answers jsonb.
 *
 * @param {string} portfolioId
 * @param {import("../utils/reviewReport.js").ReviewAnswers | null | undefined} [answers]
 * @returns {Promise<void>}
 */
export async function submitPortfolioReview(portfolioId, answers) {
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

  const session = getSession();
  const avatarUrl =
    typeof session?.avatarUrl === "string" ? session.avatarUrl.trim() : "";
  const displayName =
    typeof session?.displayName === "string" ? session.displayName.trim() : "";

  /** @type {Record<string, unknown>} */
  const insert = {
    portfolio_id: id,
    reviewer_id: user.id,
  };
  if (answers && typeof answers === "object") {
    insert.answers = answers;
  }
  if (avatarUrl) {
    insert.reviewer_avatar_url = avatarUrl;
  }
  if (displayName) {
    insert.reviewer_display_name = displayName;
  }

  const { error } = await supabase.from("reviews").insert(insert);

  if (error) {
    throw new Error(portfolioRpcErrorCode(error) || "review_submit_failed");
  }
}
