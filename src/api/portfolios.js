import { getSession } from "../app/session.js";
import { getStrings } from "../i18n.js";
import {
  getCachedAccessToken,
  getSupabase,
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "../lib/supabaseClient.js";
import { normalizePortfolioUrl } from "../utils/portfolioMeta.js";

/**
 * Очередь портфолио на ревью (Supabase) + свои карточки.
 * Матчинг лиг — RLS / `can_review_portfolio` (см. `leagues.js`).
 * Claim-слоты: `claimPortfolioReview` / heartbeat / `releasePortfolioClaim` /
 * `releasePortfolioClaimKeepalive` (pagehide). Orphan после failed unload —
 * `sessionStorage` `obratka.reviewClaim` + boot reconcile в `main.js`.
 *
 * @typedef {{
 *   kind: 'completed' | 'active';
 *   reviewerId?: string;
 *   avatarUrl?: string;
 *   displayName?: string;
 *   grade?: string;
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
 *   createdAt?: string;
 * }} PortfolioQueueItem
 */

/** Целевое число ревьюеров для новой карточки. */
export const DEFAULT_TARGET_REVIEWS = 3;

/** Макс. одновременных pending у автора (сервер: max_mine_pending). */
export const MAX_MINE_PENDING = 1;

/**
 * Верхняя граница ленты «На ревью» за один запрос — защита от неограниченного
 * select при резком наплыве регистраций (Free-план Supabase, shared CPU).
 * Лента и так режется RLS по лиге; лимит подрезает только очень длинный хвост.
 */
export const FEED_QUERY_LIMIT = 300;

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

/** Известные грейды для UI/лиг; остальное → `gradeUndefined` + лига 1. */
const KNOWN_GRADES = new Set(["junior", "middle", "senior", "lead", "head"]);

/**
 * @param {string | null | undefined} grade
 * @returns {string}
 */
function normalizeKnownGrade(grade) {
  const key = typeof grade === "string" ? grade.trim() : "";
  return key && KNOWN_GRADES.has(key) ? key : "";
}

/**
 * Только грейд (EN) — тултип слота ревьюера и т.п.
 * Пустой / неизвестный → локализованное «Грейд не определён».
 * @param {string | null | undefined} grade
 * @returns {string}
 */
export function formatPortfolioGrade(grade) {
  const t = getStrings();
  const key = normalizeKnownGrade(grade);
  if (!key) return t.gradeUndefined ?? "";
  return GRADE_LABELS_EN[key] || t.gradeUndefined || "";
}

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
 * Без известного грейда → локализованное `gradeUndefined`.
 *
 * @param {string | null | undefined} grade
 * @param {string | null | undefined} role
 * @returns {string}
 */
export function formatPortfolioRole(grade, role) {
  const t = getStrings();
  const gradeKey = normalizeKnownGrade(grade);
  if (!gradeKey) return t.gradeUndefined ?? "";

  const roleKey = typeof role === "string" ? role : "";
  const roleLabel = roleKey ? ROLE_LABELS_EN[roleKey] || "" : "";

  if (gradeKey === "head") {
    return HEAD_ROLE_LABELS_EN[roleKey] || "Head Of Design";
  }

  if (gradeKey === "lead") {
    if (!roleLabel) return "Design Lead";
    if (/^Designer$/i.test(roleLabel)) return "Design Lead";
    return roleLabel.replace(/\s*Designer$/i, " Design Lead");
  }

  const gradeLabel = GRADE_LABELS_EN[gradeKey] || "";
  const combined = [gradeLabel, roleLabel].filter(Boolean).join(" ").trim();
  return combined || t.homeDefaultRole;
}

/**
 * Превью-скриншот страницы: прокси/кэш Edge Function `portfolio-preview`
 * перед thum.io (кэш в Storage 24ч, retry + fallback на протухший кэш
 * при 429 — см. `supabase/functions/portfolio-preview/README.md`).
 * Без сконфигурированного Supabase — прямой fallback на thum.io.
 * width ≈ viewport (без даунскейла), crop ≈ AR фрейма карточки (~500×250),
 * wait/3 — после load, чтобы дождаться intro-анимаций.
 * В UI — `object-fit: contain`, без дополнительной обрезки; на ошибку
 * `<img>` реагирует своим `--empty` состоянием (fallback уже в UI).
 * @param {string} url
 * @returns {string}
 */
export function portfolioPreviewUrl(url) {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    return `https://image.thum.io/get/maxAge/24/width/1200/crop/620/wait/3/${url}`;
  }
  return `${supabaseUrl}/functions/v1/portfolio-preview?url=${encodeURIComponent(url)}`;
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
    /\b(no_slots|claim_not_found|already_reviewed|review_claim_required|portfolio_not_pending|portfolio_not_found|cannot_review_own_portfolio|review_league_mismatch|profile_banned|not_authenticated|too_many_pending|insufficient_balance|banned|url_required|invalid_url)\b/,
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
  if (typeof row.created_at === "string" && row.created_at.trim()) {
    item.createdAt = row.created_at;
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
  if (kind === "completed" && !reviewerId) return null;
  /** @type {PortfolioReviewerSlot} */
  const slot = { kind };
  if (reviewerId) slot.reviewerId = reviewerId;
  if (kind === "active") return slot;
  if (typeof r.avatar_url === "string" && r.avatar_url.trim()) {
    slot.avatarUrl = r.avatar_url.trim();
  }
  if (typeof r.display_name === "string" && r.display_name.trim()) {
    slot.displayName = r.display_name.trim();
  }
  if (typeof r.grade === "string" && r.grade.trim()) {
    slot.grade = r.grade.trim();
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
        "portfolio_id, reviewer_id, reviewer_avatar_url, reviewer_display_name, reviewer_grade, created_at",
      )
      .in("portfolio_id", ids),
    supabase
      .from("review_claims")
      .select("portfolio_id, claimed_at, expires_at")
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
        grade: row.reviewer_grade,
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
      }),
    );
  }

  /** @type {string[]} */
  const missingGradeIds = [];
  for (const list of map.values()) {
    for (const slot of list) {
      if (!slot.grade && slot.reviewerId) missingGradeIds.push(slot.reviewerId);
    }
  }
  const uniqueMissing = [...new Set(missingGradeIds)];
  if (uniqueMissing.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, grade")
      .in("id", uniqueMissing);
    if (profilesError && import.meta.env.DEV) {
      console.warn(
        "[portfolios] slots fallback grades",
        profilesError.message,
      );
    }
    /** @type {Map<string, string>} */
    const gradeById = new Map();
    for (const row of profiles || []) {
      if (
        row &&
        typeof row.id === "string" &&
        typeof row.grade === "string" &&
        row.grade.trim()
      ) {
        gradeById.set(row.id, row.grade.trim());
      }
    }
    for (const list of map.values()) {
      for (const slot of list) {
        if (!slot.grade && slot.reviewerId) {
          const grade = gradeById.get(slot.reviewerId);
          if (grade) slot.grade = grade;
        }
      }
    }
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
 * Клиентский фильтр кандидата на claim (сервер всё равно проверит).
 * Дверь = ещё не набрали target completed. Live claims не закрывают вход.
 *
 * @param {PortfolioQueueItem | null | undefined} item
 * @returns {boolean}
 */
export function isPortfolioOpenForReview(item) {
  if (!item || item.isOwn || item.reviewedByMe) return false;
  const id = typeof item.id === "string" ? item.id : "";
  if (!id) return false;
  const target = item.targetReviews ?? DEFAULT_TARGET_REVIEWS;
  const completed = item.reviewsCount ?? 0;
  return completed < target;
}

/**
 * Порядок ленты «На ревью» под быстрое закрытие target слотов автора:
 * 1) меньше остаётся до target — выше (сначала 2/3, потом 1/3, потом 0/3);
 * 2) tie-break: старше выше (`createdAt` ASC, FIFO).
 * Live claims не двигают карточку вниз — дверь открыта, пока completed < target.
 * `reviewedByMe` уже отфильтрованы в `listPortfoliosForReview`.
 * Стабильный сорт: не мутирует вход.
 *
 * @param {PortfolioQueueItem[]} items
 * @returns {PortfolioQueueItem[]}
 */
function sortFeedForSlotClosure(items) {
  return items
    .map((item, index) => {
      const target = item.targetReviews ?? DEFAULT_TARGET_REVIEWS;
      const completed = item.reviewsCount ?? 0;
      return {
        item,
        index,
        remaining: Math.max(0, target - completed),
        createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
      };
    })
    .sort((a, b) => {
      if (a.remaining !== b.remaining) return a.remaining - b.remaining;
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
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
 * `reviewedByMe` — после INSERT в `reviews` (submit отчёта), не claim /
 * abort / уход с квиза — такие кейсы **фильтруются из ленты**.
 * Active claims не прячут карточку и не закрывают claim: дверь =
 * `reviews_count < target`. Late in-flight после done сдаёт лист и получает +10.
 *
 * Порядок (после слотов) — `sortFeedForSlotClosure`: ближе к target
 * (больше completed) → старше (FIFO). Не newest-first.
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
    .order("created_at", { ascending: false })
    .limit(FEED_QUERY_LIMIT);

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
  const open = mapped.filter((item) => !item.reviewedByMe);

  return sortFeedForSlotClosure(await attachReviewerSlots(open));
}

/**
 * Кейсы, по которым текущий пользователь уже сдал отчёт (сегмент
 * «Уже отревьюено»). Включает pending и done — RLS пускает через
 * `has_reviewed_portfolio` (security definer; сырой exists по reviews
 * даёт circular RLS с политикой reviews). Порядок = свежесть ревью.
 *
 * @returns {Promise<PortfolioQueueItem[]>}
 */
export async function listReviewedPortfolios() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data: myReviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("portfolio_id, created_at")
    .eq("reviewer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(FEED_QUERY_LIMIT);

  if (reviewsError) {
    if (import.meta.env.DEV) {
      console.warn("[portfolios] listReviewedPortfolios reviews", reviewsError.message);
    }
    return [];
  }

  /** @type {string[]} */
  const orderedIds = [];
  const seen = new Set();
  for (const row of myReviews || []) {
    const id =
      row && typeof row.portfolio_id === "string" ? row.portfolio_id : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    orderedIds.push(id);
  }
  if (orderedIds.length === 0) return [];

  const { data: rows, error } = await supabase
    .from("portfolios")
    .select(
      "id, owner_id, url, name, role, avatar_url, target_reviews, reviews_count, status, created_at",
    )
    .in("id", orderedIds);

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[portfolios] listReviewedPortfolios", error.message);
    }
    return [];
  }

  /** @type {Map<string, PortfolioQueueItem>} */
  const byId = new Map();
  for (const row of rows || []) {
    const item = mapPortfolioRow(row, user.id);
    item.reviewedByMe = true;
    byId.set(item.id, item);
  }

  /** @type {PortfolioQueueItem[]} */
  const ordered = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item) ordered.push(item);
  }

  return attachReviewerSlots(ordered);
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
 * Id чужих pending-портфолио в ленте (для точки «новый кейс» на «На ревью»).
 * Без слотов / сорта; исключает уже отревьюенные (`reviews`), как
 * `listPortfoliosForReview`. Лиги — через RLS.
 *
 * @returns {Promise<string[]>}
 */
