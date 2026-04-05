import founderAvatars from "../content/founder-avatars.json";
import locales from "../content/locales.json";
import startups from "../content/startups.json";

const STORAGE_KEY = "memento.locale";

/** Самоназвание языка для aria-label кнопки смены (следующий язык в цикле). */
export const LOCALE_NATIVE_NAMES = {
  ru: "Русский",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  pt: "Português",
  es: "Español",
};

/**
 * Следующая локаль в порядке `supportedLocales` (цикл).
 * @param {string} current
 * @returns {string}
 */
export function getNextLocale(current) {
  const list = locales.supportedLocales;
  let i = list.indexOf(current);
  if (i < 0) {
    i = list.indexOf(locales.defaultLocale);
  }
  if (i < 0) {
    i = 0;
  }
  return list[(i + 1) % list.length];
}

/** Порядок языков в десктопном меню (как в `supportedLocales`). */
export function getSupportedLocales() {
  return [...locales.supportedLocales];
}

/**
 * Текущая локаль: ?lang=… из supportedLocales, иначе defaultLocale (английский без параметра в URL).
 * Новые языки — в content/locales.json (supportedLocales + блок locales).
 */
export function getLocale() {
  const supported = locales.supportedLocales;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("lang");
  if (fromUrl && supported.includes(fromUrl)) {
    return fromUrl;
  }
  return locales.defaultLocale;
}

/**
 * Сохраняет локаль и перезагружает: для defaultLocale — чистый URL без ?lang=, иначе ?lang=…
 * @param {string} next
 */
export function setLocale(next) {
  const supported = locales.supportedLocales;
  if (!supported.includes(next)) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  if (next === locales.defaultLocale) {
    url.searchParams.delete("lang");
  } else {
    url.searchParams.set("lang", next);
  }
  window.location.href = url.toString();
}

export function getStrings(locale = getLocale()) {
  const block = locales.locales[locale];
  if (block) {
    return block;
  }
  return locales.locales[locales.defaultLocale];
}

export function getConfig() {
  return {
    timerEnd: locales.timerEnd,
  };
}

/**
 * Для RU: сначала `itemsRu`, затем из `itemsWorld` всё, чего ещё нет по `title` (без дублей).
 * Так короткий RU-список не превращает дождь в 8 одинаковых карточек.
 * @param {Array<{ title?: string }>} ru
 * @param {Array<{ title?: string }>} world
 */
function mergeRuStartupPool(ru, world) {
  const out = Array.isArray(ru) ? [...ru] : [];
  if (!Array.isArray(world) || world.length === 0) {
    return out;
  }
  const seen = new Set(
    out.map((x) => String(x?.title ?? "")
      .trim()
      .toLowerCase()),
  );
  for (const w of world) {
    const k = String(w?.title ?? "")
      .trim()
      .toLowerCase();
    if (!k || seen.has(k)) {
      continue;
    }
    seen.add(k);
    out.push(w);
  }
  return out;
}

/**
 * Карточки для «дождя»: при `itemsRu` / `itemsWorld` в JSON — RU и все остальные локали раздельно.
 * Для `ru` пул = merge `itemsRu` + уникальные по названию из `itemsWorld`.
 * Если задано только поле `items` (старый формат) — оно используется для любой локали.
 * @param {string} [locale=getLocale()]
 */
export function getStartups(locale = getLocale()) {
  const d = startups;
  const legacy = Array.isArray(d.items) ? d.items : [];
  const split =
    Object.prototype.hasOwnProperty.call(d, "itemsRu") ||
    Object.prototype.hasOwnProperty.call(d, "itemsWorld");

  let items;
  if (!split) {
    items = legacy;
  } else if (locale === "ru") {
    const ru = Array.isArray(d.itemsRu) ? d.itemsRu : [];
    const world = Array.isArray(d.itemsWorld) ? d.itemsWorld : [];
    items = mergeRuStartupPool(ru, world);
  } else {
    items = Array.isArray(d.itemsWorld) ? d.itemsWorld : [];
  }

  return { count: d.count, items };
}

/** Пути для unavatar.io (без домена), напр. `github/username` — см. content/founder-avatars.json */
export function getFounderAvatarSources() {
  const list = founderAvatars.sources;
  return Array.isArray(list) ? list : [];
}

let shuffledAvatarSourcesCache = null;

/** Сколько аватарок максимум в блоке (десктоп / модалка); из пула берётся случайное подмножество. */
function getFounderAvatarPickCount() {
  const n = founderAvatars.pickCount;
  return typeof n === "number" && n > 0 ? Math.floor(n) : 4;
}

/** Случайный набор из пула на загрузку страницы (десктоп / мобилка / модалка совпадают). */
export function getFounderAvatarSourcesForPage() {
  if (shuffledAvatarSourcesCache) {
    return shuffledAvatarSourcesCache;
  }
  const pool = [...getFounderAvatarSources()];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const k = Math.min(getFounderAvatarPickCount(), pool.length);
  shuffledAvatarSourcesCache = pool.slice(0, k);
  return shuffledAvatarSourcesCache;
}
