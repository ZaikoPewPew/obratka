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
    firstName: meta.first_name ?? meta.full_name ?? meta.name ?? null,
    photoUrl: meta.photo_url ?? meta.avatar_url ?? meta.picture ?? null,
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
 * Absolute redirect URL after Google OAuth (Site URL / Redirect URLs in Supabase).
 * Root of the app so `resolveEntryScreen` picks onboarding/home after session is set.
 * @returns {string}
 */
export function getAuthRedirectUrl() {
  const base = String(import.meta.env.BASE_URL || "/");
  let basePath = base.startsWith("/") ? base : `/${base}`;
  if (!basePath.endsWith("/")) basePath = `${basePath}/`;
  return `${window.location.origin}${basePath}`;
}

/**
 * Strip OAuth query/hash leftovers without a full navigation.
 */
function cleanOAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  const keys = ["code", "state", "error", "error_code", "error_description"];
  let changed = false;
  for (const key of keys) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (url.hash && /(access_token|error|refresh_token)=/.test(url.hash)) {
    url.hash = "";
    changed = true;
  }
  if (changed) {
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }
}

/**
 * Google OAuth (PKCE) via Supabase Auth. Redirects the browser to Google.
 * @returns {Promise<void>}
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured()) {
    throw new Error("supabase_not_configured");
  }
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthRedirectUrl(),
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[auth] google signInWithOAuth failed", error);
    }
    throw new Error(error.message || "google_oauth_failed");
  }
}

/**
 * Complete Google (or other OAuth) return: exchange `?code=` (PKCE) or hash tokens.
 * Returns null when the URL is not an OAuth callback.
 * @returns {Promise<AuthSession | null>}
 */
export async function completeOAuthFromUrl() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const url = new URL(window.location.href);
  const errorParam = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const hashParams = new URLSearchParams(
    url.hash.startsWith("#") ? url.hash.slice(1) : url.hash,
  );
  const hashError = hashParams.get("error");
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (errorParam || hashError) {
    cleanOAuthParamsFromUrl();
    const codeName = errorParam || hashError || "google_oauth_failed";
    if (codeName === "access_denied") {
      throw new Error("google_cancelled");
    }
    throw new Error(codeName);
  }

  if (!code && !accessToken) {
    return null;
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    cleanOAuthParamsFromUrl();
    if (error) {
      if (import.meta.env.DEV) {
        console.warn("[auth] exchangeCodeForSession failed", error);
      }
      throw new Error(error.message || "google_session_failed");
    }
    const user = data.user ? mapUser(data.user) : null;
    if (!user?.userId) {
      throw new Error("google_auth_no_user");
    }
    return {
      user,
      accessToken: data.session?.access_token,
      refreshToken: data.session?.refresh_token,
    };
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken || "",
  });
  cleanOAuthParamsFromUrl();
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[auth] setSession from hash failed", error);
    }
    throw new Error(error.message || "google_session_failed");
  }
  const user = data.user ? mapUser(data.user) : null;
  if (!user?.userId) {
    throw new Error("google_auth_no_user");
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
