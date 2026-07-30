/**
 * Мигание title + favicon вкладки, пока окно не в фокусе.
 * Кейс: таймер ревью истёк, пользователь на другой вкладке.
 */

const BLINK_MS = 1000;

/** @type {ReturnType<typeof setInterval> | null} */
let blinkId = null;
/** @type {(() => void) | null} */
let stopListener = null;

/**
 * @param {string} href
 */
function setFavicon(href) {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

function stopTabAttention() {
  if (blinkId != null) {
    clearInterval(blinkId);
    blinkId = null;
  }
  if (stopListener) {
    window.removeEventListener("focus", stopListener);
    stopListener = null;
  }
}

/**
 * Чередует document.title и favicon, пока окно не получит focus.
 * No-op, если вкладка уже видима.
 *
 * @param {{ alertTitle: string; alertFaviconHref: string }} opts
 */
export function startTabAttention({ alertTitle, alertFaviconHref }) {
  if (!alertTitle || !alertFaviconHref) return;
  if (!document.hidden) return;

  stopTabAttention();

  const originalTitle = document.title;
  const originalFavicon =
    document.querySelector("link[rel~='icon']")?.href ?? "";
  let on = true;
  document.title = alertTitle;
  setFavicon(alertFaviconHref);

  blinkId = setInterval(() => {
    on = !on;
    document.title = on ? alertTitle : originalTitle;
    setFavicon(on ? alertFaviconHref : originalFavicon);
  }, BLINK_MS);

  stopListener = () => {
    stopTabAttention();
    document.title = originalTitle;
    if (originalFavicon) setFavicon(originalFavicon);
  };
  window.addEventListener("focus", stopListener);
}
