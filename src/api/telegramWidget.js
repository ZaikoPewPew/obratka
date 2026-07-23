const WIDGET_SRC = "https://telegram.org/js/telegram-widget.js?22";

/** @type {Promise<void> | null} */
let widgetPromise = null;

/**
 * @returns {Promise<void>}
 */
export function loadTelegramWidget() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("telegram_widget_ssr"));
  }
  const existingApi = /** @type {{ Login?: { auth?: Function } }} */ (window).Telegram;
  if (existingApi?.Login?.auth) {
    return Promise.resolve();
  }
  if (widgetPromise) return widgetPromise;

  widgetPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${WIDGET_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => {
          widgetPromise = null;
          reject(new Error("telegram_widget_load_failed"));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      widgetPromise = null;
      reject(new Error("telegram_widget_load_failed"));
    };
    document.head.append(script);
  });

  return widgetPromise;
}

/**
 * @returns {Promise<import('./telegramWidget.js').TelegramLoginUser | null>} `null` — пользователь закрыл окно
 */
export async function requestTelegramLogin({ botId }) {
  const id = Number(botId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("telegram_bot_id_missing");
  }

  await loadTelegramWidget();

  const telegram = /** @type {{ Login?: { auth: Function } }} */ (window).Telegram;
  const login = telegram?.Login;
  if (!login?.auth) {
    throw new Error("telegram_widget_unavailable");
  }

  return new Promise((resolve) => {
    login.auth({ bot_id: id, request_access: true }, (user) => {
      resolve(user && typeof user === "object" ? user : null);
    });
  });
}

/**
 * @typedef {{
 *   id: number;
 *   first_name: string;
 *   last_name?: string;
 *   username?: string;
 *   photo_url?: string;
 *   auth_date: number;
 *   hash: string;
 * }} TelegramLoginUser
 */
