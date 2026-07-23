import { getSupabase } from "../lib/supabaseClient.js";

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
 *   domains?: string[] | null;
 *   goals?: string[] | null;
 *   onboarding?: Record<string, unknown> | null;
 *   onboarding_done?: boolean;
 *   balance?: number;
 * }} Profile
 */

/**
 * @returns {Promise<Profile | null>}
 */
export async function fetchMyProfile() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, auth_provider, display_name, avatar_url, telegram_id, telegram_username, email, role, grade, domains, goals, onboarding, onboarding_done, balance",
    )
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

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select(
      "id, auth_provider, display_name, avatar_url, telegram_id, telegram_username, email, role, grade, domains, goals, onboarding, onboarding_done, balance",
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "profile_update_failed");
  }
  return data;
}
