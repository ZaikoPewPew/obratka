import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = String(import.meta.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = String(import.meta.env.SUPABASE_ANON_KEY || "").trim();

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

/** Last known JWT for unload keepalive (getSession is async). */
let cachedAccessToken = /** @type {string | null} */ (null);
let authTokenCacheBound = false;

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
function bindAuthTokenCache(supabase) {
  if (authTokenCacheBound) return;
  authTokenCacheBound = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken =
      typeof session?.access_token === "string" && session.access_token
        ? session.access_token
        : null;
  });
  void supabase.auth.getSession().then(({ data }) => {
    const token = data.session?.access_token;
    cachedAccessToken =
      typeof token === "string" && token ? token : cachedAccessToken;
  });
}

/**
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Singleton browser client (anon key). Returns null if env is missing.
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabase() {
  if (!isSupabaseConfigured()) {
    if (import.meta.env.DEV) {
      console.warn(
        "[supabase] Задайте SUPABASE_URL и SUPABASE_ANON_KEY в `.env` / `.env.local`.",
      );
    }
    return null;
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    bindAuthTokenCache(client);
  }
  return client;
}

/**
 * @returns {string}
 */
export function getSupabaseUrl() {
  return SUPABASE_URL;
}

/**
 * Publishable anon key (PostgREST `apikey` header).
 * @returns {string}
 */
export function getSupabaseAnonKey() {
  return SUPABASE_ANON_KEY;
}

/**
 * Sync access token for keepalive fetch on pagehide (no await).
 * @returns {string | null}
 */
export function getCachedAccessToken() {
  if (cachedAccessToken) return cachedAccessToken;
  return readAccessTokenFromStorage();
}

/**
 * Refresh JWT cache (call after login / claim so pagehide keepalive has a token).
 * @returns {Promise<string | null>}
 */
export async function refreshCachedAccessToken() {
  const supabase = getSupabase();
  if (!supabase) {
    cachedAccessToken = null;
    return null;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  cachedAccessToken =
    typeof token === "string" && token ? token : readAccessTokenFromStorage();
  return cachedAccessToken;
}

/**
 * Best-effort sync read of GoTrue session from localStorage.
 * @returns {string | null}
 */
function readAccessTokenFromStorage() {
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) {
        continue;
      }
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const token =
        (parsed && typeof parsed.access_token === "string"
          ? parsed.access_token
          : null) ||
        (parsed?.currentSession &&
        typeof parsed.currentSession.access_token === "string"
          ? parsed.currentSession.access_token
          : null);
      if (token) return token;
    }
  } catch {
    /* ignore */
  }
  return null;
}
