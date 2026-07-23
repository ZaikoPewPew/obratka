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

/** @type {Readonly<Record<string, string>>} */
const ROLE_LABEL_KEYS = Object.freeze({
  "web-designer": "onboardingStepRoleWeb",
  "product-designer": "onboardingStepRoleProduct",
  "emotional-designer": "onboardingStepRoleEmotional",
  "ux-ui-designer": "onboardingStepRoleUxUi",
  other: "onboardingStepRoleOther",
});

/** @type {Readonly<Record<string, string>>} */
const GRADE_LABEL_KEYS = Object.freeze({
  junior: "onboardingStepGradeJunior",
  middle: "onboardingStepGradeMiddle",
  senior: "onboardingStepGradeSenior",
  lead: "onboardingStepGradeLead",
  head: "onboardingStepGradeHead",
});

/** @type {readonly PortfolioQueueItem[]} */
const SEED_QUEUE = Object.freeze([
  {
    id: "seed-narine",
    url: "https://narinkalubluleshku-cmyk.github.io/ux-ui-2-crm-ui/",
    name: "Наринэ Туманова",
    role: "Senior Product Designer",
    avatarUrl: "https://unavatar.io/github/gaearon",
    previewCount: 3,
    status: "pending",
  },
  {
    id: "seed-janelle",
    url: "https://janelle.page",
    name: "Janelle Jumadilova",
    role: "Product Designer",
    avatarUrl: "https://unavatar.io/github/rauchg",
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
 * Грейд + специализация из онбординга → одна строка для карточки.
 *
 * @param {string | null | undefined} grade
 * @param {string | null | undefined} role
 * @returns {string}
 */
export function formatPortfolioRole(grade, role) {
  const t = getStrings();
  const gradeKey = grade ? GRADE_LABEL_KEYS[grade] : null;
  const roleKey = role ? ROLE_LABEL_KEYS[role] : null;
  const gradeLabel =
    gradeKey && typeof t[gradeKey] === "string" ? t[gradeKey] : "";
  const roleLabel =
    roleKey && typeof t[roleKey] === "string" ? t[roleKey] : "";
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
  const seed = SEED_QUEUE.map((item) => ({ ...item }));
  const submitted = readSubmitted().map((item) => ({ ...item }));
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
 * Имя/аватар — из Telegram-сессии; роль — грейд + специализация онбординга.
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
