import { formatString, getStrings } from "../../i18n.js";
import { listPortfoliosForReview } from "../../api/portfolios.js";
import {
  canSubmitPortfolio,
  getBalance,
  SUBMIT_COST,
} from "../../api/wallet.js";

/**
 * @typedef {{
 *   id: string;
 *   url: string;
 *   name?: string;
 *   status?: string;
 * }} HomePortfolioItem
 */

/**
 * Главная: очередь портфолио + баланс + CTA «подать своё».
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

  const header = document.createElement("div");
  header.className = "home-screen__header";

  const title = document.createElement("h1");
  title.className = "home-screen__title";
  title.id = "home-screen-title";

  const balance = document.createElement("p");
  balance.className = "home-screen__balance";

  header.append(title, balance);

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

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "iframe-shell__btn home-screen__reset";

  footer.append(addBtn, hint, resetBtn);

  const inner = document.createElement("div");
  inner.className = "home-screen__inner";
  inner.append(header, list, empty, footer);
  root.append(inner);

  /** @type {HomePortfolioItem[]} */
  let items = [];

  function syncCopy() {
    const t = getStrings();
    title.textContent = t.homeTitle;
    list.setAttribute("aria-label", t.homeListAria);
    empty.textContent = t.homeEmpty;
    addBtn.textContent = t.homeAddPortfolio;
    resetBtn.textContent = t.homeResetSession;
    resetBtn.title = t.homeResetSessionTitle;
    balance.textContent = formatString(t.homeBalance, {
      balance: getBalance(),
    });

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
  }

  function renderList() {
    list.replaceChildren();
    empty.hidden = items.length > 0;

    for (const item of items) {
      const li = document.createElement("li");
      li.className = "home-screen__item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "home-screen__item-btn";
      button.textContent = item.name || item.url;
      button.addEventListener("click", () => {
        void onOpenPortfolio(item);
      });

      li.append(button);
      list.append(li);
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

  resetBtn.addEventListener("click", () => {
    void onResetSession?.();
  });

  syncCopy();
  renderList();

  return { root, open, close, setItems, refresh };
}
