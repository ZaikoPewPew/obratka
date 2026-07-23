import { formatString, getStrings } from "../../i18n.js";
import {
  listPortfoliosForReview,
  portfolioPreviewUrl,
} from "../../api/portfolios.js";
import {
  canSubmitPortfolio,
  creditBalance,
  getBalance,
  SUBMIT_COST,
} from "../../api/wallet.js";
import { getSession } from "../../app/session.js";
import { resolvePlatformIcon } from "../../utils/platformBrandIcon.js";
import brandLogoUrl from "../../assets/brand/logo.svg";
import boneIconUrl from "../../assets/home/bone.svg";
import bellIconUrl from "../../assets/home/bell.svg";

/** Сколько монет даёт dev-кнопка на главной. */
const DEV_CREDIT_AMOUNT = 10;

/**
 * @typedef {{
 *   id: string;
 *   url: string;
 *   name?: string;
 *   role?: string;
 *   avatarUrl?: string;
 *   previewUrls?: string[];
 *   previewCount?: number;
 *   status?: string;
 * }} HomePortfolioItem
 */

/**
 * @param {string} url
 * @returns {string}
 */
function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
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
  profileBtn.className = "home-screen__profile";

  const profileImg = document.createElement("img");
  profileImg.className = "home-screen__profile-img";
  profileImg.alt = "";
  profileImg.width = 48;
  profileImg.height = 48;
  profileImg.decoding = "async";
  profileBtn.append(profileImg);

  topActions.append(balanceChip, notifyBtn, profileBtn);
  topbar.append(markLink, topActions);

  const body = document.createElement("div");
  body.className = "home-screen__body";

  const feed = document.createElement("div");
  feed.className = "home-screen__feed";

  const list = document.createElement("ul");
  list.className = "home-screen__list";

  const empty = document.createElement("p");
  empty.className = "home-screen__empty";
  empty.hidden = true;

  const footer = document.createElement("div");
  footer.className = "home-screen__footer";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "iframe-shell__btn home-screen__add";

  const hint = document.createElement("p");
  hint.className = "home-screen__hint";
  hint.hidden = true;

  const addCoinsBtn = document.createElement("button");
  addCoinsBtn.type = "button";
  addCoinsBtn.className = "iframe-shell__btn home-screen__reset";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "iframe-shell__btn home-screen__reset";

  footer.append(addBtn, hint, addCoinsBtn, resetBtn);
  feed.append(list, empty, footer);

  const aside = document.createElement("aside");
  aside.className = "home-screen__aside";
  aside.setAttribute("aria-hidden", "true");

  const asidePanel = document.createElement("div");
  asidePanel.className = "home-screen__aside-panel";
  aside.append(asidePanel);

  body.append(feed, aside);
  root.append(title, topbar, body);

  /** @type {HomePortfolioItem[]} */
  let items = [];

  function syncProfileAvatar() {
    const session = getSession();
    const telegramAvatar =
      typeof session?.avatarUrl === "string" ? session.avatarUrl.trim() : "";
    const email = typeof session?.email === "string" ? session.email.trim() : "";
    const src = telegramAvatar
      ? telegramAvatar
      : email && !email.endsWith("@t.me")
        ? `https://unavatar.io/${encodeURIComponent(email)}`
        : "";

    profileImg.referrerPolicy = "no-referrer";
    profileImg.hidden = false;
    profileImg.onerror = () => {
      profileImg.hidden = true;
      profileBtn.classList.add("home-screen__profile--empty");
    };
    profileImg.onload = () => {
      profileBtn.classList.remove("home-screen__profile--empty");
    };

    if (!src) {
      profileImg.removeAttribute("src");
      profileImg.hidden = true;
      profileBtn.classList.add("home-screen__profile--empty");
      return;
    }

    profileBtn.classList.remove("home-screen__profile--empty");
    profileImg.src = src;
  }

  function syncCopy() {
    const t = getStrings();
    title.textContent = t.homeTitle;
    markImg.alt = t.brandLogoAlt;
    list.setAttribute("aria-label", t.homeListAria);
    empty.textContent = t.homeEmpty;
    addBtn.textContent = t.homeAddPortfolio;
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
    balanceChip.title = formatString(t.homeAddCoinsTitle, {
      amount: DEV_CREDIT_AMOUNT,
    });
    notifyBtn.setAttribute("aria-label", t.homeNotificationsAria);
    profileBtn.setAttribute("aria-label", t.homeProfileAria);

    const locked = !canSubmitPortfolio();
    addBtn.disabled = locked;
    if (locked) {
      hint.textContent = t.homeSubmitLocked;
      hint.hidden = false;
      addBtn.setAttribute("aria-describedby", "home-screen-hint");
      hint.id = "home-screen-hint";
    } else {
      hint.textContent = formatString(t.homeSubmitCost, { cost: SUBMIT_COST });
      hint.hidden = false;
      hint.id = "home-screen-hint";
      addBtn.setAttribute("aria-describedby", "home-screen-hint");
    }

    syncProfileAvatar();
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

    const host = hostFromUrl(item.url);
    const platform = document.createElement("span");
    platform.className = "home-screen__badge home-screen__badge--platform";
    const platformImg = document.createElement("img");
    platformImg.className = "home-screen__badge-img";
    platformImg.alt = "";
    platformImg.width = 52;
    platformImg.height = 52;
    platformImg.decoding = "async";
    platformImg.loading = "lazy";
    platformImg.referrerPolicy = "no-referrer";
    const platformIcon = resolvePlatformIcon(item.url);
    if (platformIcon) {
      platformImg.src = platformIcon.src;
      bindImageFallbacks(platformImg, platformIcon.fallbacks);
    } else {
      platform.hidden = true;
    }
    platform.append(platformImg);

    const avatar = document.createElement("span");
    avatar.className = "home-screen__badge home-screen__badge--avatar";
    const avatarImg = document.createElement("img");
    avatarImg.className = "home-screen__badge-img";
    avatarImg.alt = "";
    avatarImg.width = 52;
    avatarImg.height = 52;
    avatarImg.decoding = "async";
    avatarImg.loading = "lazy";
    avatarImg.referrerPolicy = "no-referrer";
    const avatarSrc =
      item.avatarUrl ||
      (host ? `https://unavatar.io/${encodeURIComponent(host)}` : "");
    if (avatarSrc) {
      avatarImg.src = avatarSrc;
      avatarImg.addEventListener("error", () => {
        avatarImg.remove();
        avatar.classList.add("home-screen__badge--empty");
      });
      avatar.append(avatarImg);
    } else {
      avatar.classList.add("home-screen__badge--empty");
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

    const total = Math.max(1, Number(item.previewCount) || 1);
    const count = document.createElement("span");
    count.className = "home-screen__card-count";
    count.textContent = formatString(t.homeCardProgress, {
      current: 1,
      total,
    });

    meta.append(person, count);
    button.append(preview, meta);
    button.addEventListener("click", () => {
      void onOpenPortfolio(item);
    });

    li.append(button);
    return li;
  }

  function renderList() {
    list.replaceChildren();
    empty.hidden = items.length > 0;

    for (const item of items) {
      list.append(createCard(item));
    }
  }

  /**
   * @param {HomePortfolioItem[]} next
   */
  function setItems(next) {
    items = Array.isArray(next) ? next : [];
    renderList();
  }

  async function refresh() {
    syncCopy();
    const next = await listPortfoliosForReview();
    setItems(next);
  }

  async function open() {
    root.hidden = false;
    root.classList.remove("home-screen--open");
    syncCopy();
    renderList();
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
    root.classList.remove("home-screen--open");
    root.hidden = true;
    return Promise.resolve();
  }

  addBtn.addEventListener("click", () => {
    if (addBtn.disabled) return;
    void onAddPortfolio?.();
  });

  balanceChip.addEventListener("click", () => {
    creditBalance(DEV_CREDIT_AMOUNT);
    syncCopy();
  });

  addCoinsBtn.addEventListener("click", () => {
    creditBalance(DEV_CREDIT_AMOUNT);
    syncCopy();
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
