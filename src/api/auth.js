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
 * Стабильные коды ошибок Auth для UI (i18n).
 * @param {unknown} error
 * @returns {string | null}
 */
export function mapSupabaseAuthErrorCode(error) {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number(error.status)
      : NaN;
  const code = String(
    error && typeof error === "object" && "code" in error
      ? error.code || ""
      : "",
  ).toLowerCase();
  const msg = String(
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? error.message || ""
        : error || "",
  ).toLowerCase();

  if (status === 429 || msg.includes("rate") || code.includes("over_request")) {
    return "email_otp_rate_limit";
  }

  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    code === "identity_already_exists" ||
    msg.includes("email_exists") ||
    msg.includes("user already registered") ||
    msg.includes("already been registered") ||
    msg.includes("identity is already linked") ||
    msg.includes("identity already linked") ||
    msg.includes("already linked to another") ||
    (msg.includes("identity") &&
      (msg.includes("conflict") || msg.includes("already")))
  ) {
    return "auth_identity_conflict";
  }

  return null;
}

/**
 * @param {unknown} error
 * @param {string} fallback
 * @returns {never}
 */
function throwMappedAuthError(error, fallback) {
  const mapped = mapSupabaseAuthErrorCode(error);
  if (mapped) {
    throw new Error(mapped);
  }
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message || "")
        : "";
  throw new Error(message || fallback);
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
 * URL аватара из текущей Supabase Auth-сессии (Google picture / Telegram photo).
 * @returns {Promise<string | null>}
 */
export async function getAuthUserAvatarUrl() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const photoUrl = mapUser(user).photoUrl;
  if (typeof photoUrl !== "string") return null;
  const trimmed = photoUrl.trim();
  return trimmed || null;
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
    throwMappedAuthError(error, "google_oauth_failed");
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
    const description =
      url.searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      "";
    cleanOAuthParamsFromUrl();
    const codeName = errorParam || hashError || "google_oauth_failed";
    if (codeName === "access_denied") {
      throw new Error("google_cancelled");
    }
    const mapped = mapSupabaseAuthErrorCode({
      message: description || codeName,
      code: codeName,
    });
    if (mapped) {
      throw new Error(mapped);
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
      throwMappedAuthError(error, "google_session_failed");
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
    throwMappedAuthError(error, "google_session_failed");
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
 * Send a one-time code to the email (Supabase Auth Email OTP).
 * @param {string} email
 * @returns {Promise<{ email: string }>}
 */
export async function requestEmailOtp(email) {
  if (!isSupabaseConfigured()) {
    throw new Error("supabase_not_configured");
  }
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    throw new Error("email_invalid");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[auth] signInWithOtp failed", error);
    }
    throwMappedAuthError(error, "email_otp_send_failed");
  }

  return { email: normalized };
}

/**
 * Verify the email OTP and establish a Supabase session.
 * @param {string} email
 * @param {string} token
 * @returns {Promise<AuthSession>}
 */
export async function verifyEmailOtp(email, token) {
  if (!isSupabaseConfigured()) {
    throw new Error("supabase_not_configured");
  }
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("supabase_not_configured");
  }

  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  const code = String(token || "").trim();
  if (!normalized) {
    throw new Error("email_invalid");
  }
  if (!code) {
    throw new Error("email_otp_invalid");
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: normalized,
    token: code,
    type: "email",
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[auth] verifyEmailOtp failed", error);
    }
    const mapped = mapSupabaseAuthErrorCode(error);
    if (mapped) {
      throw new Error(mapped);
    }
    const msg = String(error.message || "").toLowerCase();
    if (
      msg.includes("expired") ||
      msg.includes("invalid") ||
      msg.includes("otp") ||
      error.status === 403
    ) {
      throw new Error("email_otp_invalid");
    }
    throw new Error(error.message || "email_otp_verify_failed");
  }

  const user = data.user ? mapUser(data.user) : null;
  if (!user?.userId) {
    throw new Error("email_auth_no_user");
  }

  return {
    user,
    accessToken: data.session?.access_token,
    refreshToken: data.session?.refresh_token,
  };
}

/**
 * @returns {Promise<void>}
 */
export async function signOut() {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}
