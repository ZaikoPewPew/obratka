import { formatString, getLocale, getStrings } from "../../i18n.js";
import {
  formatPortfolioGrade,
  formatPortfolioRole,
  listFeedPortfolioIds,
  listMyPortfolios,
  listPortfoliosForReview,
  listReadyOwnReportIds,
  MAX_MINE_PENDING,
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
  getBalance,
  refreshWalletFromServer,
} from "../../api/wallet.js";
import {
  formatReputationDelta,
  getReputationDelta,
} from "../../api/reviewComplaints.js";
import { listOnlineLegendaries } from "../../api/presence.js";
import { getSession, setSession } from "../../app/session.js";
import { resolvePlatformIcon } from "../../utils/platformBrandIcon.js";
import {
  BACKDROP_DARK_LUMA,
  resolveImageLumaProbes,
  sampleBackdropLuminance,
} from "../../utils/backdropLuminance.js";
import {
  hasUnseenFeed,
  markFeedSeen,
  seedFeedSeenIfNeeded,
} from "../../utils/feedSeen.js";
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
import { fixHangingPrepositions } from "../../utils/hangingPrepositions.js";
import { getCommunityRules } from "../../utils/communityRules.js";
import { brandMarkSvg } from "../../assets/brand/brandMarks.js";
import { createAppModal } from "../app-modal/AppModal.js";
import { createSidePanel } from "../side-panel/SidePanel.js";
import { createAccountMenu } from "../account-menu/AccountMenu.js";
import { createTabsPanel } from "../tabs-panel/TabsPanel.js";
import { createLegendaryOnlinePanel } from "../legendary-online-panel/LegendaryOnlinePanel.js";
import { createContactFab } from "../contact-fab/ContactFab.js";
import { COMMUNITY_CONTACT_URL } from "../../config/contacts.js";
import { createExplainerMediaRay } from "./explainerMediaRay.js";
import {
  createMicMeter,
  isMicMeterSupported,
} from "../../lib/mic-meter/createMicMeter.js";
import boneIconUrl from "../../assets/home/bone.svg";
import balanceCardDucksUrl from "../../assets/home/modal/balance-card-ducks.svg";
import currencyDuckUrl from "../../assets/home/modal/currency-duck.png";
import currencyGhostUrl from "../../assets/home/modal/currency-ghost.png";
import currencyP2pUrl from "../../assets/home/modal/currency-p2p.png";
import currencyReferalUrl from "../../assets/home/modal/currency-referal.png";
import plusIconSvg from "../../assets/home/plus.svg?raw";
import reviewedCheckIconSvg from "../../assets/home/reviewed-check.svg?raw";
import reputationNeutralIconSvg from "../../assets/home/reputation-neutral.svg?raw";
import reputationPositiveIconSvg from "../../assets/home/reputation-positive.svg?raw";
import reputationNegativeIconSvg from "../../assets/home/reputation-negative.svg?raw";
import slotPlusIconUrl from "../../assets/home/slot-plus.svg";

const PREVIEW_BROWSER_CONTROLS_URL = `${
  import.meta.env.BASE_URL || "/"
}assets/svg/home-preview-browser-controls.svg`;

const INVITE_COPY_SVG = `<svg class="home-screen__invite-copy-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M4 7V19C4 20.1046 4.89543 21 6 21H15M10 17H17C18.1046 17 19 16.1046 19 15V5C19 3.89543 18.1046 3 17 3H10C8.89543 3 8 3.89543 8 5V15C8 16.1046 8.89543 17 10 17Z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const INVITE_COPIED_SVG = `<svg class="home-screen__invite-copy-icon home-screen__invite-copy-icon--done" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M22 7L11.5 17.5L7.5 13.5M6 17.5L2 13.5M16.5 7L11.5 12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/** @typedef {'neutral' | 'positive' | 'negative'} ReputationIconKind */

/** @type {Record<ReputationIconKind, string>} */
const REPUTATION_ICON_SVG = {
  neutral: reputationNeutralIconSvg,
  positive: reputationPositiveIconSvg,
  negative: reputationNegativeIconSvg,
};

/**
 * Вариант иконки чипа репутации по дельте от 100.
 * @param {number} delta
 * @returns {ReputationIconKind}
 */
function reputationIconKindFor(delta) {
  if (delta > 0) return "positive";
  if (delta < 0) return "negative";
  return "neutral";
}

/**
 * Inline SVG чипа репутации (глазки анимируются через CSS).
 * @param {ReputationIconKind} kind
 * @returns {SVGElement}
 */