export async function listFeedPortfolioIds() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data: rows, error } = await supabase
    .from("portfolios")
    .select("id")
    .eq("status", "pending")
    .neq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(FEED_QUERY_LIMIT);

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[portfolios] listFeedPortfolioIds", error.message);
    }
    return [];
  }

  const { data: myReviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("portfolio_id")
    .eq("reviewer_id", user.id);

  if (reviewsError && import.meta.env.DEV) {
    console.warn("[portfolios] listFeedPortfolioIds reviews", reviewsError.message);
  }

  const reviewedIds = new Set(
    (myReviews || [])
      .map((r) => (r && typeof r.portfolio_id === "string" ? r.portfolio_id : ""))
      .filter(Boolean),
  );

  return (rows || [])
    .map((row) => (row?.id != null ? String(row.id) : ""))
    .filter((id) => id && !reviewedIds.has(id));
}

/**
 * Id своих портфолио, собравших все ревью (для точки на вкладке «Мои»).
 * Лёгкий запрос: только счётчики, без слотов и маппинга карточек.
 *
 * @returns {Promise<string[]>}
 */
export async function listReadyOwnReportIds() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data: rows, error } = await supabase
    .from("portfolios")
    .select("id, target_reviews, reviews_count")
    .eq("owner_id", user.id);

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[portfolios] listReadyOwnReportIds", error.message);
    }
    return [];
  }

  return (rows || [])
    .filter(
      (row) =>
        (Number(row?.reviews_count) || 0) >=
        Math.max(1, Number(row?.target_reviews) || 1),
    )
    .map((row) => (row?.id != null ? String(row.id) : ""))
    .filter(Boolean);
}

