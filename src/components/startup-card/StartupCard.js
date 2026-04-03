/**
 * Карточка стартапа (аватар + заголовок + описание).
 * @param {{ avatar: string; title: string; description: string }} item — данные из content/startups.json
 * @param {{ variant?: 'default' | 'ambient' }} [options]
 * @returns {HTMLDivElement}
 */
export function createStartupCard(item, options = {}) {
  const { variant = "default" } = options;
  const ambient = variant === "ambient";
  const { avatar, title, description } = item;

  const card = document.createElement("div");
  card.className = ambient ? "startup-card startup-card--ambient" : "startup-card";

  const img = document.createElement("img");
  img.className = "startup-card__avatar";
  img.src = avatar;
  img.alt = title;
  img.width = ambient ? 32 : 48;
  img.height = ambient ? 32 : 48;
  img.decoding = "async";
  img.draggable = false;

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

/** Сколько фоновых карточек (передний план — отдельно, см. mountStartupFall). */
const AMBIENT_COUNT = 9;

/** Одна и та же длительность цикла = одинаковая скорость падения на фоне (linear в CSS). */
const AMBIENT_DURATION_SEC = 56;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Фоновые заблюренные карточки (CSS-дождь, без физики и крыши).
 * Позиции и траектории случайны при каждой загрузке.
 * @param {{ avatar: string; title: string; description: string }} item
 * @returns {HTMLDivElement}
 */
export function createAmbientFallItem(item) {
  const wrap = document.createElement("div");
  wrap.className = "startup-fall-back__item";

  /* Случайный разброс: % по ширине + сдвиг в px, фаза по задержке, разные dx/y0/углы */
  const leftPct = rand(0, 93);
  const xoff = rand(-96, 96);
  const delay = -rand(0, AMBIENT_DURATION_SEC);
  const dx = rand(-200, 200);
  const y0 = -rand(8, 62);
  const r0 = rand(-24, 24);
  const r1 = rand(-22, 22);

  wrap.style.setProperty("--amb-x", `${leftPct}%`);
  wrap.style.setProperty("--amb-xoff", `${xoff}px`);
  wrap.style.setProperty("--amb-delay", `${delay}s`);
  wrap.style.setProperty("--amb-dur", `${AMBIENT_DURATION_SEC}s`);
  wrap.style.setProperty("--amb-dx", `${dx}px`);
  wrap.style.setProperty("--amb-y0", `${y0}vh`);
  wrap.style.setProperty("--amb-r0", `${r0}deg`);
  wrap.style.setProperty("--amb-r1", `${r1}deg`);

  wrap.append(createStartupCard(item, { variant: "ambient" }));
  return wrap;
}

/**
 * @param {Array<{ avatar: string; title: string; description: string }>} items
 * @returns {DocumentFragment}
 */
export function createAmbientFallLayer(items) {
  const frag = document.createDocumentFragment();
  if (items.length === 0) {
    return frag;
  }
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    const item = items[Math.floor(Math.random() * items.length)];
    frag.append(createAmbientFallItem(item));
  }
  return frag;
}
