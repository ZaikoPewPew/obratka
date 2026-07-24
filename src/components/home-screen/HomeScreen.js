import { formatString, getStrings } from "../../i18n.js";
import {
  listMyPortfolios,
  listPortfoliosForReview,
  portfolioPreviewUrl,
} from "../../api/portfolios.js";
import {
  canSubmitPortfolio,
  creditBalance,
  getBalance,
  refreshWalletFromServer,
} from "../../api/wallet.js";
import { getSession } from "../../app/session.js";
import { resolvePlatformIcon } from "../../utils/platformBrandIcon.js";
import {
  BACKDROP_DARK_LUMA,
  resolveImageLumaProbes,
  sampleBackdropLuminance,
} from "../../utils/backdropLuminance.js";
import { brandMarkSvg } from "../../assets/brand/brandMarks.js";
import boneIconUrl from "../../assets/home/bone.svg";
import bellIconUrl from "../../assets/home/bell.svg";
import plusIconUrl from "../../assets/home/plus.svg";
import slotPlusIconUrl from "../../assets/home/slot-plus.svg";

/** Сколько монет даёт клик по чипу баланса (dev). */
const DEV_CREDIT_AMOUNT = 10;

/** Сколько skeleton-карточек показывать, пока грузится лента. */
const SKELETON_CARD_COUNT = 5;

/** Обновление active-слотов, пока home открыт. */
const HOME_SLOTS_POLL_MS = 15_000;

/**
 * Порог только для hide: show — при любом скролле вверх.
 * Hide чуть с запасом, чтобы не дёргался от трекпада.
 */
const TABBAR_HIDE_DELTA = 6;

/**
 * @typedef {'feed' | 'mine'} HomeTabId
 */

/**
 * @typedef {{
 *   kind?: 'completed' | 'active';
 *   reviewerId?: string;
 *   avatarUrl?: string;
 *   displayName?: string;
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
 * Главная: шапка + лента карточек портфолио (Figma home).
 *
 * @param {{
 *   onOpenPortfolio: (item: HomePortfolioItem) => void | Promise<void>;
 *   onOpenReport?: (item: HomePortfolioItem) => void | Promise<void>;
 *   onAddPortfolio?: () => void | Promise<void>;
 *   onResetSession?: () => void | Promise<void>;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: () => void | Promise<void>;
 *   close: () => Promise<void>;
 *   setItems: (items: HomePortfolioItem[]) => void;
 *   refresh: () => Promise<void>;
 *   showNotice: (opts: { title: string; body: string; closeLabel?: string; closeAria?: string }) => void;
 * }}
 */