/**
 * Есть ли своё портфолио, собравшее все ревью.
 *
 * @returns {Promise<boolean>}
 */
export async function hasReadyOwnReport() {
  const ids = await listReadyOwnReportIds();
  return ids.length > 0;
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
 * Сколько своих pending сейчас (для гейта слота до RPC).
 * @returns {Promise<number>}
 */
export async function countMyPendingPortfolios() {
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

  const { count, error } = await supabase
    .from("portfolios")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message || "portfolio_pending_count_failed");
  }
  return typeof count === "number" && Number.isFinite(count)
    ? Math.max(0, Math.floor(count))
    : 0;
}

/**
 * Есть ли свободный слот (pending < MAX_MINE_PENDING).
 * @returns {Promise<boolean>}
 */
export async function hasFreeMineSlot() {
  const pending = await countMyPendingPortfolios();
  return pending < MAX_MINE_PENDING;
}

/**
 * Подача своего портфолио: RPC spend + insert + лимит pending.
 *
 * @param {string} rawUrl
 * @returns {Promise<PortfolioQueueItem & { balance?: number }>}
 */
export async function submitPortfolio(rawUrl) {
  const url = normalizePortfolioUrl(rawUrl);
  if (!url) {
    throw new Error("invalid_url");
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
  const displayName =
    typeof session?.displayName === "string" ? session.displayName.trim() : "";
  const avatarUrl =
    typeof session?.avatarUrl === "string" ? session.avatarUrl.trim() : "";

  const { data, error } = await supabase.rpc("submit_portfolio", {
    p_url: url,
    p_name: displayName || labelFromUrl(url),
    p_role: formatPortfolioRole(session?.grade, session?.role),
    p_avatar_url: avatarUrl || null,
  });

  if (error || !data || typeof data !== "object") {
    throw new Error(
      portfolioRpcErrorCode(error) || "portfolio_submit_failed",
    );
  }

  /** @type {Record<string, unknown>} */
  const row = /** @type {Record<string, unknown>} */ (data);
  const item = mapPortfolioRow(row, user.id);
  const bal = row.balance;
  if (typeof bal === "number" && Number.isFinite(bal)) {
    return { ...item, balance: Math.max(0, Math.floor(bal)) };
  }
  return item;
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
 * Fire-and-forget release на unload (`pagehide`): `keepalive` fetch к RPC,
 * без await. Токен — из кэша auth (sync); storage claim не чистим здесь —
 * boot reconcile добьёт, если запрос не успел.
 *
 * @param {string} portfolioId
 * @returns {boolean} true если fetch ушёл
 */
export function releasePortfolioClaimKeepalive(portfolioId) {
  const id = String(portfolioId || "").trim();
  if (!id) return false;

  const base = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  const token = getCachedAccessToken();
  if (!base || !anon || !token) return false;

  try {
    void fetch(`${base}/rest/v1/rpc/release_portfolio_claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: anon,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_portfolio_id: id }),
      keepalive: true,
    });
    return true;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[portfolios] releasePortfolioClaimKeepalive", err);
    }
    return false;
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
  const grade =
    typeof session?.grade === "string" ? session.grade.trim() : "";
  const role =
    typeof session?.role === "string" ? session.role.trim() : "";

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
  if (grade) {
    insert.reviewer_grade = grade;
  }
  if (role) {
    insert.reviewer_role = role;
  }

  const { error } = await supabase.from("reviews").insert(insert);

  if (error) {
    throw new Error(portfolioRpcErrorCode(error) || "review_submit_failed");
  }
}
