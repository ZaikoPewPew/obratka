/**
 * Path-карта экранов. Источник правды для URL ↔ id.
 * Base (`import.meta.env.BASE_URL`) учитывается в router.js.
 *
 * @typedef {'referral' | 'auth' | 'onboarding' | 'home' | 'url' | 'review' | 'quiz' | 'done'} AppRouteId
 */

/** @type {Readonly<Record<AppRouteId, string>>} */
export const ROUTE_PATHS = Object.freeze({
  referral: "/referral",
  auth: "/registration",
  onboarding: "/onboarding",
  home: "/home",
  url: "/portfolio",
  /** Просмотр портфолио в iframe + таймер */
  review: "/review",
  /** Опрос после таймера */
  quiz: "/quiz",
  /** Экран успеха (пресеты: квиз, подача портфолио, generic) */
  done: "/done",
});

/** @type {readonly AppRouteId[]} */
export const ALL_ROUTE_IDS = Object.freeze(
  /** @type {AppRouteId[]} */ (Object.keys(ROUTE_PATHS)),
);

/** @type {Readonly<Record<string, AppRouteId>>} */
const PATH_TO_ID = Object.freeze(
  Object.fromEntries(
    Object.entries(ROUTE_PATHS).map(([id, path]) => [path, /** @type {AppRouteId} */ (id)]),
  ),
);

/**
 * Нормализация pathname без base и без хвостового `/` (кроме корня).
 * @param {string} pathname
 * @param {string} [baseUrl] — `import.meta.env.BASE_URL`, напр. `/` или `/obratka/`
 * @returns {string}
 */
export function normalizePathname(pathname, baseUrl = "/") {
  let base = String(baseUrl || "/");
  if (!base.startsWith("/")) base = `/${base}`;
  if (!base.endsWith("/")) base = `${base}/`;

  let path = String(pathname || "/");
  if (!path.startsWith("/")) path = `/${path}`;

  if (base !== "/" && (path === base.slice(0, -1) || path.startsWith(base))) {
    path = path === base.slice(0, -1) ? "/" : path.slice(base.length - 1);
    if (!path.startsWith("/")) path = `/${path}`;
  }

  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  return path || "/";
}

/**
 * @param {string} pathname
 * @param {string} [baseUrl]
 * @returns {AppRouteId | null}
 */
export function routeIdFromPathname(pathname, baseUrl = "/") {
  const path = normalizePathname(pathname, baseUrl);
  if (path === "/") return null;
  return PATH_TO_ID[path] ?? null;
}

/**
 * @param {AppRouteId} id
 * @returns {string}
 */
export function pathForRoute(id) {
  return ROUTE_PATHS[id];
}

/**
 * Собрать URL с учётом Vite base.
 * @param {AppRouteId} id
 * @param {{
 *   baseUrl?: string;
 *   search?: string | URLSearchParams | Record<string, string | null | undefined>;
 *   hash?: string;
 * }} [opts]
 * @returns {string}
 */
export function hrefForRoute(id, opts = {}) {
  const baseUrl = opts.baseUrl ?? "/";
  const path = pathForRoute(id);

  let base = String(baseUrl || "/");
  if (!base.startsWith("/")) base = `/${base}`;
  if (!base.endsWith("/")) base = `${base}/`;

  const hrefPath =
    base === "/" ? path : `${base.slice(0, -1)}${path}`;

  let search = "";
  if (opts.search instanceof URLSearchParams) {
    const q = opts.search.toString();
    search = q ? `?${q}` : "";
  } else if (typeof opts.search === "string") {
    search = opts.search
      ? opts.search.startsWith("?")
        ? opts.search
        : `?${opts.search}`
      : "";
  } else if (opts.search && typeof opts.search === "object") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(opts.search)) {
      if (value == null || value === "") continue;
      params.set(key, String(value));
    }
    const q = params.toString();
    search = q ? `?${q}` : "";
  }

  const hash = opts.hash
    ? opts.hash.startsWith("#")
      ? opts.hash
      : `#${opts.hash}`
    : "";

  return `${hrefPath}${search}${hash}`;
}
