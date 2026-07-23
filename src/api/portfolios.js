import { getSession } from "../app/session.js";
import { getStrings } from "../i18n.js";

/**
 * Очередь портфолио на ревью (local mock до Supabase).
 *
 * @typedef {{
 *   id: string;
 *   url: string;
 *   name?: string;
 *   role?: string;
 *   avatarUrl?: string;
 *   previewUrls?: string[];
 *   previewCount?: number;
 *   status?: 'pending' | 'done' | 'skipped';
 * }} PortfolioQueueItem
 */

const SUBMITTED_STORAGE_KEY = "obratka.submittedPortfolios";

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

/** @type {readonly PortfolioQueueItem[]} */
const SEED_QUEUE = Object.freeze([
  {
    id: "seed-narine",
    url: "https://narinkalubluleshku-cmyk.github.io/ux-ui-2-crm-ui/",
    name: "Наринэ Туманова",
    role: "Senior Product Designer",
    previewCount: 3,
    status: "pending",
  },
  {
    id: "seed-janelle",
    url: "https://janelle.page",
    name: "Janelle Jumadilova",
    role: "Product Designer",
    previewCount: 3,
    status: "pending",
  },
]);

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
 * @returns {PortfolioQueueItem[]}
 */
function readSubmitted() {
  try {
    const raw = window.localStorage.getItem(SUBMITTED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.url === "string",
    );
  } catch {
    return [];
  }
}

/**
 * @param {PortfolioQueueItem[]} items
 */
function writeSubmitted(items) {
  window.localStorage.setItem(SUBMITTED_STORAGE_KEY, JSON.stringify(items));
}

/**
 * Сброс поданных портфолио (тест / reset session).
 */
export function clearSubmittedPortfolios() {
  window.localStorage.removeItem(SUBMITTED_STORAGE_KEY);
}

/**
 * @returns {Promise<PortfolioQueueItem[]>}
 */
export async function listPortfoliosForReview() {
  const session = getSession();
  const displayName =
    typeof session?.displayName === "string" ? session.displayName.trim() : "";
  const avatarUrl =
    typeof session?.avatarUrl === "string" ? session.avatarUrl.trim() : "";
  const roleLabel = formatPortfolioRole(session?.grade, session?.role);

  const seed = SEED_QUEUE.map((item) => ({ ...item }));
  const submitted = readSubmitted().map((item) => ({
    ...item,
    name: displayName || item.name,
    role: roleLabel,
    ...(avatarUrl ? { avatarUrl } : {}),
  }));
  return [...seed, ...submitted];
}

/**
 * @param {string} id
 * @returns {Promise<PortfolioQueueItem | null>}
 */
export async function getPortfolio(id) {
  const seed = SEED_QUEUE.find((entry) => entry.id === id);
  if (seed) return { ...seed };
  const submitted = readSubmitted().find((entry) => entry.id === id);
  return submitted ? { ...submitted } : null;
}

/**
 * Подача своего портфолио в очередь (local stub).
 * Появляется в списке на главной и доступно для ревью.
 * Имя/аватар — из сессии (Google / Telegram); роль — грейд + специализация онбординга.
 *
 * @param {string} rawUrl
 * @returns {Promise<PortfolioQueueItem>}
 */
export async function submitPortfolio(rawUrl) {
  const url = String(rawUrl || "").trim();
  const session = getSession();
  const displayName =
    typeof session?.displayName === "string" ? session.displayName.trim() : "";
  const avatarUrl =
    typeof session?.avatarUrl === "string" ? session.avatarUrl.trim() : "";

  /** @type {PortfolioQueueItem} */
  const item = {
    id: `submitted-${Date.now()}`,
    url,
    name: displayName || labelFromUrl(url),
    role: formatPortfolioRole(session?.grade, session?.role),
    previewCount: 1,
    status: "pending",
  };
  if (avatarUrl) {
    item.avatarUrl = avatarUrl;
  }
  writeSubmitted([...readSubmitted(), item]);
  return { ...item };
}
