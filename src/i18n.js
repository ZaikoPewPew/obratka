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

/**
 * Текущая локаль: ?lang=… из supportedLocales, затем localStorage, затем defaultLocale.
 * Новые языки — в content/locales.json (supportedLocales + блок locales).
 */
export function getLocale() {
  const supported = locales.supportedLocales;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("lang");
  if (fromUrl && supported.includes(fromUrl)) {
    return fromUrl;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && supported.includes(stored)) {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return locales.defaultLocale;
}

/**
 * Сохраняет локаль и перезагружает страницу с ?lang=…
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
  url.searchParams.set("lang", next);
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

/** Данные для слота «таймер» в шапке (счётчик стартапов из JSON). */
export function getStartups() {
  return startups;
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
