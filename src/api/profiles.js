import { getSupabase } from "../lib/supabaseClient.js";

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
 *   tier?: ProfileTier;
 *   domains?: string[] | null;
 *   goals?: string[] | null;
 *   onboarding?: Record<string, unknown> | null;
 *   onboarding_done?: boolean;
 *   balance?: number;
 *   banned_at?: string | null;
 *   ban_reason?: string | null;
 * }} Profile
 */

const PROFILE_SELECT =
  "id, auth_provider, display_name, avatar_url, telegram_id, telegram_username, email, role, grade, tier, domains, goals, onboarding, onboarding_done, balance, banned_at, ban_reason";

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

  // tier / ban fields are server-managed (trigger + service_role); never send from client.
  const {
    tier: _tier,
    id: _id,
    banned_at: _bannedAt,
    ban_reason: _banReason,
    ...safePatch
  } = patch;

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
