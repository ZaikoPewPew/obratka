import {
  hrefForRoute,
  routeIdFromPathname,
} from "./routes.js";

/**
 * @typedef {import("./routes.js").AppRouteId} AppRouteId
 * @typedef {{
 *   id: AppRouteId | null;
 *   pathname: string;
 *   search: URLSearchParams;
 *   href: string;
 * }} AppLocation
 */

/**
 * Клиентский path-роутер (History API) с учётом Vite `BASE_URL`.
 *
 * @param {{
 *   baseUrl?: string;
 *   onChange: (location: AppLocation, meta: { reason: 'start' | 'navigate' | 'popstate' }) => void;
 * }} opts
 */
export function createAppRouter({
  baseUrl = import.meta.env.BASE_URL || "/",
  onChange,
}) {
  /** @type {AppRouteId | null} */
  let currentId = null;
  let syncing = false;

  /**
   * @returns {AppLocation}
   */
  function read() {
    const pathname = window.location.pathname;
    const search = new URLSearchParams(window.location.search);
    const id = routeIdFromPathname(pathname, baseUrl);
    return {
      id,
      pathname,
      search,
      href: `${pathname}${window.location.search}${window.location.hash}`,
    };
  }

  /**
   * @param {AppLocation} location
   * @param {'start' | 'navigate' | 'popstate'} reason
   */
  function emit(location, reason) {
    currentId = location.id;
    onChange(location, { reason });
  }

  /**
   * @param {AppRouteId} id
   * @param {{
   *   replace?: boolean;
   *   search?: string | URLSearchParams | Record<string, string | null | undefined>;
   *   hash?: string;
   *   silent?: boolean;
   * }} [opts]
   */
  function navigate(id, opts = {}) {
    const href = hrefForRoute(id, {
      baseUrl,
      search: opts.search,
      hash: opts.hash,
    });
    const method = opts.replace ? "replaceState" : "pushState";
    window.history[method]({ id }, "", href);

    if (opts.silent) {
      currentId = id;
      return;
    }

    syncing = true;
    try {
      emit(read(), "navigate");
    } finally {
      syncing = false;
    }
  }

  /**
   * Обновить URL без вызова onChange (когда экран уже показан снаружи).
   * @param {AppRouteId} id
   * @param {{
   *   replace?: boolean;
   *   search?: string | URLSearchParams | Record<string, string | null | undefined>;
   *   hash?: string;
   * }} [opts]
   */
  function sync(id, opts = {}) {
    if (currentId === id && !opts.search && !opts.hash) {
      const live = routeIdFromPathname(window.location.pathname, baseUrl);
      if (live === id) return;
    }
    navigate(id, { ...opts, replace: opts.replace ?? true, silent: true });
  }

  function start() {
    window.addEventListener("popstate", () => {
      if (syncing) return;
      emit(read(), "popstate");
    });
    emit(read(), "start");
  }

  return {
    baseUrl,
    read,
    navigate,
    sync,
    start,
    getCurrentId: () => currentId,
  };
}
