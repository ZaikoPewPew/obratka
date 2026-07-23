import { getSupabase, getSupabaseUrl, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { requestTelegramLogin } from "./telegramWidget.js";

/**
 * @typedef {{
 *   userId: string;
 *   email?: string | null;
 *   telegramId?: number;
 *   username?: string | null;
 *   firstName?: string | null;
 *   photoUrl?: string | null;
 * }} AuthUser
 *
 * @typedef {{ user: AuthUser; accessToken?: string; refreshToken?: string }} AuthSession
 *
 * @typedef {{
 *   id: number;
 *   first_name: string;
 *   last_name?: string;
 *   username?: string;
 *   photo_url?: string;
 *   auth_date: number;
 *   hash: string;
 * }} TelegramLoginPayload
 */

function getTelegramBotId() {
  return String(
    import.meta.env.TELEGRAM_BOT_ID || import.meta.env.VITE_TELEGRAM_BOT_ID || "",
  ).trim();
}

function getAnonKey() {
  return String(import.meta.env.SUPABASE_ANON_KEY || "").trim();
}

/**
 * @param {unknown} raw
 * @returns {AuthUser}
 */
function mapUser(raw) {
  const meta = raw && typeof raw === "object" ? raw.user_metadata || {} : {};
  return {
    userId: String(raw?.id || ""),
    email: raw?.email ?? null,
    telegramId:
      typeof meta.telegram_id === "number"
        ? meta.telegram_id
        : meta.telegram_id
          ? Number(meta.telegram_id)
          : undefined,
    username: meta.username ?? null,
    firstName: meta.first_name ?? meta.full_name ?? null,
    photoUrl: meta.photo_url ?? meta.avatar_url ?? null,
  };
}

/**
 * Telegram Login Widget → Edge Function `telegram-auth` → Supabase session.
 * @returns {Promise<AuthSession>}
 */
export async function signInWithTelegram() {
  const botId = getTelegramBotId();
  if (!botId) {
    throw new Error("telegram_bot_id_missing");
  }
  if (!isSupabaseConfigured()) {
    throw new Error("supabase_not_configured");
  }

  const telegramUser = await requestTelegramLogin({ botId });
  if (!telegramUser) {
    throw new Error("telegram_cancelled");
  }

  return completeTelegramSignIn(telegramUser);
}

/**
 * @param {TelegramLoginPayload} telegramUser
 * @returns {Promise<AuthSession>}
 */
export async function completeTelegramSignIn(telegramUser) {
  const supabase = getSupabase();
  const base = getSupabaseUrl();
  const anonKey = getAnonKey();
  if (!supabase || !base || !anonKey) {
    throw new Error("supabase_not_configured");
  }

  let res;
  try {
    res = await fetch(`${base}/functions/v1/telegram-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(telegramUser),
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[auth] telegram-auth fetch failed", err);
    }
    throw new Error("telegram_auth_network");
  }

  /** @type {{ error?: string; detail?: string; token_hash?: string; user?: object }} */
  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  if (!res.ok) {
    const code = body.error || `telegram_auth_http_${res.status}`;
    if (import.meta.env.DEV) {
      console.warn("[auth] telegram-auth error", res.status, body);
    }
    throw new Error(code);
  }

  if (!body.token_hash) {
    throw new Error("telegram_auth_no_session");
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: body.token_hash,
    type: "email",
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[auth] verifyOtp failed", error);
    }
    throw new Error(error.message || "telegram_session_failed");
  }

  const user = data.user ? mapUser(data.user) : mapUser(body.user);
  if (!user.userId) {
    throw new Error("telegram_auth_no_user");
  }

  return {
    user,
    accessToken: data.session?.access_token,
    refreshToken: data.session?.refresh_token,
  };
}

/**
 * @param {{ email: string; password: string; name?: string }} _input
 * @returns {Promise<AuthSession>}
 */
export async function signUp(_input) {
  throw new Error("auth.signUp: not implemented");
}

/**
 * @param {{ email: string; password: string }} _input
 * @returns {Promise<AuthSession>}
 */
export async function signIn(_input) {
  throw new Error("auth.signIn: not implemented");
}

/**
 * @returns {Promise<void>}
 */
export async function signOut() {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}
