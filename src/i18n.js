import locales from "../content/locales.json";
import startups from "../content/startups.json";

const STORAGE_KEY = "memento.locale";

/**
 * Текущая локаль: ?lang=en|ru, затем localStorage, затем defaultLocale.
 * Новые языки — добавить в content/locales.json (supportedLocales + блок locales).
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
