import { getStrings } from "../../i18n.js";

/**
 * @typedef {{
 *   id: string;
 *   url: string;
 *   name?: string;
 *   status?: string;
 * }} HomePortfolioItem
 */

/**
 * Главная: список портфолио на ревью.
 * Stub: контейнер и API setItems; разметка списка — при реализации.
 *
 * @param {{
 *   onOpenPortfolio: (item: HomePortfolioItem) => void | Promise<void>;
 *   onAddPortfolio?: () => void | Promise<void>;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: () => void;
 *   close: () => Promise<void>;
 *   setItems: (items: HomePortfolioItem[]) => void;
 * }}
 */
export function createHomeScreen({ onOpenPortfolio, onAddPortfolio }) {
  const t = getStrings();

  const root = document.createElement("section");
  root.className = "home-screen";
  root.setAttribute("aria-labelledby", "home-screen-title");
  root.hidden = true;

  const title = document.createElement("h1");
  title.className = "home-screen__title";
  title.id = "home-screen-title";
  title.textContent = t.homeTitle;

  const list = document.createElement("ul");
  list.className = "home-screen__list";
  list.setAttribute("aria-label", t.homeListAria);

  const empty = document.createElement("p");
  empty.className = "home-screen__empty";
  empty.textContent = t.homeEmpty;
  empty.hidden = true;

  root.append(title, list, empty);

  /** @type {HomePortfolioItem[]} */
  let items = [];

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

  function open() {
    root.hidden = false;
    void onAddPortfolio;
  }

  /**
   * @returns {Promise<void>}
   */
  function close() {
    root.hidden = true;
    return Promise.resolve();
  }

  renderList();

  return { root, open, close, setItems };
}
