const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;

/**
 * Сохраняет email в таблицу `subscribers` (PostgREST).
 * @param {string} email
 * @param {string} source — например `email_form` | `buy_intent`
 * @returns {Promise<boolean>}
 */
export async function saveSubscriber(email, source) {
  const base = String(SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(SUPABASE_ANON_KEY || "").trim();

  if (!base || !key) {
    if (import.meta.env.DEV) {
      console.warn(
        "[subscribers] Задайте SUPABASE_URL и SUPABASE_ANON_KEY в `.env` (см. `.env.example`).",
      );
    }
    return false;
  }

  const res = await fetch(`${base}/rest/v1/subscribers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ email, source }),
  });

  return res.ok;
}
