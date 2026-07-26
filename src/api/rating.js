import { getSupabase } from "../lib/supabaseClient.js";

/**
 * @typedef {{
 *   id: string;
 *   place: number;
 *   displayName: string;
 *   avatarUrl: string;
 *   grade: string;
 *   role: string;
 *   balance: number;
 * }} RatingTopItem
 */

/**
 * Топ-50 профилей по балансу (вкладка «Рейтинг»).
 * Снапшот обновляется на сервере раз в сутки (`list_rating_top`).
 * При ошибке RPC — `null` (не кэшировать как пустой топ).
 *
 * @returns {Promise<RatingTopItem[] | null>}
 */
export async function listRatingTop() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("list_rating_top");
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[rating] listRatingTop", error.message);
    }
    return null;
  }

  if (!Array.isArray(data)) return [];

  return data
    .map((row) => {
      const id = typeof row?.profile_id === "string" ? row.profile_id : "";
      const place = Number(row?.place) || 0;
      if (!id || place <= 0) return null;
      return {
        id,
        place,
        displayName:
          typeof row?.display_name === "string" ? row.display_name.trim() : "",
        avatarUrl:
          typeof row?.avatar_url === "string" ? row.avatar_url.trim() : "",
        grade: typeof row?.grade === "string" ? row.grade : "",
        role: typeof row?.role === "string" ? row.role : "",
        balance: Math.max(0, Number(row?.balance) || 0),
      };
    })
    .filter(Boolean);
}
