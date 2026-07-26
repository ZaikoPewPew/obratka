import { formatString, getLocale, getStrings } from "../../i18n.js";
import {
  formatPortfolioGrade,
  formatPortfolioRole,
  listMyPortfolios,
  listPortfoliosForReview,
  listReadyOwnReportIds,
  portfolioPreviewUrl,
} from "../../api/portfolios.js";
import { listRatingTop } from "../../api/rating.js";
import {
  buildReferralShareUrl,
  REFERRAL_MAX_USES,
} from "../../utils/referralCode.js";
import { fetchMyReferral } from "../../api/referrals.js";
import {
  canSubmitPortfolio,
  creditBalance,
  getBalance,
  refreshWalletFromServer,
  TEMP_BALANCE_CHIP_AMOUNT,
  TEMP_BALANCE_CHIP_CREDIT,
} from "../../api/wallet.js";
import { formatReputationDelta } from "../../api/reviewComplaints.js";
import { listOnlineLegendaries } from "../../api/presence.js";
import { getSession, setSession } from "../../app/session.js";
import { resolvePlatformIcon } from "../../utils/platformBrandIcon.js";
import {
  BACKDROP_DARK_LUMA,
  resolveImageLumaProbes,
  sampleBackdropLuminance,
} from "../../utils/backdropLuminance.js";
import {
  hasUnseenMineReady,
  markMineReadySeen,
} from "../../utils/mineReadySeen.js";
import {
  getCachedHomeList,
  setCachedHomeList,
} from "../../utils/homeListCache.js";
import {
  DEFAULT_MINE_FILTER,
  HOME_TAB_IDS,
  MINE_FILTER_IDS,
  parseHomeView,
} from "../../utils/homeRoute.js";
import { brandMarkSvg } from "../../assets/brand/brandMarks.js";
import { createAppModal } from "../app-modal/AppModal.js";
import { createAccountMenu } from "../account-menu/AccountMenu.js";
import { createTabsPanel } from "../tabs-panel/TabsPanel.js";
import { createLegendaryOnlinePanel } from "../legendary-online-panel/LegendaryOnlinePanel.js";
import { COMMUNITY_CONTACT_URL } from "../../config/contacts.js";
import { REVIEW_SESSION_SECONDS } from "../../config/review.js";
import boneIconUrl from "../../assets/home/bone.svg";
import plusIconSvg from "../../assets/home/plus.svg?raw";
import reviewedCheckIconSvg from "../../assets/home/reviewed-check.svg?raw";
import reputationIconUrl from "../../assets/home/reputation.svg";
import slotPlusIconUrl from "../../assets/home/slot-plus.svg";

const PREVIEW_BROWSER_CONTROLS_URL = `${
  import.meta.env.BASE_URL || "/"
}assets/svg/home-preview-browser-controls.svg`;

/**
 * Plus для кнопки «Закинуть своё» — inline SVG: в `<img>` currentColor не
 * наследует color кнопки.
 * @returns {SVGElement}
 */