export function createHomeScreen({
  onOpenPortfolio,
  onOpenReport,
  onAddPortfolio,
  onResetSession,
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

  const markLink = document.createElement("a");
  markLink.className = "home-screen__mark";
  markLink.href = "#";
  markLink.addEventListener("click", (event) => {
    event.preventDefault();
    /* Временно: сброс сессии по клику на логотип (dev). */
    void onResetSession?.();
  });

  markLink.innerHTML = brandMarkSvg("home-screen__mark-img");

  const topActions = document.createElement("div");
  topActions.className = "home-screen__top-actions";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "home-screen__chip home-screen__chip--submit";

  const plusImg = document.createElement("img");
  plusImg.className = "home-screen__chip-icon";
  plusImg.src = plusIconUrl;
  plusImg.alt = "";
  plusImg.width = 24;
  plusImg.height = 24;
  plusImg.decoding = "async";

  const addLabel = document.createElement("span");
  addLabel.className = "home-screen__chip-label";
  addBtn.append(plusImg, addLabel);

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

  const notifyBtn = document.createElement("button");
  notifyBtn.type = "button";
  notifyBtn.className = "home-screen__chip home-screen__chip--icon";

  const bellImg = document.createElement("img");
  bellImg.className = "home-screen__chip-icon";
  bellImg.src = bellIconUrl;
  bellImg.alt = "";
  bellImg.width = 24;
  bellImg.height = 24;
  bellImg.decoding = "async";
  notifyBtn.append(bellImg);

  const profileBtn = document.createElement("button");
  profileBtn.type = "button";
  profileBtn.className = "home-screen__profile home-screen__profile--letter";

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
  topActions.append(addBtn, balanceChip, notifyBtn, profileBtn);
  topbar.append(markLink, topActions);

  const body = document.createElement("div");
  body.className = "home-screen__body";

  const cluster = document.createElement("div");
  cluster.className = "home-screen__cluster";

  const feed = document.createElement("div");
  feed.className = "home-screen__feed";

  const list = document.createElement("ul");
  list.className = "home-screen__list";

  const empty = document.createElement("p");
  empty.className = "home-screen__empty";
  empty.hidden = true;

  feed.append(list, empty);
  /* Рейтинг (`createRatingPanel`) пока не монтируем — см. src/components/rating/. */
  cluster.append(feed);
  body.append(cluster);

  const lockedBackdrop = document.createElement("div");
  lockedBackdrop.className = "home-screen__locked-backdrop";
  lockedBackdrop.hidden = true;
  lockedBackdrop.setAttribute("aria-hidden", "true");

  const lockedDialog = document.createElement("div");
  lockedDialog.className = "home-screen__locked-dialog";
  lockedDialog.setAttribute("role", "dialog");
  lockedDialog.setAttribute("aria-modal", "true");
  lockedDialog.setAttribute("aria-labelledby", "home-submit-locked-title");

  const lockedTitle = document.createElement("h2");
  lockedTitle.className = "home-screen__locked-title";
  lockedTitle.id = "home-submit-locked-title";

  const lockedBody = document.createElement("p");
  lockedBody.className = "home-screen__locked-body";

  const lockedClose = document.createElement("button");
  lockedClose.type = "button";
  lockedClose.className = "home-screen__locked-close";

  lockedDialog.append(lockedTitle, lockedBody, lockedClose);
  lockedBackdrop.append(lockedDialog);

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

  tabbar.append(tabThumb, feedTab, mineTab);
  root.append(title, topbar, body, tabbar, lockedBackdrop);

  /** @type {HomePortfolioItem[]} */
  let items = [];
  let loading = false;
  /** @type {ReturnType<typeof window.setInterval> | null} */
  let slotsPollId = null;
  /** Показать stagger-reveal при смене skeleton → контент. */
  let revealItems = false;
  /** @type {HomeTabId} */
  let activeTab = "feed";
  let lastScrollTop = 0;
  let tabbarHidden = false;
  let tabbarOnDark = false;
  let tabbarContrastRaf = 0;
  /** @type {string | null} */
  let tabbarContrastProbeKey = null;

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
    markLink.setAttribute("aria-label", t.brandLogoAlt);
    list.setAttribute(
      "aria-label",
      loading
        ? t.homeListLoadingAria
        : activeTab === "mine"
          ? t.homeListMineAria
          : t.homeListAria,
    );
    empty.textContent =
      activeTab === "mine" ? t.homeEmptyMine : t.homeEmpty;
    feedTab.textContent = t.homeTabFeed;
    mineTab.textContent = t.homeTabMine;
    tabbar.setAttribute("aria-label", t.homeTabsAria);
    addLabel.textContent = t.homeAddPortfolio;
    addBtn.setAttribute("aria-label", t.homeAddPortfolio);
    addBtn.title = t.homeAddPortfolio;
    markLink.title = t.homeResetSessionTitle;

    lockedTitle.textContent = t.homeSubmitLockedTitle;
    lockedBody.textContent = t.homeSubmitLocked;
    lockedClose.textContent = t.homeSubmitLockedClose;
    lockedClose.setAttribute("aria-label", t.homeSubmitLockedCloseAria);

    const balance = getBalance();
    balanceValue.textContent = String(balance);
    balanceChip.setAttribute(
      "aria-label",
      formatString(t.homeBalanceAria, { balance }),
    );
    balanceChip.title = formatString(t.homeBalance, { balance });
    notifyBtn.setAttribute("aria-label", t.homeNotificationsAria);
    profileBtn.setAttribute("aria-label", t.homeProfileAria);

    syncProfileAvatar();
    scheduleTabThumbSync();
  }

  function openSubmitLockedModal() {
    const t = getStrings();
    lockedTitle.textContent = t.homeSubmitLockedTitle;
    lockedBody.textContent = t.homeSubmitLocked;
    lockedClose.textContent = t.homeSubmitLockedClose;
    lockedClose.setAttribute("aria-label", t.homeSubmitLockedCloseAria);
    lockedBackdrop.hidden = false;
    lockedBackdrop.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      lockedBackdrop.classList.add("home-screen__locked-backdrop--open");
      lockedClose.focus();
    });
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
    lockedTitle.textContent = opts.title;
    lockedBody.textContent = opts.body;
    lockedClose.textContent = opts.closeLabel || t.homeSubmitLockedClose;
    lockedClose.setAttribute(
      "aria-label",
      opts.closeAria || opts.closeLabel || t.homeSubmitLockedCloseAria,
    );
    lockedBackdrop.hidden = false;
    lockedBackdrop.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      lockedBackdrop.classList.add("home-screen__locked-backdrop--open");
      lockedClose.focus();
    });
  }

  function closeSubmitLockedModal() {
    lockedBackdrop.classList.remove("home-screen__locked-backdrop--open");
    lockedBackdrop.setAttribute("aria-hidden", "true");
    lockedBackdrop.hidden = true;
  }

  /**
   * @param {boolean} hidden
   */
  function setTabbarHidden(hidden) {
    if (tabbarHidden === hidden) return;
    tabbarHidden = hidden;
    tabbar.classList.toggle("home-screen__tabbar--hidden", hidden);
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

  /**
   * @param {HomeTabId} tab
   */
  function syncTabButtons(tab) {
    const isFeed = tab === "feed";
    feedTab.classList.toggle("home-screen__tab--active", isFeed);
    mineTab.classList.toggle("home-screen__tab--active", !isFeed);
    feedTab.setAttribute("aria-selected", isFeed ? "true" : "false");
    mineTab.setAttribute("aria-selected", isFeed ? "false" : "true");
    syncTabThumb();
  }

  /** Скользящий пилл активного таба (ширина/смещение по layout). */
  function syncTabThumb(instant = false) {
    const activeEl = activeTab === "mine" ? mineTab : feedTab;
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
   */
  async function setActiveTab(tab) {
    if (activeTab === tab) return;
    activeTab = tab;
    syncTabButtons(tab);
    showTabbar();
    body.scrollTop = 0;
    lastScrollTop = 0;
    setLoading(true);
    syncCopy();
    await refresh();
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
   * @param {boolean} next
   */
  function setLoading(next) {
    loading = next;
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
    preview.className = "home-screen__preview";

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
      scheduleTabbarContrastSync();
    });
    previewImg.addEventListener("error", () => {
      previewImg.remove();
      preview.classList.add("home-screen__preview--empty");
      scheduleTabbarContrastSync();
    });
    preview.append(previewImg);

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
      platformImg.width = 52;
      platformImg.height = 52;
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
      avatarImg.width = 52;
      avatarImg.height = 52;
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

    const text = document.createElement("div");
    text.className = "home-screen__card-text";

    const name = document.createElement("p");
    name.className = "home-screen__card-name";
    name.textContent = item.name || item.url;

    const role = document.createElement("p");
    role.className = "home-screen__card-role";
    role.textContent = item.role || t.homeDefaultRole;

    text.append(name, role);
    person.append(badges, text);

    const total = Math.max(1, Number(item.targetReviews) || 1);

    const progress = document.createElement("div");
    progress.className = "home-screen__card-progress";

    const slots = document.createElement("div");
    slots.className = "home-screen__reviewer-slots";
    const filledSlots = Array.isArray(item.reviewerSlots)
      ? item.reviewerSlots.slice(0, total)
      : [];
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
        slot.setAttribute("aria-hidden", "true");
        const plusImg = document.createElement("img");
        plusImg.className = "home-screen__reviewer-slot-plus";
        plusImg.src = slotPlusIconUrl;
        plusImg.alt = "";
        plusImg.width = 18;
        plusImg.height = 18;
        plusImg.decoding = "async";
        plusImg.setAttribute("aria-hidden", "true");
        slot.append(plusImg);
        slots.append(slot);
        continue;
      }
      if (slotData.kind === "active") {
        slot.classList.add("home-screen__reviewer-slot--active");
      } else {
        slot.classList.add("home-screen__reviewer-slot--completed");
      }
      const slotAvatar =
        typeof slotData.avatarUrl === "string" ? slotData.avatarUrl.trim() : "";
      const slotLetter = initialFromLabel(
        slotData.displayName || slotData.reviewerId || "?",
      );
      if (slotAvatar) {
        const slotImg = document.createElement("img");
        slotImg.className = "home-screen__reviewer-slot-img";
        slotImg.alt = "";
        slotImg.width = 24;
        slotImg.height = 24;
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

    progress.append(slots);

    meta.append(person, progress);
    button.append(preview, meta);

    if (item.isOwn) {
      button.classList.add("home-screen__card--own");
      button.title = t.homeCardReportTitle;
      button.setAttribute("aria-label", t.homeCardReportAria);
      button.addEventListener("click", () => {
        void onOpenReport?.(item);
      });
    } else if (item.reviewedByMe) {
      button.classList.add("home-screen__card--reviewed");
      button.title = t.homeAlreadyReviewedTitle;
      button.setAttribute("aria-label", t.homeAlreadyReviewedTitle);
      button.addEventListener("click", () => {
        void onOpenPortfolio(item);
      });
    } else {
      button.addEventListener("click", () => {
        void onOpenPortfolio(item);
      });
    }

    li.append(button);
    return li;
  }

  function renderList() {
    list.replaceChildren();
    empty.hidden = items.length > 0;
    const t = getStrings();
    list.setAttribute(
      "aria-label",
      activeTab === "mine" ? t.homeListMineAria : t.homeListAria,
    );

    for (const [index, item] of items.entries()) {
      const li = createCard(item);
      if (revealItems) {
        li.classList.add("motion-reveal");
        li.style.setProperty(
          "--reveal-delay",
          `calc(var(--motion-stagger) * ${index})`,
        );
      }
      list.append(li);
    }
    revealItems = false;
    scheduleTabbarContrastSync();
  }

  /**
   * @param {HomePortfolioItem[]} next
   */
  function setItems(next) {
    items = Array.isArray(next) ? next : [];
    renderList();
  }

  async function refresh() {
    await refreshWalletFromServer();
    syncCopy();
    const next =
      activeTab === "mine"
        ? await listMyPortfolios()
        : await listPortfoliosForReview();
    revealItems = loading;
    loading = false;
    root.setAttribute("aria-busy", "false");
    setItems(next);
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
      if (root.hidden || document.visibilityState !== "visible") return;
      void refresh();
    }, HOME_SLOTS_POLL_MS);
  }

  async function open() {
    root.hidden = false;
    root.classList.remove("home-screen--open");
    syncTabButtons(activeTab);
    showTabbar();
    lastScrollTop = 0;
    body.scrollTop = 0;
    syncCopy();
    setLoading(true);
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
    root.classList.remove("home-screen--open");
    loading = false;
    revealItems = false;
    showTabbar();
    closeSubmitLockedModal();
    root.setAttribute("aria-busy", "false");
    root.hidden = true;
    return Promise.resolve();
  }

  body.addEventListener(
    "scroll",
    () => {
      const scrollTop = body.scrollTop;
      const delta = scrollTop - lastScrollTop;
      if (scrollTop <= 0 || delta < 0) {
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
  }

  window.addEventListener("resize", () => {
    scheduleTabThumbSync();
    scheduleTabbarContrastSync();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (root.hidden) return;
    void refresh();
  });

  feedTab.addEventListener("click", () => {
    void setActiveTab("feed");
  });

  mineTab.addEventListener("click", () => {
    void setActiveTab("mine");
  });

  addBtn.addEventListener("click", () => {
    if (!canSubmitPortfolio()) {
      openSubmitLockedModal();
      return;
    }
    void onAddPortfolio?.();
  });

  balanceChip.addEventListener("click", () => {
    void creditBalance(DEV_CREDIT_AMOUNT).then(() => {
      syncCopy();
    });
  });

  lockedClose.addEventListener("click", () => {
    closeSubmitLockedModal();
  });

  lockedBackdrop.addEventListener("click", (event) => {
    if (event.target === lockedBackdrop) {
      closeSubmitLockedModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (lockedBackdrop.hidden) return;
    closeSubmitLockedModal();
  });

  notifyBtn.addEventListener("click", () => {
    /* Заглушка: уведомления появятся позже */
  });

  profileBtn.addEventListener("click", () => {
    /* Заглушка: профиль появится позже */
  });

  syncCopy();
  renderList();

  return { root, open, close, setItems, refresh, showNotice };
}
