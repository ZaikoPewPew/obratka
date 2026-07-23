import { formatString, getStrings } from "../../i18n.js";
import {
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
import brandLogoUrl from "../../assets/brand/logo.svg";
import boneIconUrl from "../../assets/home/bone.svg";
import bellIconUrl from "../../assets/home/bell.svg";
import plusIconUrl from "../../assets/home/plus.svg";

/** Сколько монет даёт dev-кнопка на главной. */
const DEV_CREDIT_AMOUNT = 10;

/** Сколько skeleton-карточек показывать, пока грузится лента. */
const SKELETON_CARD_COUNT = 5;

/**
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
 *   onAddPortfolio?: () => void | Promise<void>;
 *   onResetSession?: () => void | Promise<void>;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: () => void | Promise<void>;
 *   close: () => Promise<void>;
 *   setItems: (items: HomePortfolioItem[]) => void;
 *   refresh: () => Promise<void>;
 * }}
 */
export function createHomeScreen({
  onOpenPortfolio,
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
  });

  const markImg = document.createElement("img");
  markImg.className = "home-screen__mark-img";
  markImg.src = brandLogoUrl;
  markImg.alt = "";
  markImg.width = 44;
  markImg.height = 30;
  markImg.decoding = "async";
  markLink.append(markImg);

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

  const footer = document.createElement("div");
  footer.className = "home-screen__footer";

  const addCoinsBtn = document.createElement("button");
  addCoinsBtn.type = "button";
  addCoinsBtn.className = "iframe-shell__btn home-screen__reset";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "iframe-shell__btn home-screen__reset";

  footer.append(addCoinsBtn, resetBtn);
  feed.append(list, empty, footer);

  const aside = document.createElement("aside");
  aside.className = "home-screen__aside";
  aside.setAttribute("aria-hidden", "true");

  const asidePanel = document.createElement("div");
  asidePanel.className = "home-screen__aside-panel";
  aside.append(asidePanel);

  cluster.append(aside, feed);
  body.append(cluster);
  root.append(title, topbar, body);

  /** @type {HomePortfolioItem[]} */
  let items = [];
  let loading = false;
  /** Показать stagger-reveal при смене skeleton → контент. */
  let revealItems = false;

  function showProfileLetter(letter) {
    const initial = letter && letter !== "?" ? letter : "?";
    profileLetter.textContent = initial;
    profileLetter.hidden = false;
    profileImg.hidden = true;
    profileImg.removeAttribute("src");
    profileImg.onload = null;
    profileImg.onerror = null;
    profileBtn.classList.add("home-screen__profile--letter");
  }

  /**
   * Есть URL → пробуем фото; нет / ошибка загрузки → фон + буква имени.
   * @param {string} src
   * @param {string} letter
   */
  function showProfilePhoto(src, letter) {
    profileLetter.textContent = letter;
    profileImg.referrerPolicy = "no-referrer";
    profileImg.onload = () => {
      profileImg.hidden = false;
      profileLetter.hidden = true;
      profileBtn.classList.remove("home-screen__profile--letter");
    };
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
    markImg.alt = t.brandLogoAlt;
    list.setAttribute(
      "aria-label",
      loading ? t.homeListLoadingAria : t.homeListAria,
    );
    empty.textContent = t.homeEmpty;
    addLabel.textContent = t.homeAddPortfolio;
    addBtn.setAttribute("aria-label", t.homeAddPortfolio);
    addBtn.title = t.homeAddPortfolio;
    addCoinsBtn.textContent = formatString(t.homeAddCoins, {
      amount: DEV_CREDIT_AMOUNT,
    });
    addCoinsBtn.title = formatString(t.homeAddCoinsTitle, {
      amount: DEV_CREDIT_AMOUNT,
    });
    resetBtn.textContent = t.homeResetSession;
    resetBtn.title = t.homeResetSessionTitle;

    const balance = getBalance();
    balanceValue.textContent = String(balance);
    balanceChip.setAttribute(
      "aria-label",
      formatString(t.homeBalanceAria, { balance }),
    );
    balanceChip.title = formatString(t.homeBalance, { balance });
    notifyBtn.setAttribute("aria-label", t.homeNotificationsAria);
    profileBtn.setAttribute("aria-label", t.homeProfileAria);

    const locked = !canSubmitPortfolio();
    addBtn.disabled = locked;
    if (locked) {
      addBtn.title = t.homeSubmitLocked;
    }

    syncProfileAvatar();
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
    preview.className = "home-screen__preview home-screen__skeleton-bone";

    const meta = document.createElement("div");
    meta.className = "home-screen__card-meta";

    const person = document.createElement("div");
    person.className = "home-screen__card-person";

    const badges = document.createElement("div");
    badges.className = "home-screen__card-badges";

    const platform = document.createElement("span");
    platform.className =
      "home-screen__badge home-screen__badge--platform home-screen__skeleton-bone";

    const avatar = document.createElement("span");
    avatar.className =
      "home-screen__badge home-screen__badge--avatar home-screen__skeleton-bone";

    badges.append(platform, avatar);

    const text = document.createElement("div");
    text.className = "home-screen__card-text";

    const nameBone = document.createElement("span");
    nameBone.className =
      "home-screen__skeleton-line home-screen__skeleton-line--name";

    const roleBone = document.createElement("span");
    roleBone.className =
      "home-screen__skeleton-line home-screen__skeleton-line--role";

    text.append(nameBone, roleBone);
    person.append(badges, text);

    const count = document.createElement("span");
    count.className = "home-screen__card-count home-screen__skeleton-bone";

    meta.append(person, count);
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
   * @param {boolean} next
   */
  function setLoading(next) {
    loading = next;
    root.classList.toggle("home-screen--loading", loading);
    root.setAttribute("aria-busy", loading ? "true" : "false");
    const t = getStrings();
    list.setAttribute(
      "aria-label",
      loading ? t.homeListLoadingAria : t.homeListAria,
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
    previewImg.addEventListener("error", () => {
      previewImg.remove();
      preview.classList.add("home-screen__preview--empty");
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
    const current = Math.min(
      total,
      Math.max(0, Number(item.reviewsCount) || 0),
    );
    const count = document.createElement("span");
    count.className = "home-screen__card-count";
    count.textContent = formatString(t.homeCardProgress, {
      current,
      total,
    });

    meta.append(person, count);
    button.append(preview, meta);

    if (item.isOwn) {
      button.disabled = true;
      button.classList.add("home-screen__card--own");
      button.title = t.homeCardOwnTitle;
      button.setAttribute("aria-label", t.homeCardOwnAria);
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
    list.setAttribute("aria-label", getStrings().homeListAria);

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
    const next = await listPortfoliosForReview();
    revealItems = loading;
    loading = false;
    root.classList.remove("home-screen--loading");
    root.setAttribute("aria-busy", "false");
    setItems(next);
  }

  async function open() {
    root.hidden = false;
    root.classList.remove("home-screen--open");
    syncCopy();
    setLoading(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("home-screen--open");
      });
    });
    await refresh();
  }

  /**
   * @returns {Promise<void>}
   */
  function close() {
    root.classList.remove("home-screen--open", "home-screen--loading");
    loading = false;
    revealItems = false;
    root.setAttribute("aria-busy", "false");
    root.hidden = true;
    return Promise.resolve();
  }

  addBtn.addEventListener("click", () => {
    if (addBtn.disabled) return;
    void onAddPortfolio?.();
  });

  balanceChip.addEventListener("click", () => {
    void creditBalance(DEV_CREDIT_AMOUNT).then(() => {
      syncCopy();
    });
  });

  addCoinsBtn.addEventListener("click", () => {
    void creditBalance(DEV_CREDIT_AMOUNT).then(() => {
      syncCopy();
    });
  });

  resetBtn.addEventListener("click", () => {
    void onResetSession?.();
  });

  notifyBtn.addEventListener("click", () => {
    /* Заглушка: уведомления появятся позже */
  });

  profileBtn.addEventListener("click", () => {
    /* Заглушка: профиль появится позже */
  });

  syncCopy();
  renderList();

  return { root, open, close, setItems, refresh };
}