function createSubmitPlusIcon() {
  const wrap = document.createElement("span");
  wrap.innerHTML = plusIconSvg.trim();
  const svg = wrap.firstElementChild;
  if (!(svg instanceof SVGElement)) {
    throw new Error("plus.svg must be a root <svg>");
  }
  svg.classList.add("home-screen__tabbar-submit-icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  return svg;
}

/**
 * Галочка «отчёт отправлен» на превью карточки ленты.
 * @returns {SVGElement}
 */
function createReviewedCheckIcon() {
  const wrap = document.createElement("span");
  wrap.innerHTML = reviewedCheckIconSvg.trim();
  const svg = wrap.firstElementChild;
  if (!(svg instanceof SVGElement)) {
    throw new Error("reviewed-check.svg must be a root <svg>");
  }
  svg.classList.add("home-screen__preview-reviewed-chip-icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  return svg;
}

/**
 * Старые строки портфолио уже хранят объединённый `grade + role`.
 * Вытаскиваем из них грейд для компактной подписи карточки.
 * @param {string | null | undefined} role
 * @returns {string}
 */
function gradeFromPortfolioRole(role) {
  const value = typeof role === "string" ? role.trim() : "";
  if (!value) return "";
  if (/^Junior\b/i.test(value)) return "Junior";
  if (/^Middle\b/i.test(value)) return "Middle";
  if (/^Senior\b/i.test(value)) return "Senior";
  if (/^Staff\b/i.test(value)) return "Staff";
  if (/\bLead$/i.test(value)) return "Lead";
  if (/^Head Of\b/i.test(value)) return "Head";
  return "";
}

/** Сколько монет даёт клик по чипу баланса (temp / DEV). */
const DEV_CREDIT_AMOUNT = TEMP_BALANCE_CHIP_AMOUNT;

/** Сколько skeleton-карточек показывать, пока грузится лента. */
const SKELETON_CARD_COUNT = 5;

/** Сколько skeleton-карточек показывать, пока грузится рейтинг. */
const RATING_SKELETON_CARD_COUNT = 8;

/** Обновление active-слотов, пока home открыт. */
const HOME_SLOTS_POLL_MS = 15_000;

/**
 * Порог только для hide: show — при любом скролле вверх / у низа ленты.
 * Hide чуть с запасом, чтобы не дёргался от трекпада.
 */
const TABBAR_HIDE_DELTA = 6;

/** Допуск «у низа» (subpixel / rubber-band), чтобы док снова выехал. */
const TABBAR_BOTTOM_EPS = 8;

/**
 * @typedef {'feed' | 'mine' | 'rating'} HomeTabId
 */

/**
 * @typedef {'active' | 'completed'} MineFilterId
 */

/**
 * @typedef {{
 *   kind?: 'completed' | 'active';
 *   reviewerId?: string;
 *   avatarUrl?: string;
 *   displayName?: string;
 *   grade?: string;
 * }} HomeReviewerSlot
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
 *   status?: string;
 *   reviewedByMe?: boolean;
 *   reviewerSlots?: HomeReviewerSlot[];
 * }} HomePortfolioItem
 */

/**
 * Первая буква имени / email для letter-аватара.
 * @param {string | null | undefined} label
 * @returns {string}
 */
function initialFromLabel(label) {
  const text = String(label || "").trim();
  if (!text) return "?";
  const match = text.match(/\p{L}|\p{N}/u);
  return (match ? match[0] : text.charAt(0)).toLocaleUpperCase();
}

/**
 * Иконка занятого, но ещё не завершённого анонимного ревью.
 * @returns {SVGSVGElement}
 */
function createAnonymousReviewerIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.classList.add("home-screen__reviewer-slot-anonymous-icon");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");

  const body = document.createElementNS(ns, "path");
  body.setAttribute(
    "d",
    "M12.25 15C13.3546 15 14.3258 14.0723 13.957 13.0311C13.3593 11.3437 11.8124 10.5 9 10.5C6.18759 10.5 4.64072 11.3437 4.04302 13.0311C3.67422 14.0723 4.64543 15 5.75 15H12.25Z",
  );

  const head = document.createElementNS(ns, "path");
  head.setAttribute(
    "d",
    "M9 8.25C10.5 8.25 11.25 7.5 11.25 5.625C11.25 3.75 10.5 3 9 3C7.5 3 6.75 3.75 6.75 5.625C6.75 7.5 7.5 8.25 9 8.25Z",
  );

  for (const path of [body, head]) {
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.3");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
  }
  svg.append(body, head);
  return svg;
}

/**
 * @param {HTMLImageElement} img
 * @param {string[]} candidates
 */
function bindImageFallbacks(img, candidates) {
  let index = 0;
  img.addEventListener("error", () => {
    if (index < candidates.length) {
      img.src = candidates[index];
      index += 1;
      return;
    }
    img.hidden = true;
  });
}

/**
 * @param {HTMLElement} slot
 * @param {string} label
 */
function attachReviewerSlotTooltip(slot, label) {
  const text = typeof label === "string" ? label.trim() : "";
  if (!text) return;
  slot.setAttribute("aria-label", text);
  const tooltip = document.createElement("span");
  tooltip.className = "home-screen__reviewer-slot-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.textContent = text;
  slot.append(tooltip);
}

/**
 * Заполняет `.home-screen__reviewer-slots` по данным карточки (create + silent patch).
 *
 * @param {HTMLElement} slots
 * @param {HomePortfolioItem} item
 */
function fillReviewerSlots(slots, item) {
  const t = getStrings();
  const total = Math.max(1, Number(item.targetReviews) || 1);
  const filledSlots = Array.isArray(item.reviewerSlots)
    ? item.reviewerSlots.slice(0, total)
    : [];
  slots.replaceChildren();
  slots.setAttribute(
    "aria-label",
    formatString(t.homeCardReviewerSlotsAria, {
      filled: filledSlots.length,
      total,
    }),
  );

  for (let i = 0; i < total; i += 1) {
    const slotData = filledSlots[i];
    const slot = document.createElement("span");
    slot.className = "home-screen__reviewer-slot";
    if (!slotData) {
      slot.classList.add("home-screen__reviewer-slot--empty");
      const plusImg = document.createElement("img");
      plusImg.className = "home-screen__reviewer-slot-plus";
      plusImg.src = slotPlusIconUrl;
      plusImg.alt = "";
      plusImg.width = 18;
      plusImg.height = 18;
      plusImg.decoding = "async";
      plusImg.setAttribute("aria-hidden", "true");
      slot.append(plusImg);
      attachReviewerSlotTooltip(slot, t.homeCardReviewerEmpty);
      slots.append(slot);
      continue;
    }
    if (slotData.kind === "active") {
      slot.classList.add("home-screen__reviewer-slot--active");
      slot.append(createAnonymousReviewerIcon());
      attachReviewerSlotTooltip(slot, t.homeCardReviewerAnonymous);
      slots.append(slot);
      continue;
    }
    slot.classList.add("home-screen__reviewer-slot--completed");
    const slotAvatar =
      typeof slotData.avatarUrl === "string" ? slotData.avatarUrl.trim() : "";
    const slotLetter = initialFromLabel(
      slotData.displayName || slotData.reviewerId || "?",
    );
    const gradeKey =
      typeof slotData.grade === "string" ? slotData.grade.trim() : "";
    const gradeLabel = formatPortfolioGrade(gradeKey);
    if (gradeLabel) {
      attachReviewerSlotTooltip(slot, gradeLabel);
    }
    if (slotAvatar) {
      const slotImg = document.createElement("img");
      slotImg.className = "home-screen__reviewer-slot-img";
      slotImg.alt = "";
      slotImg.width = 32;
      slotImg.height = 32;
      slotImg.decoding = "async";
      slotImg.loading = "lazy";
      slotImg.referrerPolicy = "no-referrer";
      slotImg.addEventListener("error", () => {
        slotImg.remove();
        slot.classList.add("home-screen__reviewer-slot--letter");
        const letterEl = document.createElement("span");
        letterEl.className = "home-screen__reviewer-slot-letter";
        letterEl.textContent = slotLetter;
        letterEl.setAttribute("aria-hidden", "true");
        slot.append(letterEl);
      });
      slotImg.src = slotAvatar;
      slot.append(slotImg);
    } else {
      slot.classList.add("home-screen__reviewer-slot--letter");
      const letterEl = document.createElement("span");
      letterEl.className = "home-screen__reviewer-slot-letter";
      letterEl.textContent = slotLetter;
      letterEl.setAttribute("aria-hidden", "true");
      slot.append(letterEl);
    }
    slots.append(slot);
  }
}

/**
 * Можно ли обновить только слоты без полной пересборки списка.
 *
 * @param {HomePortfolioItem[]} prev
 * @param {HomePortfolioItem[]} next
 * @returns {boolean}
 */
function canPatchListSlots(prev, next) {
  if (prev.length !== next.length) return false;
  return prev.every((p, i) => {
    const n = next[i];
    return (
      p.id === n.id &&
      Boolean(p.reviewedByMe) === Boolean(n.reviewedByMe) &&
      Boolean(p.isOwn) === Boolean(n.isOwn) &&
      Math.max(1, Number(p.targetReviews) || 1) ===
        Math.max(1, Number(n.targetReviews) || 1)
    );
  });
}

/**
 * Id своих карточек с собранными ревью (3/3).
 *
 * @param {HomePortfolioItem[] | null | undefined} list
 * @returns {string[]}
 */
function readyOwnCardIds(list) {
  return (Array.isArray(list) ? list : [])
    .filter(
      (item) =>
        (Number(item?.reviewsCount) || 0) >=
        Math.max(1, Number(item?.targetReviews) || 1),
    )
    .map((item) => (item?.id != null ? String(item.id) : ""))
    .filter(Boolean);
}

/**
 * Завершённые: все ревью собраны (3/3).
 *
 * @param {HomePortfolioItem} item
 * @returns {boolean}
 */
function isCompletedOwnItem(item) {
  const total = Math.max(1, Number(item?.targetReviews) || 1);
  const completed = Math.max(0, Number(item?.reviewsCount) || 0);
  return completed >= total;
}

/**
 * Главная: шапка + лента карточек портфолио (Figma home).
 *
 * @param {{
 *   onOpenPortfolio: (item: HomePortfolioItem) => void | Promise<void>;
 *   onOpenReport?: (item: HomePortfolioItem) => void | Promise<void>;
 *   onAddPortfolio?: () => void | Promise<void>;
 *   onOpenSettings?: () => void | Promise<void>;
 *   onSignOut?: () => void | Promise<void>;
 *   onViewChange?: (view: { tab: HomeTabId; filter: MineFilterId; reason: 'tab' | 'filter' }) => void;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: (view?: { tab?: HomeTabId; filter?: MineFilterId }) => void | Promise<void>;
 *   close: () => Promise<void>;
 *   setItems: (items: HomePortfolioItem[]) => void;
 *   setView: (view: { tab?: HomeTabId; filter?: MineFilterId }) => Promise<void>;
 *   getView: () => { tab: HomeTabId; filter: MineFilterId };
 *   refresh: () => Promise<void>;
 *   showNotice: (opts: { title: string; body: string; closeLabel?: string; closeAria?: string }) => void;
 * }}
 */
export function createHomeScreen({
  onOpenPortfolio,
  onOpenReport,
  onAddPortfolio,
  onOpenSettings,
  onSignOut,
  onViewChange,
}) {
  const root = document.createElement("section");
  root.className = "home-screen";
  root.setAttribute("aria-labelledby", "home-screen-title");
  root.hidden = true;

  const title = document.createElement("h1");
  title.className = "home-screen__title";
  title.id = "home-screen-title";

  const topbar = document.createElement("header");
  topbar.className = "home-screen__topbar";

  const mark = document.createElement("div");
  mark.className = "home-screen__mark";
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML = brandMarkSvg("home-screen__mark-img");

  const topActions = document.createElement("div");
  topActions.className = "home-screen__top-actions";

  /* «Закинуть своё»: квадратная кнопка справа от таббара (не в шапке). */
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "home-screen__tabbar-submit";
  addBtn.append(createSubmitPlusIcon());

  const balanceChip = document.createElement("button");
  balanceChip.type = "button";
  balanceChip.className = "home-screen__chip home-screen__chip--balance";

  const boneImg = document.createElement("img");
  boneImg.className = "home-screen__chip-icon";
  boneImg.src = boneIconUrl;
  boneImg.alt = "";
  boneImg.width = 24;
  boneImg.height = 24;
  boneImg.decoding = "async";

  const balanceValue = document.createElement("span");
  balanceValue.className = "home-screen__chip-value";

  balanceChip.append(boneImg, balanceValue);

  const reputationChip = document.createElement("button");
  reputationChip.type = "button";
  reputationChip.className = "home-screen__chip home-screen__chip--reputation";

  const reputationImg = document.createElement("img");
  reputationImg.className = "home-screen__chip-icon";
  reputationImg.src = reputationIconUrl;
  reputationImg.alt = "";
  reputationImg.width = 24;
  reputationImg.height = 24;
  reputationImg.decoding = "async";

  const reputationValue = document.createElement("span");
  reputationValue.className = "home-screen__chip-value";

  reputationChip.append(reputationImg, reputationValue);

  const profileBtn = document.createElement("button");
  profileBtn.type = "button";
  profileBtn.className = "home-screen__profile home-screen__profile--letter";
  profileBtn.setAttribute("aria-expanded", "false");

  const profileImg = document.createElement("img");
  profileImg.className = "home-screen__profile-img";
  profileImg.alt = "";
  profileImg.width = 48;
  profileImg.height = 48;
  profileImg.decoding = "async";
  profileImg.referrerPolicy = "no-referrer";
  profileImg.hidden = true;

  const profileLetter = document.createElement("span");
  profileLetter.className = "home-screen__profile-letter";
  profileLetter.setAttribute("aria-hidden", "true");
  profileLetter.textContent = "?";

  profileBtn.append(profileImg, profileLetter);

  const profileMenuAnchor = document.createElement("div");
  profileMenuAnchor.className = "home-screen__profile-menu-anchor";

  const contactsModal = createAppModal({
    size: "md",
    showSecondary: false,
    onPrimary: () => {
      window.open(COMMUNITY_CONTACT_URL, "_blank", "noopener,noreferrer");
      void contactsModal.close();
    },
  });

  const accountMenu = createAccountMenu({
    onClose: () => {
      profileBtn.setAttribute("aria-expanded", "false");
    },
    onSettings: () => onOpenSettings?.(),
    onInvite: () => {
      void openMyReferralInvite();
    },
    onContacts: () => {
      const t = getStrings();
      contactsModal.setTitle(t.homeContactsTitle ?? "");
      contactsModal.setDescription(t.homeContactsBody ?? "");
      contactsModal.setPrimaryLabel(t.homeContactsOpen ?? "");
      contactsModal.setCloseAriaLabel(t.homeContactsCloseAria ?? "");
      contactsModal.setActionsVisible({ primary: true, secondary: false });
      contactsModal.open();
    },
    onSignOut: () => onSignOut?.(),
  });

  profileMenuAnchor.append(profileBtn, accountMenu.root);
  topActions.append(reputationChip, balanceChip, profileMenuAnchor);
  topbar.append(mark, topActions);

  const body = document.createElement("div");
  body.className = "home-screen__body";

  const cluster = document.createElement("div");
  cluster.className = "home-screen__cluster";

  const feed = document.createElement("div");
  feed.className = "home-screen__feed";

  const mineFilterPanel = createTabsPanel({
    tabs: [
      { id: "active", label: "" },
      { id: "completed", label: "" },
    ],
    activeId: "active",
    onChange: (id) => {
      setMineFilter(/** @type {MineFilterId} */ (id));
    },
  });
  mineFilterPanel.root.hidden = true;

  const list = document.createElement("ul");
  list.className = "home-screen__list";

  const empty = document.createElement("p");
  empty.className = "home-screen__empty";
  empty.hidden = true;

  feed.append(mineFilterPanel.root, list, empty);

  const ratingView = document.createElement("div");
  ratingView.className = "home-screen__rating";
  ratingView.hidden = true;

  const ratingList = document.createElement("ul");
  ratingList.className = "home-screen__rating-list";

  const ratingEmpty = document.createElement("p");
  ratingEmpty.className = "home-screen__rating-empty";
  ratingEmpty.hidden = true;

  ratingView.append(ratingList, ratingEmpty);

  const legendaryOnlinePanel = createLegendaryOnlinePanel();
  cluster.append(legendaryOnlinePanel.root, feed, ratingView);
  body.append(cluster);

  const reputationBody = document.createElement("p");
  reputationBody.className = "home-screen__reputation-body";

  const noticeModal = createAppModal({
    size: "md",
    showSecondary: false,
    onPrimary: () => {
      void noticeModal.close();
    },
  });

  const reviewIntroSteps = document.createElement("ol");
  reviewIntroSteps.className = "home-screen__review-intro-steps";

  const reviewIntroModal = createAppModal({
    size: "md",
    onPrimary: () => {
      const item = reviewIntroItem;
      void reviewIntroModal.close();
      if (item) {
        void onOpenPortfolio(item);
      }
    },
    onSecondary: () => {
      void reviewIntroModal.close();
    },
    onClose: () => {
      reviewIntroItem = null;
    },
  });
  reviewIntroModal.content.append(reviewIntroSteps);

  const inviteCode = document.createElement("p");
  inviteCode.className = "home-screen__invite-code";
  inviteCode.setAttribute("aria-live", "polite");

  const inviteModal = createAppModal({
    size: "md",
    onPrimary: () => {
      if (!inviteCodeValue) return;
      const t = getStrings();
      void copyInviteText(
        inviteCodeValue,
        "primary",
        t.homeInviteCopyCode,
      );
    },
    onSecondary: () => {
      if (!inviteCodeValue) return;
      const t = getStrings();
      void copyInviteText(
        buildReferralShareUrl(inviteCodeValue),
        "secondary",
        t.homeInviteCopyLink,
      );
    },
  });
  inviteModal.content.append(inviteCode);

  const tabbar = document.createElement("div");
  tabbar.className = "home-screen__tabbar";
  tabbar.setAttribute("role", "tablist");

  const tabThumb = document.createElement("div");
  tabThumb.className = "home-screen__tabbar-thumb";
  tabThumb.setAttribute("aria-hidden", "true");

  const feedTab = document.createElement("button");
  feedTab.type = "button";
  feedTab.className = "home-screen__tab home-screen__tab--active";
  feedTab.setAttribute("role", "tab");
  feedTab.setAttribute("aria-selected", "true");
  feedTab.dataset.tab = "feed";

  const mineTab = document.createElement("button");
  mineTab.type = "button";
  mineTab.className = "home-screen__tab";
  mineTab.setAttribute("role", "tab");
  mineTab.setAttribute("aria-selected", "false");
  mineTab.dataset.tab = "mine";

  const mineTabLabel = document.createElement("span");
  mineTabLabel.className = "home-screen__tab-label";

  /* Точка «есть готовый отчёт 3/3»; текст остаётся в отдельном span. */
  const mineTabDot = document.createElement("span");
  mineTabDot.className = "home-screen__tab-dot";
  mineTabDot.setAttribute("aria-hidden", "true");
  mineTabDot.hidden = true;

  mineTab.append(mineTabLabel, mineTabDot);

  const ratingTab = document.createElement("button");
  ratingTab.type = "button";
  ratingTab.className = "home-screen__tab";
  ratingTab.setAttribute("role", "tab");
  ratingTab.setAttribute("aria-selected", "false");
  ratingTab.dataset.tab = "rating";

  tabbar.append(tabThumb, feedTab, mineTab, ratingTab);

  const tabbarDock = document.createElement("div");
  tabbarDock.className = "home-screen__tabbar-dock";
  tabbarDock.append(tabbar, addBtn);

  root.append(
    title,
    topbar,
    body,
    tabbarDock,
    noticeModal.root,
    reviewIntroModal.root,
    inviteModal.root,
    contactsModal.root,
  );

  /** @type {HomePortfolioItem[]} */
  let items = [];
  /** @type {import("../../api/rating.js").RatingTopItem[]} */
  let ratingItems = [];
  let loading = false;
  /** @type {ReturnType<typeof window.setInterval> | null} */
  let slotsPollId = null;
  /** Показать stagger-reveal при смене списка (не после skeleton — иначе гэп). */
  let revealItems = false;
  /** Только что показывали skeleton ленты — не fade-in с opacity:0. */
  let wasSkeletonLoading = false;
  /** @type {HomeTabId} */
  let activeTab = "feed";
  /** @type {MineFilterId} */
  let mineFilter = "active";
  /**
   * Инкремент при каждом refresh / смене вкладки — отбрасываем устаревшие
   * ответы (полл или предыдущий таб), иначе на секунду мелькает чужой список.
   */
  let refreshEpoch = 0;
  let lastScrollTop = 0;
  /** Непросмотренный готовый отчёт (3/3) → точки на «Мои» и «Завершённые». */
  let mineReady = false;
  let tabbarHidden = false;
  let tabbarOnDark = false;
  let tabbarContrastRaf = 0;
  /** @type {string | null} */
  let tabbarContrastProbeKey = null;
  /**
   * Карточка, ждущая подтверждения в intro-модалке (claim — только по CTA).
   * @type {HomePortfolioItem | null}
   */
  let reviewIntroItem = null;
  /** @type {string | null} */
  let inviteCodeValue = null;
  /** @type {ReturnType<typeof window.setTimeout> | null} */
  let inviteCopyResetId = null;
  /** Нет фото → фон + буква; картинку прячем. */
  function showProfileLetter(letter) {
    const initial = letter && letter !== "?" ? letter : "?";
    profileImg.onload = null;
    profileImg.onerror = null;
    profileImg.removeAttribute("src");
    profileImg.hidden = true;
    profileLetter.textContent = initial;
    profileLetter.hidden = false;
    profileBtn.classList.add("home-screen__profile--letter");
  }

  /**
   * Есть URL → только фото (без буквы); ошибка загрузки → фон + буква.
   * @param {string} src
   * @param {string} letter
   */
  function showProfilePhoto(src, letter) {
    profileLetter.hidden = true;
    profileImg.hidden = false;
    profileBtn.classList.remove("home-screen__profile--letter");
    profileImg.referrerPolicy = "no-referrer";
    profileImg.onload = null;
    profileImg.onerror = () => {
      showProfileLetter(letter);
    };
    profileImg.src = src;
  }

  function syncProfileAvatar() {
    const session = getSession();
    const avatarUrl =
      typeof session?.avatarUrl === "string" ? session.avatarUrl.trim() : "";
    const displayName =
      typeof session?.displayName === "string"
        ? session.displayName.trim()
        : "";
    const email =
      typeof session?.email === "string" ? session.email.trim() : "";
    const telegramUsername =
      typeof session?.telegramUsername === "string"
        ? session.telegramUsername.trim()
        : "";
    const label =
      displayName ||
      telegramUsername ||
      (email && !email.endsWith("@t.me") ? email : "");
    const letter = initialFromLabel(label);

    if (avatarUrl) {
      showProfilePhoto(avatarUrl, letter);
      return;
    }

    showProfileLetter(letter);
  }

  function syncCopy() {
    const t = getStrings();
    title.textContent = t.homeTitle;
    list.setAttribute(
      "aria-label",
      loading
        ? t.homeListLoadingAria
        : activeTab === "mine"
          ? t.homeListMineAria
          : t.homeListAria,
    );
    if (activeTab === "mine") {
      empty.textContent =
        mineFilter === "completed"
          ? (t.homeEmptyMineCompleted ?? t.homeEmptyMine)
          : (t.homeEmptyMineActive ?? t.homeEmptyMine);
    } else {
      empty.textContent = t.homeEmpty;
    }
    feedTab.textContent = t.homeTabFeed;
    mineTabLabel.textContent = t.homeTabMine;
    ratingTab.textContent = t.homeTabRating;
    ratingEmpty.textContent = t.homeRatingEmpty;
    ratingList.setAttribute("aria-label", t.homeRatingListAria);
    syncMineTabAria();
    tabbar.setAttribute("aria-label", t.homeTabsAria);
    mineFilterPanel.setLabels({
      active: t.homeMineFilterActive ?? "",
      completed: t.homeMineFilterCompleted ?? "",
    });
    mineFilterPanel.setAriaLabel(t.homeMineFilterAria ?? "");
    syncMineFilterPanel();
    addBtn.setAttribute("aria-label", t.homeAddPortfolio);
    addBtn.title = t.homeAddPortfolio;

    const balance = getBalance();
    balanceValue.textContent = String(balance);
    balanceChip.setAttribute(
      "aria-label",
      formatString(t.homeBalanceAria, { balance }),
    );
    balanceChip.title = formatString(t.homeBalance, { balance });

    const reputationDelta = formatReputationDelta();
    reputationValue.textContent = reputationDelta;
    reputationChip.setAttribute(
      "aria-label",
      formatString(t.homeReputationAria, { reputation: reputationDelta }),
    );
    reputationChip.title = formatString(t.homeReputation, {
      reputation: reputationDelta,
    });

    profileBtn.setAttribute("aria-label", t.homeProfileAria);
    profileBtn.setAttribute("aria-haspopup", "menu");
    accountMenu.syncContent();

    legendaryOnlinePanel.syncCopy();
    syncProfileAvatar();
    scheduleTabThumbSync();
  }

  function openSubmitLockedModal() {
    const t = getStrings();
    noticeModal.content.replaceChildren();
    noticeModal.setTitle(t.homeSubmitLockedTitle ?? "");
    noticeModal.setDescription(t.homeSubmitLocked ?? "");
    noticeModal.setPrimaryLabel(t.homeSubmitLockedClose ?? "");
    noticeModal.setCloseAriaLabel(t.homeSubmitLockedCloseAria ?? "");
    noticeModal.setActionsVisible({ primary: true, secondary: false });
    noticeModal.open();
  }

  /**
   * Универсальный диалог (нет слотов / locked submit и т.п.).
   * @param {{
   *   title: string;
   *   body: string;
   *   closeLabel?: string;
   *   closeAria?: string;
   * }} opts
   */
  function showNotice(opts) {
    const t = getStrings();
    noticeModal.content.replaceChildren();
    noticeModal.setTitle(opts.title);
    noticeModal.setDescription(opts.body);
    noticeModal.setPrimaryLabel(opts.closeLabel || t.homeSubmitLockedClose);
    noticeModal.setCloseAriaLabel(
      opts.closeAria || opts.closeLabel || t.homeSubmitLockedCloseAria || "",
    );
    noticeModal.setActionsVisible({ primary: true, secondary: false });
    noticeModal.open();
  }

  function closeSubmitLockedModal() {
    void noticeModal.close();
  }

  /**
   * Свежие данные карточки: после silent-патча слотов closure в обработчике
   * клика держит устаревший item.
   *
   * @param {string} id
   * @returns {HomePortfolioItem | null}
   */
  function latestItem(id) {
    if (!id) return null;
    return items.find((entry) => entry.id === id) ?? null;
  }

  /**
   * Промежуточный шаг перед claim: что будет на `/review` + CTA «Проревьюить».
   *
   * @param {HomePortfolioItem} item
   */
  function openReviewIntro(item) {
    const t = getStrings();
    reviewIntroItem = item;
    const steps = [
      formatString(t.homeReviewIntroStep1, { seconds: REVIEW_SESSION_SECONDS }),
      t.homeReviewIntroStep2,
      t.homeReviewIntroStep3,
      t.homeReviewIntroStep4,
    ];
    reviewIntroSteps.replaceChildren();
    reviewIntroSteps.setAttribute("aria-label", t.homeReviewIntroStepsAria ?? "");
    for (const text of steps) {
      const step = document.createElement("li");
      step.className = "home-screen__review-intro-step";
      step.textContent = text ?? "";
      reviewIntroSteps.append(step);
    }
    reviewIntroModal.setTitle(t.homeReviewIntroTitle ?? "");
    reviewIntroModal.setDescription(t.homeReviewIntroBody ?? "");
    reviewIntroModal.setPrimaryLabel(t.homeReviewIntroStart ?? "");
    reviewIntroModal.setSecondaryLabel(t.homeReviewIntroCancel ?? "");
    reviewIntroModal.setCloseAriaLabel(t.homeReviewIntroCloseAria ?? "");
    reviewIntroModal.setActionsVisible({ primary: true, secondary: true });
    reviewIntroModal.open();
  }

  function closeReviewIntroModal() {
    reviewIntroItem = null;
    void reviewIntroModal.close();
  }

  /**
   * Число ревьюеров, которых ждёт автор, и сколько уже сдали отчёт.
   *
   * @param {HomePortfolioItem} item
   * @returns {{ completed: number; total: number; ready: boolean }}
   */
  function reportProgress(item) {
    const total = Math.max(1, Number(item.targetReviews) || 1);
    const completed = Math.max(0, Number(item.reviewsCount) || 0);
    return { completed, total, ready: completed >= total };
  }

  /**
   * Своя карточка: отчёт — только когда собраны все ревью, иначе модалка.
   *
   * @param {HomePortfolioItem} item
   */
  function openOwnCard(item) {
    const { completed, total, ready } = reportProgress(item);
    if (ready) {
      void onOpenReport?.(item);
      return;
    }
    const t = getStrings();
    showNotice({
      title: t.homeMineNotReadyTitle,
      body: formatString(t.homeMineNotReadyBody, { completed, total }),
      closeLabel: t.homeMineNotReadyClose,
      closeAria: t.homeMineNotReadyCloseAria,
    });
  }

  /**
   * @param {HTMLElement} button
   * @param {HomePortfolioItem} item
   */
  function syncOwnCardCopy(button, item) {
    const t = getStrings();
    const { ready } = reportProgress(item);
    button.title = ready ? t.homeCardReportTitle : t.homeCardReportPendingTitle;
    button.setAttribute(
      "aria-label",
      ready ? t.homeCardReportAria : t.homeCardReportPendingAria,
    );
  }

  function closeInviteModal() {
    if (inviteCopyResetId != null) {
      window.clearTimeout(inviteCopyResetId);
      inviteCopyResetId = null;
    }
    void inviteModal.close();
  }

  function closeAccountMenu() {
    profileBtn.setAttribute("aria-expanded", "false");
    return accountMenu.close();
  }

  /**
   * @param {{
   *   code: string | null;
   *   slotsLeft: number;
   *   maxUses: number;
   * }} info
   */
  function openInviteModal(info) {
    const t = getStrings();
    inviteCodeValue = info.code;
    inviteModal.setTitle(t.homeInviteTitle ?? "");
    inviteModal.setDescription(
      info.code
        ? formatString(t.homeInviteBody, {
            left: info.slotsLeft,
            max: info.maxUses,
          })
        : (t.homeInviteEmpty ?? ""),
    );
    inviteCode.textContent = info.code || "—";
    inviteCode.hidden = !info.code;
    inviteModal.setPrimaryLabel(t.homeInviteCopyCode ?? "");
    inviteModal.setSecondaryLabel(t.homeInviteCopyLink ?? "");
    inviteModal.setCloseAriaLabel(t.homeInviteCloseAria ?? "");
    inviteModal.setActionsVisible({
      primary: Boolean(info.code),
      secondary: Boolean(info.code),
    });
    inviteModal.open();
  }

  /**
   * @param {string} text
   * @param {"primary" | "secondary"} which
   * @param {string} idleLabel
   */
  async function copyInviteText(text, which, idleLabel) {
    const t = getStrings();
    const setLabel =
      which === "primary"
        ? inviteModal.setPrimaryLabel
        : inviteModal.setSecondaryLabel;
    try {
      await navigator.clipboard.writeText(text);
      setLabel(t.homeInviteCopied ?? "");
      if (inviteCopyResetId != null) window.clearTimeout(inviteCopyResetId);
      inviteCopyResetId = window.setTimeout(() => {
        setLabel(idleLabel);
        inviteCopyResetId = null;
      }, 1600);
    } catch {
      setLabel(idleLabel);
    }
  }

  async function openMyReferralInvite() {
    const session = getSession() ?? {};
    let code =
      typeof session.myReferralCode === "string" ? session.myReferralCode : null;
    let uses =
      typeof session.referralUses === "number" ? session.referralUses : 0;

    const remote = await fetchMyReferral();
    if (remote) {
      code = remote.code;
      uses = remote.uses;
      setSession({
        ...session,
        myReferralCode: remote.code,
        referralUses: remote.uses,
      });
    }

    openInviteModal({
      code,
      slotsLeft: Math.max(0, REFERRAL_MAX_USES - uses),
      maxUses: REFERRAL_MAX_USES,
    });
  }

  /**
   * @param {boolean} hidden
   */
  function setTabbarHidden(hidden) {
    if (tabbarHidden === hidden) return;
    tabbarHidden = hidden;
    tabbarDock.classList.toggle("home-screen__tabbar-dock--hidden", hidden);
    if (!hidden) {
      scheduleTabbarContrastSync();
    }
  }

  function showTabbar() {
    setTabbarHidden(false);
  }

  /**
   * @param {boolean} onDark
   */
  function setTabbarOnDark(onDark) {
    if (tabbarOnDark === onDark) return;
    tabbarOnDark = onDark;
    tabbar.classList.toggle("home-screen__tabbar--on-dark", onDark);
  }

  /**
   * Адаптивный контраст таббара по яркости фона под ним.
   * @returns {void}
   */
  function syncTabbarContrast() {
    if (root.hidden || tabbarHidden) return;
    const { luma, pendingSrcs } = sampleBackdropLuminance(tabbar);
    setTabbarOnDark(luma < BACKDROP_DARK_LUMA);
    if (!pendingSrcs.length) return;
    const key = pendingSrcs.slice().sort().join("\0");
    if (key === tabbarContrastProbeKey) return;
    tabbarContrastProbeKey = key;
    void resolveImageLumaProbes(pendingSrcs).then((updated) => {
      if (key === tabbarContrastProbeKey) {
        tabbarContrastProbeKey = null;
      }
      if (updated) {
        scheduleTabbarContrastSync();
      }
    });
  }

  function scheduleTabbarContrastSync() {
    if (tabbarContrastRaf) return;
    tabbarContrastRaf = requestAnimationFrame(() => {
      tabbarContrastRaf = 0;
      syncTabbarContrast();
    });
  }

  function syncMineTabAria() {
    const t = getStrings();
    if (mineReady) {
      mineTab.setAttribute("aria-label", t.homeTabMineReadyAria ?? t.homeTabMine);
      return;
    }
    mineTab.removeAttribute("aria-label");
  }

  /**
   * @param {boolean} next
   */
  function setMineReady(next) {
    if (mineReady === next) return;
    mineReady = next;
    mineTabDot.hidden = !next;
    mineFilterPanel.setTabDot("completed", next);
    syncMineTabAria();
  }

  function syncMineFilterPanel() {
    const wasHidden = mineFilterPanel.root.hidden;
    mineFilterPanel.root.hidden = activeTab !== "mine";
    if (wasHidden && !mineFilterPanel.root.hidden) {
      requestAnimationFrame(() => {
        mineFilterPanel.syncThumb(true);
      });
    }
  }

  function syncActiveView() {
    const isRating = activeTab === "rating";
    feed.hidden = isRating;
    ratingView.hidden = !isRating;
  }

  /**
   * Текущий вид наверх (main.js пишет его в URL). Экран сам history не трогает.
   *
   * @param {'tab' | 'filter'} reason
   */
  function emitViewChange(reason) {
    onViewChange?.({ tab: activeTab, filter: mineFilter, reason });
  }

  /**
   * @param {MineFilterId} next
   * @param {{ silent?: boolean }} [opts]
   */
  function setMineFilter(next, opts = {}) {
    if (mineFilter === next) return;
    mineFilter = next;
    mineFilterPanel.setActive(next);
    body.scrollTop = 0;
    lastScrollTop = 0;
    if (next === "completed") {
      acknowledgeMineReady(readyOwnCardIds(items));
    }
    syncCopy();
    renderList();
    if (!opts.silent) emitViewChange("filter");
  }

  /**
   * На `mine` режет список по Активные/Завершённые; на `feed` — как есть.
   *
   * @param {HomePortfolioItem[]} listItems
   * @returns {HomePortfolioItem[]}
   */
  function visibleFor(listItems) {
    const source = Array.isArray(listItems) ? listItems : [];
    if (activeTab !== "mine") return source;
    return source.filter((item) => {
      const completed = isCompletedOwnItem(item);
      return mineFilter === "completed" ? completed : !completed;
    });
  }

  /**
   * @param {HomeTabId} tab
   */
  function syncTabButtons(tab) {
    const isFeed = tab === "feed";
    const isMine = tab === "mine";
    const isRating = tab === "rating";
    feedTab.classList.toggle("home-screen__tab--active", isFeed);
    mineTab.classList.toggle("home-screen__tab--active", isMine);
    ratingTab.classList.toggle("home-screen__tab--active", isRating);
    feedTab.setAttribute("aria-selected", isFeed ? "true" : "false");
    mineTab.setAttribute("aria-selected", isMine ? "true" : "false");
    ratingTab.setAttribute("aria-selected", isRating ? "true" : "false");
    syncTabThumb();
  }

  /** Скользящий пилл активного таба (ширина/смещение по layout). */
  function syncTabThumb(instant = false) {
    const activeEl =
      activeTab === "mine"
        ? mineTab
        : activeTab === "rating"
          ? ratingTab
          : feedTab;
    const barRect = tabbar.getBoundingClientRect();
    const tabRect = activeEl.getBoundingClientRect();
    if (!barRect.width || !tabRect.width) return;
    const left = tabRect.left - barRect.left;
    if (instant) {
      tabThumb.style.transition = "none";
    }
    tabThumb.style.width = `${tabRect.width}px`;
    tabThumb.style.transform = `translateX(${left}px)`;
    if (instant) {
      void tabThumb.offsetWidth;
      tabThumb.style.transition = "";
    }
  }

  /**
   * @param {boolean} [instant]
   */
  function scheduleTabThumbSync(instant = false) {
    requestAnimationFrame(() => {
      syncTabThumb(instant);
    });
  }

  /**
   * @param {HomeTabId} tab
   * @param {{ silent?: boolean }} [opts]
   */
  async function setActiveTab(tab, opts = {}) {
    if (activeTab === tab) return;
    activeTab = tab;
    refreshEpoch += 1;
    syncTabButtons(tab);
    syncMineFilterPanel();
    syncActiveView();
    showTabbar();
    body.scrollTop = 0;
    lastScrollTop = 0;
    syncCopy();
    if (!opts.silent) emitViewChange("tab");
    if (showTabFromCache(tab)) {
      void refresh();
      return;
    }
    setLoading(true);
    await refresh();
  }

  /**
   * @param {unknown} value
   * @param {HomeTabId} fallback
   * @returns {HomeTabId}
   */
  function normalizeTab(value, fallback) {
    return HOME_TAB_IDS.includes(/** @type {HomeTabId} */ (value))
      ? /** @type {HomeTabId} */ (value)
      : fallback;
  }

  /**
   * @param {unknown} value
   * @param {MineFilterId} fallback
   * @returns {MineFilterId}
   */
  function normalizeFilter(value, fallback) {
    return MINE_FILTER_IDS.includes(/** @type {MineFilterId} */ (value))
      ? /** @type {MineFilterId} */ (value)
      : fallback;
  }

  /**
   * Состояние вида без refetch — для `open()`, который сам тянет данные.
   *
   * @param {{ tab?: HomeTabId; filter?: MineFilterId }} [view]
   */
  function applyViewState(view = {}) {
    const nextTab = normalizeTab(view.tab, activeTab);
    const nextFilter =
      nextTab === "mine"
        ? normalizeFilter(view.filter, mineFilter)
        : DEFAULT_MINE_FILTER;

    if (activeTab !== nextTab) {
      activeTab = nextTab;
      refreshEpoch += 1;
    }
    if (mineFilter !== nextFilter) {
      mineFilter = nextFilter;
      mineFilterPanel.setActive(nextFilter, { instant: true });
    }
  }

  /**
   * Применить вид снаружи (deep link / Back-Forward) — без эха в URL.
   *
   * @param {{ tab?: HomeTabId; filter?: MineFilterId }} [view]
   * @returns {Promise<void>}
   */
  async function setView(view = {}) {
    const nextTab = normalizeTab(view.tab, activeTab);
    const nextFilter =
      nextTab === "mine"
        ? normalizeFilter(view.filter, mineFilter)
        : DEFAULT_MINE_FILTER;

    // Фильтр до вкладки: renderList внутри setActiveTab уже режет по нему.
    if (nextTab === activeTab) {
      setMineFilter(nextFilter, { silent: true });
      return;
    }
    if (mineFilter !== nextFilter) {
      mineFilter = nextFilter;
      mineFilterPanel.setActive(nextFilter, { instant: true });
    }
    await setActiveTab(nextTab, { silent: true });
  }

  /**
   * @returns {HTMLLIElement}
   */
  function createSkeletonCard() {
    const li = document.createElement("li");
    li.className = "home-screen__item home-screen__item--skeleton";
    li.setAttribute("aria-hidden", "true");

    const card = document.createElement("div");
    card.className = "home-screen__card home-screen__card--skeleton";

    const preview = document.createElement("div");
    preview.className = "home-screen__preview home-screen__preview--skeleton";

    const meta = document.createElement("div");
    meta.className = "home-screen__card-meta home-screen__card-meta--skeleton";

    const person = document.createElement("div");
    person.className = "home-screen__card-person home-screen__card-person--skeleton";

    const badges = document.createElement("div");
    badges.className = "home-screen__skeleton-badges";

    const platformBone = document.createElement("div");
    platformBone.className =
      "home-screen__skeleton-badge home-screen__skeleton-badge--platform";
    const avatarBone = document.createElement("div");
    avatarBone.className =
      "home-screen__skeleton-badge home-screen__skeleton-badge--avatar";
    badges.append(platformBone, avatarBone);

    const gradeBone = document.createElement("div");
    gradeBone.className =
      "home-screen__skeleton-line home-screen__skeleton-line--grade";

    person.append(badges, gradeBone);

    const progress = document.createElement("div");
    progress.className = "home-screen__skeleton-progress";

    meta.append(person, progress);
    card.append(preview, meta);
    li.append(card);
    return li;
  }

  function renderSkeleton() {
    list.replaceChildren();
    empty.hidden = true;
    for (let i = 0; i < SKELETON_CARD_COUNT; i += 1) {
      list.append(createSkeletonCard());
    }
  }

  /**
   * @returns {HTMLLIElement}
   */
  function createRatingSkeletonCard() {
    const li = document.createElement("li");
    li.className = "home-screen__rating-item";
    li.setAttribute("aria-hidden", "true");

    const card = document.createElement("div");
    card.className =
      "home-screen__rating-card home-screen__rating-card--skeleton";

    const avatar = document.createElement("span");
    avatar.className =
      "home-screen__rating-avatar home-screen__rating-avatar--skeleton";

    const text = document.createElement("div");
    text.className = "home-screen__rating-text";

    const lineName = document.createElement("div");
    lineName.className =
      "home-screen__rating-line home-screen__rating-line--name";

    const lineRole = document.createElement("div");
    lineRole.className =
      "home-screen__rating-line home-screen__rating-line--role";

    text.append(lineName, lineRole);

    const balance = document.createElement("span");
    balance.className =
      "home-screen__rating-balance home-screen__rating-balance--skeleton";

    card.append(avatar, text, balance);
    li.append(card);
    return li;
  }

  function renderRatingSkeleton() {
    ratingList.replaceChildren();
    ratingList.hidden = false;
    ratingEmpty.hidden = true;
    for (let i = 0; i < RATING_SKELETON_CARD_COUNT; i += 1) {
      ratingList.append(createRatingSkeletonCard());
    }
  }

  /**
   * Карточка топ-50 (Figma RaitingCard): аватар + место, имя/роль, баланс.
   *
   * @param {import("../../api/rating.js").RatingTopItem} item
   * @returns {HTMLLIElement}
   */
  function createRatingCard(item) {
    const t = getStrings();
    const li = document.createElement("li");
    li.className = "home-screen__rating-item";

    const card = document.createElement("div");
    card.className = "home-screen__rating-card";

    const avatar = document.createElement("span");
    avatar.className = "home-screen__rating-avatar";

    const name = item.displayName || t.homeRatingNameFallback;
    const letter = initialFromLabel(name);
    const avatarSrc =
      typeof item.avatarUrl === "string" ? item.avatarUrl.trim() : "";

    if (avatarSrc) {
      const img = document.createElement("img");
      img.className = "home-screen__rating-avatar-img";
      img.alt = "";
      img.width = 52;
      img.height = 52;
      img.decoding = "async";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => {
        img.remove();
        avatar.classList.add("home-screen__rating-avatar--letter");
        const letterEl = document.createElement("span");
        letterEl.className = "home-screen__rating-avatar-letter";
        letterEl.textContent = letter;
        letterEl.setAttribute("aria-hidden", "true");
        avatar.append(letterEl);
      });
      img.src = avatarSrc;
      avatar.append(img);
    } else {
      avatar.classList.add("home-screen__rating-avatar--letter");
      const letterEl = document.createElement("span");
      letterEl.className = "home-screen__rating-avatar-letter";
      letterEl.textContent = letter;
      letterEl.setAttribute("aria-hidden", "true");
      avatar.append(letterEl);
    }

    const place = document.createElement("span");
    place.className = "home-screen__rating-place";
    place.textContent = String(item.place);
    place.setAttribute(
      "aria-label",
      formatString(t.homeRatingPlaceAria, { place: item.place }),
    );
    avatar.append(place);

    const text = document.createElement("div");
    text.className = "home-screen__rating-text";

    const nameEl = document.createElement("p");
    nameEl.className = "home-screen__rating-name";
    nameEl.textContent = name;

    const roleEl = document.createElement("p");
    roleEl.className = "home-screen__rating-role";
    roleEl.textContent =
      formatPortfolioRole(item.grade, item.role) || t.homeDefaultRole;

    text.append(nameEl, roleEl);

    const balance = document.createElement("span");
    balance.className = "home-screen__rating-balance";
    balance.textContent = Number(item.balance).toLocaleString(getLocale());
    balance.setAttribute(
      "aria-label",
      formatString(t.homeRatingBalanceAria, { balance: item.balance }),
    );

    card.append(avatar, text, balance);
    li.append(card);
    return li;
  }

  function renderRatingList() {
    ratingList.replaceChildren();
    const hasItems = ratingItems.length > 0;
    ratingList.hidden = !hasItems;
    ratingEmpty.hidden = hasItems;
    for (const item of ratingItems) {
      ratingList.append(createRatingCard(item));
    }
    scheduleTabbarContrastSync();
  }

  /**
   * @param {boolean} next
   */
  function setLoading(next) {
    loading = next;
    if (loading) {
      wasSkeletonLoading = true;
    }
    root.setAttribute("aria-busy", loading ? "true" : "false");
    const t = getStrings();
    list.setAttribute(
      "aria-label",
      loading
        ? t.homeListLoadingAria
        : activeTab === "mine"
          ? t.homeListMineAria
          : t.homeListAria,
    );
    if (loading) {
      if (activeTab === "rating") {
        renderRatingSkeleton();
        return;
      }
      renderSkeleton();
    }
  }

  /**
   * @param {HomePortfolioItem} item
   * @returns {HTMLLIElement}
   */
  function createCard(item) {
    const t = getStrings();
    const li = document.createElement("li");
    li.className = "home-screen__item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "home-screen__card";

    const preview = document.createElement("div");
    preview.className = "home-screen__preview home-screen__preview--loading";

    const previewBrowser = document.createElement("div");
    previewBrowser.className = "home-screen__preview-browser";

    const previewBrowserBar = document.createElement("div");
    previewBrowserBar.className = "home-screen__preview-browser-bar";
    previewBrowserBar.setAttribute("aria-hidden", "true");

    const previewBrowserControls = document.createElement("img");
    previewBrowserControls.className = "home-screen__preview-browser-controls";
    previewBrowserControls.alt = "";
    previewBrowserControls.src = PREVIEW_BROWSER_CONTROLS_URL;
    previewBrowserBar.append(previewBrowserControls);

    const previewBrowserViewport = document.createElement("div");
    previewBrowserViewport.className = "home-screen__preview-browser-viewport";

    const previewImg = document.createElement("img");
    previewImg.className = "home-screen__preview-img";
    previewImg.alt = "";
    previewImg.decoding = "async";
    previewImg.loading = "lazy";
    previewImg.referrerPolicy = "no-referrer";

    const previewSrc =
      Array.isArray(item.previewUrls) && item.previewUrls[0]
        ? item.previewUrls[0]
        : portfolioPreviewUrl(item.url);
    previewImg.src = previewSrc;
    previewImg.addEventListener("load", () => {
      preview.classList.remove("home-screen__preview--loading");
      preview.classList.add("home-screen__preview--ready");
      scheduleTabbarContrastSync();
    });
    previewImg.addEventListener("error", () => {
      previewImg.remove();
      preview.classList.remove("home-screen__preview--loading");
      preview.classList.remove("home-screen__preview--ready");
      preview.classList.add("home-screen__preview--empty");
      scheduleTabbarContrastSync();
    });
    previewBrowserViewport.append(previewImg);
    previewBrowser.append(previewBrowserBar, previewBrowserViewport);
    preview.append(previewBrowser);

    if (item.reviewedByMe) {
      const reviewed = document.createElement("div");
      reviewed.className = "home-screen__preview-reviewed";
      reviewed.setAttribute("aria-hidden", "true");

      const chip = document.createElement("span");
      chip.className = "home-screen__preview-reviewed-chip";

      const label = document.createElement("p");
      label.className = "home-screen__preview-reviewed-label";
      label.setAttribute("data-i18n", "homeCardReviewedLabel");
      label.textContent = t.homeCardReviewedLabel ?? "";

      chip.append(createReviewedCheckIcon(), label);
      reviewed.append(chip);
      preview.append(reviewed);
    }

    const meta = document.createElement("div");
    meta.className = "home-screen__card-meta";

    const person = document.createElement("div");
    person.className = "home-screen__card-person";

    const badges = document.createElement("div");
    badges.className = "home-screen__card-badges";

    const platform = document.createElement("span");
    platform.className = "home-screen__badge home-screen__badge--platform";
    const platformIcon = resolvePlatformIcon(item.url);
    if (!platformIcon) {
      platform.hidden = true;
    } else if (platformIcon.kind === "web") {
      platform.classList.add("home-screen__badge--web");
      const letter = document.createElement("span");
      letter.className = "home-screen__badge-letter";
      letter.textContent = t.homePlatformWebLetter;
      letter.setAttribute("aria-hidden", "true");
      platform.append(letter);
    } else {
      const platformImg = document.createElement("img");
      platformImg.className = "home-screen__badge-img";
      platformImg.alt = "";
      platformImg.width = 32;
      platformImg.height = 32;
      platformImg.decoding = "async";
      platformImg.loading = "lazy";
      platformImg.referrerPolicy = "no-referrer";
      platformImg.src = platformIcon.src;
      bindImageFallbacks(platformImg, platformIcon.fallbacks);
      platform.append(platformImg);
    }

    const avatar = document.createElement("span");
    avatar.className = "home-screen__badge home-screen__badge--avatar";
    const personName = item.name || item.url;
    const letter = initialFromLabel(personName);
    const avatarSrc =
      typeof item.avatarUrl === "string" ? item.avatarUrl.trim() : "";

    if (avatarSrc) {
      const avatarImg = document.createElement("img");
      avatarImg.className = "home-screen__badge-img";
      avatarImg.alt = "";
      avatarImg.width = 32;
      avatarImg.height = 32;
      avatarImg.decoding = "async";
      avatarImg.loading = "lazy";
      avatarImg.referrerPolicy = "no-referrer";
      avatarImg.addEventListener("error", () => {
        avatarImg.remove();
        avatar.classList.add("home-screen__badge--letter");
        const letterEl = document.createElement("span");
        letterEl.className = "home-screen__badge-letter";
        letterEl.textContent = letter;
        letterEl.setAttribute("aria-hidden", "true");
        avatar.append(letterEl);
      });
      avatarImg.src = avatarSrc;
      avatar.append(avatarImg);
    } else {
      avatar.classList.add("home-screen__badge--letter");
      const letterEl = document.createElement("span");
      letterEl.className = "home-screen__badge-letter";
      letterEl.textContent = letter;
      letterEl.setAttribute("aria-hidden", "true");
      avatar.append(letterEl);
    }

    badges.append(platform, avatar);

    const grade = document.createElement("p");
    grade.className = "home-screen__card-grade";
    grade.textContent = gradeFromPortfolioRole(item.role) || t.homeDefaultRole;

    person.append(badges, grade);

    const progress = document.createElement("div");
    progress.className = "home-screen__card-progress";

    const slots = document.createElement("div");
    slots.className = "home-screen__reviewer-slots";
    fillReviewerSlots(slots, item);
    progress.append(slots);

    meta.append(person, progress);
    button.append(preview, meta);

    if (item.isOwn) {
      button.classList.add("home-screen__card--own");
      syncOwnCardCopy(button, item);
      button.addEventListener("click", () => {
        openOwnCard(latestItem(item.id) ?? item);
      });
    } else if (item.reviewedByMe) {
      // Только после submit отчёта (`reviews` row), не claim / abort.
      button.classList.add("home-screen__card--reviewed");
      button.disabled = true;
      button.title = t.homeCardReviewedLabel ?? t.homeAlreadyReviewedTitle;
      button.setAttribute(
        "aria-label",
        t.homeCardReviewedLabel ?? t.homeAlreadyReviewedTitle,
      );
    } else {
      button.addEventListener("click", () => {
        openReviewIntro(latestItem(item.id) ?? item);
      });
    }

    li.dataset.portfolioId = item.id;
    li.append(button);
    return li;
  }

  /**
   * @param {{
   *   revealNewOnly?: boolean;
   *   prevIds?: Set<string>;
   * }} [opts]
   */
  function renderList(opts = {}) {
    const revealNewOnly = opts.revealNewOnly === true;
    const prevIds = opts.prevIds instanceof Set ? opts.prevIds : null;
    const visible = visibleFor(items);
    list.replaceChildren();
    empty.hidden = visible.length > 0;
    const t = getStrings();
    list.setAttribute(
      "aria-label",
      activeTab === "mine" ? t.homeListMineAria : t.homeListAria,
    );

    for (const [index, item] of visible.entries()) {
      const li = createCard(item);
      const isNew =
        revealNewOnly && prevIds != null && item.id && !prevIds.has(item.id);
      // Не стартуем с opacity:0 после скелетона — иначе гэп/скачок.
      if ((revealItems && !wasSkeletonLoading) || isNew) {
        li.classList.add("motion-reveal");
        li.style.setProperty(
          "--reveal-delay",
          `calc(var(--motion-stagger) * ${index})`,
        );
      }
      list.append(li);
    }
    wasSkeletonLoading = false;
    revealItems = false;
    scheduleTabbarContrastSync();
  }

  /**
   * @param {HomePortfolioItem[]} nextItems
   */
  function patchListSlots(nextItems) {
    const visible = visibleFor(nextItems);
    const children = [...list.children];
    for (let i = 0; i < visible.length; i += 1) {
      const li = children[i];
      if (!(li instanceof HTMLElement)) continue;
      const item = visible[i];
      const slots = li.querySelector(".home-screen__reviewer-slots");
      if (slots instanceof HTMLElement) {
        fillReviewerSlots(slots, item);
      }
      /* `canPatchListSlots` держит isOwn-паритет → класс = своя карточка. */
      const ownCard = li.querySelector(".home-screen__card--own");
      if (ownCard instanceof HTMLElement) {
        syncOwnCardCopy(ownCard, item);
      }
    }
    empty.hidden = visible.length > 0;
    scheduleTabbarContrastSync();
  }

  /**
   * Показать кэш вкладки без skeleton. `[]` — валидный hit.
   * @param {HomeTabId} tab
   * @returns {boolean}
   */
  function showTabFromCache(tab) {
    const userId = getSession()?.userId;
    const cached = getCachedHomeList(userId, tab);
    if (cached == null) return false;
    loading = false;
    revealItems = false;
    wasSkeletonLoading = false;
    root.setAttribute("aria-busy", "false");
    if (tab === "rating") {
      ratingItems = /** @type {import("../../api/rating.js").RatingTopItem[]} */ (
        cached
      );
      renderRatingList();
      return true;
    }
    const t = getStrings();
    list.setAttribute(
      "aria-label",
      tab === "mine" ? t.homeListMineAria : t.homeListAria,
    );
    items = /** @type {HomePortfolioItem[]} */ (cached);
    if (tab === "mine") {
      syncMineReadyFromIds(readyOwnCardIds(items));
    }
    renderList();
    return true;
  }

  /**
   * Открыли «Завершённые»: текущие готовые id считаются просмотренными,
   * точки на «Мои» и на сегменте гаснут.
   *
   * @param {string[]} readyIds
   */
  function acknowledgeMineReady(readyIds) {
    markMineReadySeen(getSession()?.userId, readyIds);
    setMineReady(false);
  }

  /**
   * Точки по unseen 3/3; если уже на «Завершённые» — сразу acknowledge.
   *
   * @param {string[]} readyIds
   */
  function syncMineReadyFromIds(readyIds) {
    if (activeTab === "mine" && mineFilter === "completed") {
      acknowledgeMineReady(readyIds);
      return;
    }
    setMineReady(hasUnseenMineReady(getSession()?.userId, readyIds));
  }

  /** Точка на «Мои» / «Завершённые»: непросмотренный 3/3. */
  async function refreshMineReady(epoch, tab, mineItems) {
    if (tab === "mine") {
      if (epoch === refreshEpoch) {
        syncMineReadyFromIds(readyOwnCardIds(mineItems));
      }
      return;
    }
    const readyIds = await listReadyOwnReportIds();
    if (epoch === refreshEpoch) {
      setMineReady(hasUnseenMineReady(getSession()?.userId, readyIds));
    }
  }

  /**
   * @param {HomePortfolioItem[]} next
   * @param {{ silent?: boolean }} [opts]
   */
  function setItems(next, opts = {}) {
    const nextItems = Array.isArray(next) ? next : [];
    const silent = opts.silent === true;
    const prevVisible = visibleFor(items);
    const nextVisible = visibleFor(nextItems);
    if (
      silent &&
      !loading &&
      !list.querySelector(".home-screen__item--skeleton") &&
      canPatchListSlots(prevVisible, nextVisible)
    ) {
      items = nextItems;
      patchListSlots(nextItems);
      return;
    }
    const prevIds = new Set(prevVisible.map((item) => item.id).filter(Boolean));
    const hadRenderedItems =
      silent &&
      prevVisible.length > 0 &&
      !list.querySelector(".home-screen__item--skeleton");
    items = nextItems;
    renderList({
      revealNewOnly: hadRenderedItems,
      prevIds,
    });
  }

  async function refresh() {
    const epoch = ++refreshEpoch;
    const tab = activeTab;
    await refreshWalletFromServer();
    if (epoch !== refreshEpoch) return;
    syncCopy();

    const onlineLegendariesPromise = listOnlineLegendaries();

    if (tab === "rating") {
      const top = await listRatingTop();
      if (epoch === refreshEpoch) {
        loading = false;
        root.setAttribute("aria-busy", "false");
        // null = ошибка RPC — не затираем кэш пустым списком
        if (top != null) {
          setCachedHomeList(getSession()?.userId, tab, top);
          ratingItems = top;
          renderRatingList();
        } else if (ratingItems.length === 0) {
          ratingEmpty.hidden = false;
          ratingList.hidden = true;
        }
      }
      const online = await onlineLegendariesPromise;
      if (epoch === refreshEpoch) {
        legendaryOnlinePanel.setItems(online);
      }
      return;
    }
    const next =
      tab === "mine"
        ? await listMyPortfolios()
        : await listPortfoliosForReview();
    if (epoch !== refreshEpoch) return;
    const wasLoading = loading;
    revealItems = wasLoading;
    loading = false;
    root.setAttribute("aria-busy", "false");
    setCachedHomeList(getSession()?.userId, tab, next);
    setItems(next, { silent: !wasLoading });
    await refreshMineReady(epoch, tab, next);

    const online = await onlineLegendariesPromise;
    if (epoch === refreshEpoch) {
      legendaryOnlinePanel.setItems(online);
    }
  }

  function stopSlotsPoll() {
    if (slotsPollId != null) {
      window.clearInterval(slotsPollId);
      slotsPollId = null;
    }
  }

  function startSlotsPoll() {
    stopSlotsPoll();
    slotsPollId = window.setInterval(() => {
      if (root.hidden || document.visibilityState !== "visible" || loading) {
        return;
      }
      void refresh();
    }, HOME_SLOTS_POLL_MS);
  }

  /**
   * @param {{ tab?: HomeTabId; filter?: MineFilterId }} [view]
   *   Явный вид от main.js; иначе читаем текущий query (deep link / reload).
   */
  async function open(view) {
    applyViewState(
      view ??
        parseHomeView(
          typeof window !== "undefined" ? window.location.search : "",
        ),
    );
    root.hidden = false;
    root.classList.remove("home-screen--open");
    syncTabButtons(activeTab);
    syncMineFilterPanel();
    syncActiveView();
    showTabbar();
    lastScrollTop = 0;
    body.scrollTop = 0;
    syncCopy();
    setMineReady(
      hasUnseenMineReady(
        getSession()?.userId,
        readyOwnCardIds(
          /** @type {HomePortfolioItem[] | null} */ (
            getCachedHomeList(getSession()?.userId, "mine")
          ),
        ),
      ),
    );
    if (!showTabFromCache(activeTab)) {
      setLoading(true);
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("home-screen--open");
        scheduleTabThumbSync(true);
        scheduleTabbarContrastSync();
      });
    });
    await refresh();
    startSlotsPoll();
    scheduleTabThumbSync(true);
    scheduleTabbarContrastSync();
  }

  /**
   * @returns {Promise<void>}
   */
  function close() {
    stopSlotsPoll();
    refreshEpoch += 1;
    root.classList.remove("home-screen--open");
    loading = false;
    revealItems = false;
    wasSkeletonLoading = false;
    mineFilter = "active";
    mineFilterPanel.setActive("active", { instant: true });
    syncMineFilterPanel();
    showTabbar();
    closeSubmitLockedModal();
    closeReviewIntroModal();
    closeInviteModal();
    void closeAccountMenu();
    void contactsModal.close();
    root.setAttribute("aria-busy", "false");
    root.hidden = true;
    return Promise.resolve();
  }

  body.addEventListener(
    "scroll",
    () => {
      const scrollTop = body.scrollTop;
      const delta = scrollTop - lastScrollTop;
      const atBottom =
        body.scrollHeight - body.clientHeight - scrollTop <= TABBAR_BOTTOM_EPS;
      if (scrollTop <= 0 || delta < 0 || atBottom) {
        showTabbar();
      } else if (delta > TABBAR_HIDE_DELTA) {
        setTabbarHidden(true);
      }
      lastScrollTop = scrollTop;
      scheduleTabbarContrastSync();
    },
    { passive: true },
  );

  if (typeof ResizeObserver === "function") {
    const tabbarResize = new ResizeObserver(() => {
      syncTabThumb();
    });
    tabbarResize.observe(tabbar);
    tabbarResize.observe(feedTab);
    tabbarResize.observe(mineTab);
    tabbarResize.observe(ratingTab);
  }

  window.addEventListener("resize", () => {
    scheduleTabThumbSync();
    scheduleTabbarContrastSync();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (root.hidden || loading) return;
    void refresh();
  });

  feedTab.addEventListener("click", () => {
    void setActiveTab("feed");
  });

  mineTab.addEventListener("click", () => {
    void setActiveTab("mine");
  });

  ratingTab.addEventListener("click", () => {
    void setActiveTab("rating");
  });

  addBtn.addEventListener("click", () => {
    if (!canSubmitPortfolio()) {
      openSubmitLockedModal();
      return;
    }
    void onAddPortfolio?.();
  });

  balanceChip.addEventListener("click", () => {
    if (!TEMP_BALANCE_CHIP_CREDIT && !import.meta.env.DEV) return;
    balanceChip.disabled = true;
    void creditBalance(DEV_CREDIT_AMOUNT)
      .then((next) => {
        syncCopy();
        if (import.meta.env.DEV || TEMP_BALANCE_CHIP_CREDIT) {
          console.info("[home] balance credit →", next);
        }
      })
      .catch((err) => {
        console.warn("[home] balance credit failed", err);
      })
      .finally(() => {
        balanceChip.disabled = false;
      });
  });

  function openReputationModal() {
    const t = getStrings();
    const reputationDelta = formatReputationDelta();
    reputationBody.textContent = t.homeReputationBody ?? "";
    noticeModal.content.replaceChildren(reputationBody);
    noticeModal.setTitle(
      formatString(t.homeReputationTitle, { reputation: reputationDelta }),
    );
    noticeModal.setDescription("");
    noticeModal.setPrimaryLabel(t.homeReputationClose ?? "");
    noticeModal.setCloseAriaLabel(
      t.homeReputationCloseAria ?? t.homeReputationClose ?? "",
    );
    noticeModal.setActionsVisible({ primary: true, secondary: false });
    noticeModal.open();
  }

  reputationChip.addEventListener("click", () => {
    openReputationModal();
  });

  profileBtn.addEventListener("click", () => {
    if (profileBtn.getAttribute("aria-expanded") === "true") {
      void closeAccountMenu();
      return;
    }
    profileBtn.setAttribute("aria-expanded", "true");
    accountMenu.open();
    accountMenu.focusFirst();
  });

  document.addEventListener("click", (event) => {
    if (!accountMenu.isOpen()) return;
    if (event.target instanceof Node && profileMenuAnchor.contains(event.target)) {
      return;
    }
    void closeAccountMenu();
  });

  syncCopy();
  renderList();

  return {
    root,
    open,
    close,
    setItems,
    setView,
    getView: () => ({ tab: activeTab, filter: mineFilter }),
    refresh,
    showNotice,
  };
}
