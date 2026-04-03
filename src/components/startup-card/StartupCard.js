/**
 * Карточка стартапа (аватар + заголовок + описание).
 * @param {{ avatar: string; title: string; description: string }} item — данные из content/startups.json
 * @returns {HTMLDivElement}
 */
export function createStartupCard(item) {
  const { avatar, title, description } = item;

  const card = document.createElement("div");
  card.className = "startup-card";

  const img = document.createElement("img");
  img.className = "startup-card__avatar";
  img.src = avatar;
  img.alt = title;
  img.width = 48;
  img.height = 48;
  img.decoding = "async";

  const body = document.createElement("div");
  body.className = "startup-card__body";

  const titleEl = document.createElement("div");
  titleEl.className = "startup-card__title";
  titleEl.textContent = title;

  const descEl = document.createElement("div");
  descEl.className = "startup-card__description";
  descEl.textContent = description;

  body.append(titleEl, descEl);
  card.append(img, body);
  return card;
}

/** Разные углы наклона при падении (медленный дождь). */
const TILT_VARIANTS = ["tilt-a", "tilt-b", "tilt-c"];

/**
 * Обёртка для анимации падения в воду: трек + всплеск.
 * @param {{ avatar: string; title: string; description: string }} item
 * @param {number} index
 * @returns {HTMLDivElement}
 */
export function createStartupFallItem(item, index) {
  const tilt = TILT_VARIANTS[index % TILT_VARIANTS.length];
  const delaySlot = index % 3;
  const slot = index % 3;

  const itemEl = document.createElement("div");
  itemEl.className = `startup-fall__item startup-fall__item--${tilt} startup-fall__item--d${delaySlot} startup-fall__item--slot-${slot}`;

  const track = document.createElement("div");
  track.className = "startup-fall__track";

  const splash = document.createElement("span");
  splash.className = "startup-fall__splash";
  splash.setAttribute("aria-hidden", "true");

  track.append(createStartupCard(item), splash);
  itemEl.append(track);
  return itemEl;
}
