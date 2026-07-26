import { getStrings } from "../../i18n.js";

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
 * Левый sticky aside на home: кто из legendary сейчас online.
 *
 * @returns {{
 *   root: HTMLElement;
 *   setItems: (items: LegendaryOnlineItem[]) => void;
 *   syncCopy: () => void;
 * }}
 */
export function createLegendaryOnlinePanel() {
  const root = document.createElement("aside");
  root.className = "legendary-online-panel";
  root.setAttribute("aria-hidden", "false");

  const surface = document.createElement("div");
  surface.className = "legendary-online-panel__surface";

  const title = document.createElement("h2");
  title.className = "legendary-online-panel__title";

  const list = document.createElement("ul");
  list.className = "legendary-online-panel__list";

  const empty = document.createElement("p");
  empty.className = "legendary-online-panel__empty";

  surface.append(title, list, empty);
  root.append(surface);

  /** @type {LegendaryOnlineItem[]} */
  let items = [];

  function syncCopy() {
    const t = getStrings();
    title.textContent = t.homeLegendaryOnlineTitle ?? "";
    empty.textContent = t.homeLegendaryOnlineEmpty ?? "";
    root.setAttribute("aria-label", t.homeLegendaryOnlineAria ?? "");
    list.setAttribute("aria-label", t.homeLegendaryOnlineAria ?? "");
    render();
  }

  function render() {
    const t = getStrings();
    const fallback = t.homeLegendaryOnlineNameFallback ?? "";
    list.replaceChildren();

    const hasItems = items.length > 0;
    empty.hidden = hasItems;
    list.hidden = !hasItems;

    for (const item of items) {
      const li = document.createElement("li");
      li.className = "legendary-online-panel__item";

      const avatar = document.createElement("span");
      avatar.className = "legendary-online-panel__avatar";

      const name =
        typeof item.displayName === "string" && item.displayName.trim()
          ? item.displayName.trim()
          : fallback;
      const letter = initialFromLabel(name);
      const avatarSrc =
        typeof item.avatarUrl === "string" ? item.avatarUrl.trim() : "";

      if (avatarSrc) {
        const img = document.createElement("img");
        img.className = "legendary-online-panel__avatar-img";
        img.alt = "";
        img.width = 36;
        img.height = 36;
        img.decoding = "async";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.addEventListener("error", () => {
          img.remove();
          avatar.classList.add("legendary-online-panel__avatar--letter");
          const letterEl = document.createElement("span");
          letterEl.className = "legendary-online-panel__avatar-letter";
          letterEl.textContent = letter;
          avatar.append(letterEl);
        });
        img.src = avatarSrc;
        avatar.append(img);
      } else {
        avatar.classList.add("legendary-online-panel__avatar--letter");
        const letterEl = document.createElement("span");
        letterEl.className = "legendary-online-panel__avatar-letter";
        letterEl.textContent = letter;
        avatar.append(letterEl);
      }

      const onlineDot = document.createElement("span");
      onlineDot.className = "legendary-online-panel__dot";
      onlineDot.setAttribute("aria-hidden", "true");
      avatar.append(onlineDot);

      const nameEl = document.createElement("span");
      nameEl.className = "legendary-online-panel__name";
      nameEl.textContent = name;

      li.append(avatar, nameEl);
      list.append(li);
    }
  }

  /**
   * @param {LegendaryOnlineItem[]} next
   */
  function setItems(next) {
    items = Array.isArray(next) ? next : [];
    render();
  }

  syncCopy();

  return { root, setItems, syncCopy };
}
