import { getSupabase } from "../lib/supabaseClient.js";

/**
 * @typedef {{
 *   id: string;
 *   displayName: string;
 *   avatarUrl: string;
 * }} OnlineLegendary
 */

/**
 * Ping presence for the current user when `tier = legendary`.
 * No-op on the server if the profile is not legendary / banned.
 * @returns {Promise<void>}
 */
export async function heartbeatLegendaryPresence() {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.rpc("heartbeat_legendary_presence");
  if (error) {
    throw new Error(error.message || "legendary_presence_heartbeat_failed");
  }
}

/**
 * Online legendary profiles (last_seen within server TTL).
 * @returns {Promise<OnlineLegendary[]>}
 */
export async function listOnlineLegendaries() {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("list_online_legendaries");
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[presence] listOnlineLegendaries", error.message);
    }
    return [];
  }

  if (!Array.isArray(data)) return [];

  return data
    .map((row) => {
      const id = typeof row?.id === "string" ? row.id : "";
      if (!id) return null;
      return {
        id,
        displayName:
          typeof row?.display_name === "string" ? row.display_name.trim() : "",
        avatarUrl:
          typeof row?.avatar_url === "string" ? row.avatar_url.trim() : "",
      };
    })
    .filter(Boolean);
}
