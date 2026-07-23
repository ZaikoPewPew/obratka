import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = String(import.meta.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = String(import.meta.env.SUPABASE_ANON_KEY || "").trim();

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

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
  }
  return client;
}

/**
 * @returns {string}
 */
export function getSupabaseUrl() {
  return SUPABASE_URL;
}