function createReputationIcon(kind) {
  const wrap = document.createElement("span");
  wrap.innerHTML = REPUTATION_ICON_SVG[kind].trim();
  const svg = wrap.firstElementChild;
  if (!(svg instanceof SVGElement)) {
    throw new Error(`reputation-${kind}.svg must be a root <svg>`);
  }
  svg.classList.add("home-screen__chip-icon", "home-screen__reputation-icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("focusable", "false");
  return svg;
}

/**
 * Превью-чип rec для intro-модалки: тот же UX, что shell-rec, но только mic-meter
 * (без STT / записи). Если mic недоступен — декоративный блок.
 *
 * @returns {{
 *   root: HTMLElement;
 *   bars: HTMLElement[];
 *   interactive: boolean;
 *   setListening: (listening: boolean) => void;
 *   syncChrome: (listening: boolean) => void;
 * }}
 */
function createReviewIntroRecPreview() {
  const interactive = isMicMeterSupported();
  /** @type {HTMLButtonElement | HTMLDivElement} */
  const chip = document.createElement(interactive ? "button" : "div");
  chip.className = "home-screen__review-intro-rec";
  if (interactive) {
    /** @type {HTMLButtonElement} */ (chip).type = "button";
  } else {
    chip.setAttribute("aria-hidden", "true");
  }

  const micWrap = document.createElement("span");
  micWrap.innerHTML = `<svg class="home-screen__review-intro-rec-mic" width="32" height="32" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <path d="M9 11.25C10.2426 11.25 11.25 10.2426 11.25 9V4.5C11.25 3.25736 10.2426 2.25 9 2.25C7.75736 2.25 6.75 3.25736 6.75 4.5V9C6.75 10.2426 7.75736 11.25 9 11.25Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M13.5 8.25V9C13.5 11.4853 11.4853 13.5 9 13.5C6.51472 13.5 4.5 11.4853 4.5 9V8.25M9 13.5V15.75M7.125 15.75H10.875" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  const mic = micWrap.firstElementChild;

  const wave = document.createElement("span");
  wave.className = "home-screen__review-intro-rec-wave";
  wave.setAttribute("aria-hidden", "true");
  /** @type {HTMLElement[]} */
  const bars = [];
  for (let i = 0; i < 12; i += 1) {
    const bar = document.createElement("span");
    bar.className = "home-screen__review-intro-rec-bar";
    wave.append(bar);
    bars.push(bar);
  }

  const dot = document.createElement("span");
  dot.className = "home-screen__review-intro-rec-dot";
  dot.setAttribute("aria-hidden", "true");

  if (mic) chip.append(mic);
  chip.append(wave, dot);

  function syncChrome(listening) {
    chip.classList.toggle("home-screen__review-intro-rec--listening", listening);
    if (!interactive) return;
    const t = getStrings();
    chip.setAttribute("aria-pressed", listening ? "true" : "false");
    chip.setAttribute(
      "aria-label",
      listening
        ? (t.homeReviewIntroRecStopAria ?? "")
        : (t.homeReviewIntroRecStartAria ?? ""),
    );
    chip.title = listening
      ? (t.homeReviewIntroRecStopTitle ?? "")
      : (t.homeReviewIntroRecStartTitle ?? "");
  }

  syncChrome(false);

  return {
    root: chip,
    bars,
    interactive,
    setListening: syncChrome,
    syncChrome,
  };
}

/**
 * Слой уточек для карточки «2-ая минута»: хинт по hover + разлёт от клика.
 * @returns {{
 *   root: DocumentFragment;
 *   hit: HTMLButtonElement;
 *   layer: HTMLDivElement;
 *   burstAt: (clientX: number, clientY: number, card: HTMLElement) => void;
 * }}
 */
function createReviewIntroDucksBurst() {
  const fragment = document.createDocumentFragment();

  const layer = document.createElement("div");
  layer.className = "home-screen__review-intro-ducks";
  layer.setAttribute("aria-hidden", "true");

  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "home-screen__review-intro-ducks-hit";

  const hint = document.createElement("img");
  hint.className = "home-screen__review-intro-ducks-hint";
  hint.src = balanceCardDucksUrl;
  hint.alt = "";
  hint.draggable = false;
  hit.append(hint);

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @param {HTMLElement} card
   */
  function burstAt(clientX, clientY, card) {
    const rect = card.getBoundingClientRect();
    const originX = Math.min(Math.max(clientX - rect.left, 8), rect.width - 8);
    const originY = Math.min(Math.max(clientY - rect.top, 8), rect.height - 8);
    const count = 6;
    const fragmentDucks = document.createDocumentFragment();

    for (let i = 0; i < count; i += 1) {
      const duck = document.createElement("img");
      duck.className = "home-screen__review-intro-duck";
      duck.src = balanceCardDucksUrl;
      duck.alt = "";
      duck.draggable = false;
      duck.style.left = `${originX}px`;
      duck.style.top = `${originY}px`;

      const t = count === 1 ? 0.5 : i / (count - 1);
      const angleDeg = -110 + t * 140 + (i % 2 === 0 ? -6 : 6);
      const angle = (angleDeg * Math.PI) / 180;
      const dist = 72 + (i % 3) * 28 + t * 36;
      const scale = 0.72 + (i % 3) * 0.14;
      const rot = -28 + t * 56 + (i % 2 === 0 ? -10 : 12);

      duck.style.setProperty("--duck-index", String(i));
      duck.style.setProperty("--duck-dx", `${Math.cos(angle) * dist}px`);
      duck.style.setProperty("--duck-dy", `${Math.sin(angle) * dist}px`);
      duck.style.setProperty("--duck-rot", `${rot}deg`);
      duck.style.setProperty("--duck-scale", String(scale));
      duck.addEventListener(
        "animationend",
        () => {
          duck.remove();
        },
        { once: true },
      );
      fragmentDucks.append(duck);
    }

    layer.append(fragmentDucks);
  }

  fragment.append(layer, hit);
  return { root: fragment, hit, layer, burstAt };
}

/**
 * Карточка шага intro-модалки (минута 1 / 2).
 * @param {{
 *   title: string;
 *   body: string;
 *   withRec?: boolean;
 *   withDucks?: boolean;
 * }} opts
 * @returns {{
 *   root: HTMLLIElement;
 *   rec: ReturnType<typeof createReviewIntroRecPreview> | null;
 *   ducks: ReturnType<typeof createReviewIntroDucksBurst> | null;
 * }}
 */
function createReviewIntroCard(opts) {
  const card = document.createElement("li");
  card.className = "home-screen__review-intro-card";
  if (opts.withRec) {
    card.classList.add("home-screen__review-intro-card--with-rec");
  }
  if (opts.withDucks) {
    card.classList.add("home-screen__review-intro-card--with-ducks");
  }

  const title = document.createElement("p");
  title.className = "home-screen__review-intro-card-title";
  title.textContent = fixHangingPrepositions(opts.title ?? "");

  const body = document.createElement("p");
  body.className = "home-screen__review-intro-card-body";
  body.textContent = fixHangingPrepositions(opts.body ?? "");

  card.append(title, body);

  /** @type {ReturnType<typeof createReviewIntroRecPreview> | null} */
  let rec = null;
  /** @type {ReturnType<typeof createReviewIntroDucksBurst> | null} */
  let ducks = null;
  if (opts.withRec) {
    rec = createReviewIntroRecPreview();
    card.append(rec.root);
  }
  if (opts.withDucks) {
    ducks = createReviewIntroDucksBurst();
    const t = getStrings();
    ducks.hit.setAttribute(
      "aria-label",
      t.homeReviewIntroDucksAria ?? "",
    );
    ducks.hit.title = t.homeReviewIntroDucksTitle ?? "";
    ducks.hit.addEventListener("click", (event) => {
      ducks?.burstAt(event.clientX, event.clientY, card);
    });
    card.append(ducks.root);
  }
  return { root: card, rec, ducks };
}

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

/** Сколько skeleton-карточек показывать, пока грузится лента / «Мои завершенные». */
const SKELETON_CARD_COUNT = 5;

/**
 * Skeleton на «Мои → Мои на ревью»: всегда ≤ `MAX_MINE_PENDING` слотов
 * (карточка или free-slot), не имитировать длинную ленту.
 */
const MINE_ACTIVE_SKELETON_CARD_COUNT = MAX_MINE_PENDING;

/** Сколько skeleton-карточек показывать, пока грузится рейтинг. */
const RATING_SKELETON_CARD_COUNT = 8;

/**
 * Обновление active-слотов, пока home открыт. Каждый тик — полный `refresh()`
 * (лента/мои + `refreshMineReady` + `refreshFeedUnseen` + online-легендарки),
 * поэтому интервал держим не слишком частым: при наплыве регистраций сотни
 * открытых вкладок × несколько запросов на тик быстро упрутся в Free-план БД.
 */
const HOME_SLOTS_POLL_MS = 45_000;

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
 * Hover/focus tip над хостом (слоты ревьюеров, бейджи автора).
 * @param {HTMLElement} host
 * @param {string} label
 */
function attachHomeTooltip(host, label) {
  const text = typeof label === "string" ? label.trim() : "";
  if (!text) return;
  host.setAttribute("aria-label", text);
  const tooltip = document.createElement("span");
  tooltip.className = "home-screen__tip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.textContent = text;
  host.append(tooltip);
}

/**
 * @param {HTMLElement} slot
 * @param {string} label
 */
function attachReviewerSlotTooltip(slot, label) {
  attachHomeTooltip(slot, label);
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
 * Id карточек ленты (для точки «новый кейс»).
 *
 * @param {HomePortfolioItem[] | null | undefined} list
 * @returns {string[]}
 */
function feedCardIds(list) {
  return (Array.isArray(list) ? list : [])
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

  /** @type {ReputationIconKind} */
  let reputationIconKind = "neutral";
  let reputationIcon = createReputationIcon(reputationIconKind);

  const reputationValue = document.createElement("span");
  reputationValue.className = "home-screen__chip-value";

  reputationChip.append(reputationIcon, reputationValue);

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

  const rulesPanel = createSidePanel();

  /**
   * @param {string} text
   * @param {string} className
   * @param {string} [tagName="p"]
   */
  function createRulesText(text, className, tagName = "p") {
    const el = document.createElement(tagName);
    el.className = className;
    el.textContent = fixHangingPrepositions(text ?? "");
    return el;
  }

  function syncRulesPanelContent() {
    const t = getStrings();
    const rules = getCommunityRules();
    rulesPanel.setTitle(rules.title);
    rulesPanel.setDescription(fixHangingPrepositions(rules.updated));
    rulesPanel.setCloseAriaLabel(t.homeRulesCloseAria ?? "");

    /** @type {HTMLElement[]} */
    const nodes = [];
    if (rules.intro) {
      nodes.push(createRulesText(rules.intro, "side-panel__intro"));
    }
    for (const section of rules.sections) {
      const wrap = document.createElement("section");
      wrap.className = "side-panel__section";
      if (section.title) {
        wrap.append(
          createRulesText(section.title, "side-panel__section-title", "h3"),
        );
      }
      if (section.body) {
        wrap.append(createRulesText(section.body, "side-panel__section-body"));
      }
      nodes.push(wrap);
    }
    rulesPanel.content.replaceChildren(...nodes);
  }

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
    onRules: () => {
      syncRulesPanelContent();
      rulesPanel.open();
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

  const legendaryOnlinePanel = createLegendaryOnlinePanel({
    onOpen: () => {
      openLegendaryOnlineModal();
    },
  });
  cluster.append(feed, ratingView);
  body.append(cluster);

  const noticeModal = createAppModal({
    size: "md",
    showSecondary: false,
    onPrimary: () => {
      void noticeModal.close();
    },
  });

  const reputationExplainer = document.createElement("div");
  reputationExplainer.className = "home-screen__reputation-explainer";

  const reputationRow = document.createElement("div");
  reputationRow.className = "home-screen__reputation-explainer-row";

  const reputationMedia = document.createElement("div");
  reputationMedia.className = "home-screen__reputation-explainer-media";

  const reputationRay = createExplainerMediaRay();

  const reputationPhoto = document.createElement("img");
  reputationPhoto.className = "home-screen__explainer-media-photo";
  reputationPhoto.src = currencyGhostUrl;
  reputationPhoto.alt = "";
  reputationPhoto.width = 180;
  reputationPhoto.height = 216;
  reputationPhoto.decoding = "async";

  reputationMedia.append(reputationRay.root, reputationPhoto);

  const reputationCard = document.createElement("div");
  reputationCard.className = "home-screen__reputation-explainer-card";

  const reputationCardValue = document.createElement("p");
  reputationCardValue.className = "home-screen__reputation-explainer-card-value";

  const reputationCardLabel = document.createElement("p");
  reputationCardLabel.className = "home-screen__reputation-explainer-card-label";

  reputationCard.append(reputationCardValue, reputationCardLabel);
  reputationRow.append(reputationMedia, reputationCard);

  const reputationBody = document.createElement("p");
  reputationBody.className = "home-screen__reputation-explainer-callout";

  reputationExplainer.append(reputationRow, reputationBody);

  const reputationModal = createAppModal({
    size: "md",
    showPrimary: false,
    onSecondary: () => {
      void reputationModal.close();
    },
  });
  reputationModal.content.append(reputationExplainer);

  const balanceExplainer = document.createElement("div");
  balanceExplainer.className = "home-screen__balance-explainer";

  const balanceMedia = document.createElement("div");
  balanceMedia.className = "home-screen__balance-explainer-media";

  const balanceRay = createExplainerMediaRay();

  const balancePhoto = document.createElement("img");
  balancePhoto.className = "home-screen__explainer-media-photo";
  balancePhoto.src = currencyDuckUrl;
  balancePhoto.alt = "";
  balancePhoto.width = 182;
  balancePhoto.height = 216;
  balancePhoto.decoding = "async";

  balanceMedia.append(balanceRay.root, balancePhoto);

  const balanceCard = document.createElement("div");
  balanceCard.className = "home-screen__balance-explainer-card";

  const balanceCardTitle = document.createElement("p");
  balanceCardTitle.className = "home-screen__balance-explainer-card-title";

  const balanceCardBody = document.createElement("p");
  balanceCardBody.className = "home-screen__balance-explainer-card-body";

  const balanceCardDeco = document.createElement("img");
  balanceCardDeco.className = "home-screen__balance-explainer-card-deco";
  balanceCardDeco.src = balanceCardDucksUrl;
  balanceCardDeco.alt = "";
  balanceCardDeco.width = 66;
  balanceCardDeco.height = 73;
  balanceCardDeco.decoding = "async";
  balanceCardDeco.setAttribute("aria-hidden", "true");

  balanceCard.append(balanceCardTitle, balanceCardBody, balanceCardDeco);
  balanceExplainer.append(balanceMedia, balanceCard);

  const balanceModal = createAppModal({
    size: "md",
    showPrimary: false,
    onSecondary: () => {
      void balanceModal.close();
    },
  });
  balanceModal.content.append(balanceExplainer);

  const p2pExplainer = document.createElement("div");
  p2pExplainer.className = "home-screen__reputation-explainer-row";

  const p2pMedia = document.createElement("div");
  p2pMedia.className = "home-screen__p2p-explainer-media";

  const p2pRay = createExplainerMediaRay();

  const p2pPhoto = document.createElement("img");
  p2pPhoto.className = "home-screen__explainer-media-photo";
  p2pPhoto.src = currencyP2pUrl;
  p2pPhoto.alt = "";
  p2pPhoto.width = 268;
  p2pPhoto.height = 216;
  p2pPhoto.decoding = "async";

  p2pMedia.append(p2pRay.root, p2pPhoto);

  const p2pCard = document.createElement("div");
  p2pCard.className = "home-screen__reputation-explainer-card";

  const p2pCardTitle = document.createElement("p");
  p2pCardTitle.className = "home-screen__reputation-explainer-card-value";

  const p2pCardBody = document.createElement("p");
  p2pCardBody.className = "home-screen__reputation-explainer-card-label";

  p2pCard.append(p2pCardTitle, p2pCardBody);
  p2pExplainer.append(p2pMedia, p2pCard);

  const legendaryOnlineModal = createAppModal({
    size: "md",
    showPrimary: false,
    onSecondary: () => {
      void legendaryOnlineModal.close();
    },
  });
  legendaryOnlineModal.content.append(p2pExplainer);

  const reviewIntroSteps = document.createElement("ol");
  reviewIntroSteps.className = "home-screen__review-intro-steps";

  /** @type {ReturnType<typeof createMicMeter> | null} */
  let introMicMeter = null;
  /** @type {ReturnType<typeof createReviewIntroRecPreview> | null} */
  let introRec = null;
  /** @type {number[]} */
  const introRecLastLevels = Array(12).fill(-1);

  function setIntroRecWaveform(levels = []) {
    if (!introRec) return;
    const listening = Boolean(introMicMeter?.isRunning());
    for (let index = 0; index < introRec.bars.length; index += 1) {
      const next = listening ? Number(levels[index]) || 0 : 0;
      if (Math.abs(introRecLastLevels[index] - next) < 0.01) continue;
      introRecLastLevels[index] = next;
      introRec.bars[index].style.setProperty(
        "--control-rec-bar-level",
        String(next),
      );
    }
  }

  function ensureIntroMicMeter() {
    if (introMicMeter) return introMicMeter;
    introMicMeter = createMicMeter();
    introMicMeter.onWaveform(setIntroRecWaveform);
    introMicMeter.onError(() => {
      introRec?.setListening(false);
      setIntroRecWaveform();
    });
    return introMicMeter;
  }

  async function stopIntroMicMeter() {
    if (introMicMeter?.isRunning()) {
      await introMicMeter.stop();
    }
    introRec?.setListening(false);
    setIntroRecWaveform();
  }

  async function toggleIntroMicMeter() {
    const meter = ensureIntroMicMeter();
    if (!meter.supported || !introRec?.interactive) return;
    if (meter.isRunning()) {
      await stopIntroMicMeter();
      return;
    }
    const ok = await meter.start();
    introRec.setListening(ok);
    if (!ok) setIntroRecWaveform();
  }

  const reviewIntroModal = createAppModal({
    size: "md",
    onPrimary: () => {
      const item = reviewIntroItem;
      void stopIntroMicMeter();
      void reviewIntroModal.close();
      if (item) {
        void onOpenPortfolio(item);
      }
    },
    onSecondary: () => {
      void stopIntroMicMeter();
      void reviewIntroModal.close();
    },
    onClose: () => {
      void stopIntroMicMeter();
      reviewIntroItem = null;
      introRec = null;
    },
  });
  reviewIntroModal.content.append(reviewIntroSteps);

  const inviteExplainer = document.createElement("div");
  inviteExplainer.className = "home-screen__invite-explainer";

  const inviteMedia = document.createElement("div");
  inviteMedia.className = "home-screen__invite-explainer-media";

  const inviteRay = createExplainerMediaRay();

  const invitePhoto = document.createElement("img");
  invitePhoto.className = "home-screen__explainer-media-photo";
  invitePhoto.src = currencyReferalUrl;
  invitePhoto.alt = "";
  invitePhoto.width = 1104;
  invitePhoto.height = 512;
  invitePhoto.decoding = "async";

  inviteMedia.append(inviteRay.root, invitePhoto);

  const inviteBar = document.createElement("div");
  inviteBar.className = "home-screen__invite-bar";

  const inviteCluster = document.createElement("div");
  inviteCluster.className = "home-screen__invite-bar-cluster";

  const inviteUses = document.createElement("p");
  inviteUses.className = "home-screen__invite-bar-uses";

  const inviteCodeCell = document.createElement("div");
  inviteCodeCell.className = "home-screen__invite-bar-code";

  const inviteCode = document.createElement("p");
  inviteCode.className = "home-screen__invite-bar-code-text";
  inviteCode.setAttribute("aria-live", "polite");

  const inviteCopyBtn = document.createElement("button");
  inviteCopyBtn.type = "button";
  inviteCopyBtn.className = "home-screen__invite-copy";
  inviteCopyBtn.innerHTML = INVITE_COPY_SVG;

  inviteCodeCell.append(inviteCode, inviteCopyBtn);
  inviteCluster.append(inviteUses, inviteCodeCell);

  const inviteShareBtn = document.createElement("button");
  inviteShareBtn.type = "button";
  inviteShareBtn.className = "home-screen__invite-share";

  inviteBar.append(inviteCluster, inviteShareBtn);
  inviteExplainer.append(inviteMedia, inviteBar);

  const inviteModal = createAppModal({
    size: "md",
    showPrimary: false,
    showSecondary: false,
  });
  inviteModal.content.append(inviteExplainer);

  inviteCopyBtn.addEventListener("click", () => {
    if (!inviteCodeValue) return;
    void copyInviteCode();
  });

  inviteShareBtn.addEventListener("click", () => {
    if (!inviteCodeValue) return;
    void shareInviteLink();
  });

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

  const feedTabLabel = document.createElement("span");
  feedTabLabel.className = "home-screen__tab-label";

  /* Точка «есть новый кейс в ленте»; текст остаётся в отдельном span. */
  const feedTabDot = document.createElement("span");
  feedTabDot.className = "home-screen__tab-dot";
  feedTabDot.setAttribute("aria-hidden", "true");
  feedTabDot.hidden = true;

  feedTab.append(feedTabLabel, feedTabDot);

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

  const contactFab = createContactFab();

  // Временно скрыт с фронта (оставляем компонент и логику нетронутыми).
  root.append(
    title,
    topbar,
    body,
    tabbarDock,
    legendaryOnlinePanel.root,
    noticeModal.root,
    reputationModal.root,
    balanceModal.root,
    legendaryOnlineModal.root,
    reviewIntroModal.root,
    inviteModal.root,
    contactsModal.root,
    rulesPanel.root,
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
  let feedUnseen = false;
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
          : "";
    } else {
      empty.textContent = t.homeEmpty;
    }
    feedTabLabel.textContent = t.homeTabFeed;
    mineTabLabel.textContent = t.homeTabMine;
    ratingTab.textContent = t.homeTabRating;
    ratingEmpty.textContent = t.homeRatingEmpty;
    ratingList.setAttribute("aria-label", t.homeRatingListAria);
    syncFeedTabAria();
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
    const nextReputationKind = reputationIconKindFor(getReputationDelta());
    if (nextReputationKind !== reputationIconKind) {
      reputationIconKind = nextReputationKind;
      const nextIcon = createReputationIcon(reputationIconKind);
      reputationIcon.replaceWith(nextIcon);
      reputationIcon = nextIcon;
    }
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
    contactFab.syncCopy();
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

  function openPendingLimitModal() {
    const t = getStrings();
    showNotice({
      title: t.homePendingLimitTitle ?? "",
      body: t.homePendingLimit ?? "",
      closeLabel: t.homePendingLimitClose,
      closeAria: t.homePendingLimitCloseAria,
    });
  }

  /**
   * CTA / empty-slot: монета + свободный pending-слот.
   */
  function tryAddPortfolio() {
    const activePending = visibleFor(items).length;
    if (
      activeTab === "mine" &&
      mineFilter === "active" &&
      activePending >= MAX_MINE_PENDING
    ) {
      openPendingLimitModal();
      return;
    }
    if (!canSubmitPortfolio()) {
      openSubmitLockedModal();
      return;
    }
    void onAddPortfolio?.();
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
   * Промежуточный шаг перед claim: две минуты + CTA «Сюдаа его!».
   *
   * @param {HomePortfolioItem} item
   */
  function openReviewIntro(item) {
    const t = getStrings();
    void stopIntroMicMeter();
    reviewIntroItem = item;
    const authorName =
      (typeof item.name === "string" && item.name.trim()) ||
      (typeof item.url === "string" && item.url.trim()) ||
      "";
    reviewIntroSteps.replaceChildren();
    reviewIntroSteps.setAttribute("aria-label", t.homeReviewIntroStepsAria ?? "");
    const minute1 = createReviewIntroCard({
      title: t.homeReviewIntroStep1Title ?? "",
      body: t.homeReviewIntroStep1Body ?? "",
      withRec: true,
    });
    const minute2 = createReviewIntroCard({
      title: t.homeReviewIntroStep2Title ?? "",
      body: t.homeReviewIntroStep2Body ?? "",
      withDucks: true,
    });
    introRec = minute1.rec;
    if (introRec?.interactive) {
      introRec.root.addEventListener("click", () => {
        void toggleIntroMicMeter();
      });
      introRec.syncChrome(false);
    }
    for (let i = 0; i < introRecLastLevels.length; i += 1) {
      introRecLastLevels[i] = -1;
    }
    setIntroRecWaveform();
    reviewIntroSteps.append(minute1.root, minute2.root);
    reviewIntroModal.setTitle(
      fixHangingPrepositions(t.homeReviewIntroTitle ?? ""),
    );
    reviewIntroModal.setDescription(
      fixHangingPrepositions(
        formatString(t.homeReviewIntroBody ?? "", { name: authorName }),
      ),
    );
    reviewIntroModal.setPrimaryLabel(t.homeReviewIntroStart ?? "");
    reviewIntroModal.setSecondaryLabel(t.homeReviewIntroCancel ?? "");
    reviewIntroModal.setCloseAriaLabel(t.homeReviewIntroCloseAria ?? "");
    reviewIntroModal.setActionsVisible({ primary: true, secondary: true });
    reviewIntroModal.open();
  }

  function closeReviewIntroModal() {
    void stopIntroMicMeter();
    reviewIntroItem = null;
    introRec = null;
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
    setInviteCopyIdle();
    void inviteModal.close();
  }

  function closeAccountMenu() {
    profileBtn.setAttribute("aria-expanded", "false");
    return accountMenu.close();
  }

  function setInviteCopyIdle() {
    const t = getStrings();
    inviteCopyBtn.classList.remove("home-screen__invite-copy--done");
    inviteCopyBtn.innerHTML = INVITE_COPY_SVG;
    inviteCopyBtn.setAttribute("aria-label", t.homeInviteCopyAria ?? "");
  }

  function setInviteCopyDone() {
    const t = getStrings();
    inviteCopyBtn.classList.add("home-screen__invite-copy--done");
    inviteCopyBtn.innerHTML = INVITE_COPIED_SVG;
    inviteCopyBtn.setAttribute("aria-label", t.homeInviteCopiedAria ?? "");
  }

  /**
   * @param {{
   *   code: string | null;
   *   uses: number;
   *   maxUses: number;
   * }} info
   */
  function openInviteModal(info) {
    const t = getStrings();
    inviteCodeValue = info.code;
    if (inviteCopyResetId != null) {
      window.clearTimeout(inviteCopyResetId);
      inviteCopyResetId = null;
    }
    setInviteCopyIdle();
    inviteModal.setTitle(
      fixHangingPrepositions(t.homeInviteTitle ?? ""),
    );
    inviteModal.setDescription(
      fixHangingPrepositions(
        info.code
          ? (t.homeInviteBody ?? "")
          : (t.homeInviteEmpty ?? ""),
      ),
    );
    inviteUses.textContent = fixHangingPrepositions(
      formatString(t.homeInviteUses ?? "", {
        used: info.uses,
        max: info.maxUses,
      }),
    );
    inviteCode.textContent = info.code || "—";
    inviteCopyBtn.disabled = !info.code;
    inviteShareBtn.disabled = !info.code;
    inviteShareBtn.textContent = t.homeInviteShare ?? "";
    inviteShareBtn.setAttribute(
      "aria-label",
      t.homeInviteShareAria ?? t.homeInviteShare ?? "",
    );
    inviteModal.setCloseAriaLabel(t.homeInviteCloseAria ?? "");
    inviteModal.setActionsVisible({ primary: false, secondary: false });
    inviteModal.open();
  }

  async function copyInviteCode() {
    if (!inviteCodeValue) return;
    try {
      await navigator.clipboard.writeText(inviteCodeValue);
      setInviteCopyDone();
      if (inviteCopyResetId != null) window.clearTimeout(inviteCopyResetId);
      inviteCopyResetId = window.setTimeout(() => {
        setInviteCopyIdle();
        inviteCopyResetId = null;
      }, 1600);
    } catch {
      setInviteCopyIdle();
    }
  }

  async function shareInviteLink() {
    if (!inviteCodeValue) return;
    const t = getStrings();
    const url = buildReferralShareUrl(inviteCodeValue);
    const title = t.homeInviteTitle ?? "";
    const text = t.homeInviteBody ?? "";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
    } catch (err) {
      if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
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
      uses: Math.max(0, uses),
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

  function syncFeedTabAria() {
    const t = getStrings();
    if (feedUnseen) {
      feedTab.setAttribute("aria-label", t.homeTabFeedNewAria ?? t.homeTabFeed);
      return;
    }
    feedTab.removeAttribute("aria-label");
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
  function setFeedUnseen(next) {
    if (feedUnseen === next) return;
    feedUnseen = next;
    feedTabDot.hidden = !next;
    syncFeedTabAria();
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
   * На `mine` режет список по Мои на ревью / Мои завершенные; на `feed` — как есть.
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
    const count =
      activeTab === "mine" && mineFilter === "active"
        ? MINE_ACTIVE_SKELETON_CARD_COUNT
        : SKELETON_CARD_COUNT;
    for (let i = 0; i < count; i += 1) {
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
    balance.setAttribute(
      "aria-label",
      formatString(t.homeRatingBalanceAria, { balance: item.balance }),
    );

    const balanceIcon = document.createElement("img");
    balanceIcon.className = "home-screen__rating-balance-icon";
    balanceIcon.src = boneIconUrl;
    balanceIcon.alt = "";
    balanceIcon.width = 24;
    balanceIcon.height = 24;
    balanceIcon.decoding = "async";
    balanceIcon.setAttribute("aria-hidden", "true");

    const balanceValue = document.createElement("span");
    balanceValue.className = "home-screen__rating-balance-value";
    balanceValue.textContent = Number(item.balance).toLocaleString(getLocale());

    balance.append(balanceIcon, balanceValue);
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
   * Placeholder свободного слота (Figma Type=Queue) на «Мои → Мои на ревью».
   * @returns {HTMLLIElement}
   */
  function createEmptySlotCard() {
    const t = getStrings();
    const li = document.createElement("li");
    li.className = "home-screen__item home-screen__item--slot-empty";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "home-screen__card home-screen__card--slot-empty";
    button.setAttribute(
      "aria-label",
      t.homeMineSlotFreeAria ?? t.homeMineSlotFree ?? "",
    );

    const preview = document.createElement("div");
    preview.className = "home-screen__slot-empty-preview";
    preview.setAttribute("aria-hidden", "true");

    const label = document.createElement("p");
    label.className = "home-screen__slot-empty-label";
    label.setAttribute("data-i18n", "homeMineSlotFree");
    label.textContent = t.homeMineSlotFree ?? "";
    preview.append(label);

    const meta = document.createElement("div");
    meta.className = "home-screen__slot-empty-meta";
    meta.setAttribute("aria-hidden", "true");

    const metaWide = document.createElement("span");
    metaWide.className =
      "home-screen__slot-empty-pill home-screen__slot-empty-pill--wide";
    const metaNarrow = document.createElement("span");
    metaNarrow.className =
      "home-screen__slot-empty-pill home-screen__slot-empty-pill--narrow";
    meta.append(metaWide, metaNarrow);

    button.append(preview, meta);
    button.addEventListener("click", () => {
      tryAddPortfolio();
    });

    li.append(button);
    return li;
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
      attachHomeTooltip(platform, t.homePlatformSite);
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
      attachHomeTooltip(platform, platformIcon.label);
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
    if (typeof item.name === "string" && item.name.trim()) {
      attachHomeTooltip(avatar, item.name.trim());
    }

    badges.append(platform, avatar);

    const grade = document.createElement("p");
    grade.className = "home-screen__card-grade";
    grade.textContent =
      (typeof item.role === "string" && item.role.trim()) || t.homeDefaultRole;

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
    const showMineSlots =
      activeTab === "mine" && mineFilter === "active" && !loading;
    const emptySlots = showMineSlots
      ? Math.max(0, MAX_MINE_PENDING - visible.length)
      : 0;
    empty.hidden = visible.length > 0 || emptySlots > 0;
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
    for (let i = 0; i < emptySlots; i += 1) {
      const li = createEmptySlotCard();
      const index = visible.length + i;
      if (revealItems && !wasSkeletonLoading) {
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
    empty.hidden =
      visible.length > 0 ||
      (activeTab === "mine" &&
        mineFilter === "active" &&
        visible.length < MAX_MINE_PENDING);
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
    } else if (tab === "feed") {
      syncFeedUnseenFromIds(feedCardIds(items));
    }
    renderList();
    return true;
  }

  /**
   * Открыли «На ревью»: текущие id ленты считаются просмотренными,
   * точка на вкладке гаснет.
   *
   * @param {string[]} ids
   */
  function acknowledgeFeedSeen(ids) {
    const userId = getSession()?.userId;
    seedFeedSeenIfNeeded(userId, ids);
    markFeedSeen(userId, ids);
    setFeedUnseen(false);
  }

  /**
   * Точка по unseen кейсам; если уже на «На ревью» — сразу acknowledge.
   *
   * @param {string[]} ids
   */
  function syncFeedUnseenFromIds(ids) {
    if (activeTab === "feed") {
      acknowledgeFeedSeen(ids);
      return;
    }
    const userId = getSession()?.userId;
    if (seedFeedSeenIfNeeded(userId, ids)) {
      setFeedUnseen(false);
      return;
    }
    setFeedUnseen(hasUnseenFeed(userId, ids));
  }

  /** Точка на «На ревью»: непросмотренный новый кейс в ленте. */
  async function refreshFeedUnseen(epoch, tab, feedItems) {
    if (tab === "feed") {
      if (epoch === refreshEpoch) {
        syncFeedUnseenFromIds(feedCardIds(feedItems));
      }
      return;
    }
    const ids = await listFeedPortfolioIds();
    if (epoch === refreshEpoch) {
      syncFeedUnseenFromIds(ids);
    }
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
      await refreshMineReady(epoch, tab, []);
      await refreshFeedUnseen(epoch, tab, []);
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
    await refreshFeedUnseen(epoch, tab, next);

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
    /* Instant: syncCopy → scheduleTabThumbSync() без instant даёт width 0→N поверх entrance. */
    scheduleTabThumbSync(true);
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
    setFeedUnseen(
      hasUnseenFeed(
        getSession()?.userId,
        feedCardIds(
          /** @type {HomePortfolioItem[] | null} */ (
            getCachedHomeList(getSession()?.userId, "feed")
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
    void rulesPanel.close();
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
    tryAddPortfolio();
  });

  balanceChip.addEventListener("click", () => {
    openBalanceModal();
  });

  function openBalanceModal() {
    const t = getStrings();
    balanceCardTitle.textContent = fixHangingPrepositions(
      formatString(t.homeBalanceCardTitle ?? "", {
        balance: getBalance(),
      }),
    );
    balanceCardBody.textContent = fixHangingPrepositions(
      t.homeBalanceCardBody ?? "",
    );
    balanceModal.setTitle(
      fixHangingPrepositions(t.homeBalanceTitle ?? ""),
    );
    balanceModal.setDescription(
      fixHangingPrepositions(t.homeBalanceDesc ?? ""),
    );
    balanceModal.setSecondaryLabel(t.homeBalanceClose ?? "");
    balanceModal.setCloseAriaLabel(
      t.homeBalanceCloseAria ?? t.homeBalanceClose ?? "",
    );
    balanceModal.setActionsVisible({ primary: false, secondary: true });
    balanceModal.open();
  }

  function openLegendaryOnlineModal() {
    const t = getStrings();
    p2pCardTitle.textContent = fixHangingPrepositions(
      t.homeLegendaryOnlineCardTitle ?? "",
    );
    p2pCardBody.textContent = fixHangingPrepositions(
      t.homeLegendaryOnlineCardBody ?? "",
    );
    legendaryOnlineModal.setTitle(
      fixHangingPrepositions(t.homeLegendaryOnlineTitle ?? ""),
    );
    legendaryOnlineModal.setDescription(
      fixHangingPrepositions(t.homeLegendaryOnlineDesc ?? ""),
    );
    legendaryOnlineModal.setSecondaryLabel(t.homeLegendaryOnlineClose ?? "");
    legendaryOnlineModal.setCloseAriaLabel(
      t.homeLegendaryOnlineCloseAria ?? t.homeLegendaryOnlineClose ?? "",
    );
    legendaryOnlineModal.setActionsVisible({ primary: false, secondary: true });
    legendaryOnlineModal.open();
  }

  function openReputationModal() {
    const t = getStrings();
    reputationCardValue.textContent = fixHangingPrepositions(
      formatString(t.homeReputationCardTitle ?? "", {
        reputation: formatReputationDelta(),
      }),
    );
    reputationCardLabel.textContent = fixHangingPrepositions(
      t.homeReputationCardLabel ?? "",
    );
    reputationBody.textContent = fixHangingPrepositions(
      t.homeReputationBody ?? "",
    );
    reputationModal.setTitle(
      fixHangingPrepositions(t.homeReputationTitle ?? ""),
    );
    reputationModal.setDescription(
      fixHangingPrepositions(t.homeReputationDesc ?? ""),
    );
    reputationModal.setSecondaryLabel(t.homeReputationClose ?? "");
    reputationModal.setCloseAriaLabel(
      t.homeReputationCloseAria ?? t.homeReputationClose ?? "",
    );
    reputationModal.setActionsVisible({ primary: false, secondary: true });
    reputationModal.open();
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
