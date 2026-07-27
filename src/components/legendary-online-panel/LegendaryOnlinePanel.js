import { getStrings } from "../../i18n.js";

/** Сколько аватаров показываем в чипе (остальные только в aria). */
const MAX_VISIBLE_AVATARS = 3;

/**
 * @typedef {{
 *   id: string;
 *   displayName?: string;
 *   avatarUrl?: string;
 * }} LegendaryOnlineItem
 */

/**
 * @param {string} label
 * @returns {string}
 */
function initialFromLabel(label) {
  const trimmed = typeof label === "string" ? label.trim() : "";
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

/**
 * Fixed-чип «p4p в сети» слева снизу на home (Figma 489:3318).
 * Скрыт, пока нет online legendary; при появлении — въезд снизу (`motion-reveal`).
 * Клик / Enter / Space → explainer (Figma 492:4009).
 *
 * @param {{ onOpen?: () => void }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   setItems: (items: LegendaryOnlineItem[]) => void;
 *   syncCopy: () => void;
 * }}
 */
export function createLegendaryOnlinePanel(opts = {}) {
  const onOpen = typeof opts.onOpen === "function" ? opts.onOpen : null;

  const root = document.createElement("aside");
  root.className = "legendary-online-panel";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");

  const avatars = document.createElement("ul");
  avatars.className = "legendary-online-panel__avatars";
  avatars.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "legendary-online-panel__label";

  root.append(avatars, label);

  /** @type {LegendaryOnlineItem[]} */
  let items = [];
  let wasVisible = false;

  function syncCopy() {
    const t = getStrings();
    label.textContent = t.homeLegendaryOnlineTitle ?? "";
    root.setAttribute("aria-label", t.homeLegendaryOnlineAria ?? "");
    render();
  }

  /**
   * @param {LegendaryOnlineItem} item
   * @param {string} fallback
   * @returns {HTMLLIElement}
   */
  function createAvatarItem(item, fallback) {
    const li = document.createElement("li");
    li.className = "legendary-online-panel__avatar";

    const name =
      typeof item.displayName === "string" && item.displayName.trim()
        ? item.displayName.trim()
        : fallback;
    if (name) {
      const tip = document.createElement("span");
      tip.className = "legendary-online-panel__tip";
      tip.setAttribute("aria-hidden", "true");
      tip.textContent = name;
      li.append(tip);
    }

    const letter = initialFromLabel(name);
    const avatarSrc =
      typeof item.avatarUrl === "string" ? item.avatarUrl.trim() : "";

    if (avatarSrc) {
      const img = document.createElement("img");
      img.className = "legendary-online-panel__avatar-img";
      img.alt = "";
      img.width = 32;
      img.height = 32;
      img.decoding = "async";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", () => {
        img.remove();
        li.classList.add("legendary-online-panel__avatar--letter");
        const letterEl = document.createElement("span");
        letterEl.className = "legendary-online-panel__avatar-letter";
        letterEl.textContent = letter;
        li.append(letterEl);
      });
      img.src = avatarSrc;
      li.append(img);
    } else {
      li.classList.add("legendary-online-panel__avatar--letter");
      const letterEl = document.createElement("span");
      letterEl.className = "legendary-online-panel__avatar-letter";
      letterEl.textContent = letter;
      li.append(letterEl);
    }

    const onlineDot = document.createElement("span");
    onlineDot.className = "legendary-online-panel__dot";
    onlineDot.setAttribute("aria-hidden", "true");
    li.append(onlineDot);

    return li;
  }

  function render() {
    const t = getStrings();
    const fallback = t.homeLegendaryOnlineNameFallback ?? "";
    const visibleItems = items.slice(0, MAX_VISIBLE_AVATARS);

    avatars.replaceChildren();
    for (const item of visibleItems) {
      avatars.append(createAvatarItem(item, fallback));
    }

    const visible = items.length > 0;
    root.hidden = !visible;
    root.setAttribute("aria-hidden", visible ? "false" : "true");
    if (onOpen) {
      root.tabIndex = visible ? 0 : -1;
      root.setAttribute("role", "button");
    }

    if (visible && !wasVisible) {
      root.classList.remove("legendary-online-panel--enter");
      // reflow, чтобы повторно проиграть enter при 0 → N
      void root.offsetWidth;
      root.classList.add("legendary-online-panel--enter");
    } else if (!visible) {
      root.classList.remove("legendary-online-panel--enter");
    }

    wasVisible = visible;
  }

  /**
   * @param {LegendaryOnlineItem[]} next
   */
  function setItems(next) {
    items = Array.isArray(next) ? next.filter((item) => item?.id) : [];
    render();
  }

  if (onOpen) {
    root.addEventListener("click", () => {
      if (root.hidden) return;
      onOpen();
    });
    root.addEventListener("keydown", (event) => {
      if (root.hidden) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onOpen();
    });
  }

  syncCopy();

  return { root, setItems, syncCopy };
}
