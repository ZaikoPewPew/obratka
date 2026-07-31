import { getSupabase } from "../lib/supabaseClient.js";
import { normalizeProfileSettings } from "./profileSettings.js";

/** @typedef {'free' | 'pro' | 'legendary'} ProfileTier */

/**
 * @typedef {{
 *   id: string;
 *   auth_provider?: string | null;
 *   display_name?: string | null;
 *   avatar_url?: string | null;
 *   telegram_id?: number | null;
 *   telegram_username?: string | null;
 *   email?: string | null;
 *   role?: string | null;
 *   grade?: string | null;
 *   workplace?: string | null;
 *   tier?: ProfileTier;
 *   domains?: string[] | null;
 *   goals?: string[] | null;
 *   onboarding?: Record<string, unknown> | null;
 *   onboarding_done?: boolean;
 *   balance?: number;
 *   referral_code?: string | null;
 *   referral_uses?: number;
 *   referred_by?: string | null;
 *   referral_entry_code?: string | null;
 *   banned_at?: string | null;
 *   reputation?: number;
 *   created_at?: string | null;
 * }} Profile
 */

const PROFILE_SELECT =
  "id, auth_provider, display_name, avatar_url, telegram_id, telegram_username, email, role, grade, workplace, tier, domains, goals, onboarding, onboarding_done, balance, referral_code, referral_uses, referred_by, referral_entry_code, banned_at, reputation, created_at";

/** Колонки, которые клиент вообще может попытаться обновить (сервер всё равно режет guards). */
const CLIENT_WRITABLE_KEYS = new Set([
  "display_name",
  "avatar_url",
  "telegram_username",
  "role",
  "grade",
  "workplace",
  "domains",
  "goals",
  "onboarding",
  "onboarding_done",
]);

/**
 * @param {Profile | null | undefined} profile
 * @returns {boolean}
 */
export function isProfileBanned(profile) {
  return Boolean(profile?.banned_at);
}

/**
 * @returns {Promise<Profile | null>}
 */
export async function fetchMyProfile() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[profiles] fetchMyProfile", error.message);
    }
    return null;
  }
  return data;
}

/**
 * @param {Partial<Profile>} patch
 * @returns {Promise<Profile | null>}
 */
export async function updateMyProfile(patch) {
  const supabase = getSupabase();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("not_authenticated");
  }

  /** @type {Record<string, unknown>} */
  const safePatch = {};
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (CLIENT_WRITABLE_KEYS.has(key)) {
      safePatch[key] = value;
    }
  }

  if (Object.keys(safePatch).length === 0) {
    throw new Error("profile_update_empty");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(safePatch)
    .eq("id", user.id)
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "profile_update_failed");
  }
  return data;
}

/**
 * Сохраняет только разрешённые поля профиля из `/settings`.
 *
 * @param {Record<string, unknown>} input
 * @returns {Promise<Profile | null>}
 */
export async function updateMySettings(input) {
  const normalized = normalizeProfileSettings(input);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }
  return updateMyProfile(normalized.patch);
}
