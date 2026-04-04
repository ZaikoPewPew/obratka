import { isValidEmail, normalizeEmail } from "../utils/emailValidation.js";

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;

/**
 * Сохраняет email в таблицу `subscribers` (PostgREST).
 * @param {string} email
 * @param {string} source — например `email_form` | `buy_intent`
 * @returns {Promise<boolean>}
 */
export async function saveSubscriber(email, source) {
  if (!isValidEmail(email)) {
    return false;
  }
  const normalized = normalizeEmail(email);

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
    body: JSON.stringify({ email: normalized, source }),
  });

  return res.ok;
}

function parseCountFromContentRange(header) {
  if (!header) {
    return null;
  }
  const m = String(header).trim().match(/\/(\d+)\s*$/);
  if (!m) {
    return null;
  }
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** PostgREST может вернуть скаляр `6`, `[6]`, `[{ "count": 6 }]` и т.п. */
function parseRpcSubscribersCountBody(data) {
  if (typeof data === "number" && Number.isFinite(data) && data >= 0) {
    return Math.floor(data);
  }
  if (typeof data === "string") {
    const n = parseInt(data, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];
    if (typeof first === "number" && Number.isFinite(first) && first >= 0) {
      return Math.floor(first);
    }
    if (first && typeof first === "object" && "count" in first) {
      const raw = first.count;
      const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    }
  }
  return null;
}

/**
 * Число подписчиков для лендинга.
 * 1) RPC `subscribers_count` (см. `supabase/sql/subscribers_count.sql`) — работает при RLS без SELECT на строки.
 * 2) Иначе HEAD + Prefer: count=exact — только если anon видит строки в `subscribers`.
 * @returns {Promise<number | null>}
 */
export async function fetchSubscribersCount() {
  const base = String(SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(SUPABASE_ANON_KEY || "").trim();

  if (!base || !key) {
    if (import.meta.env.DEV) {
      console.warn(
        "[subscribers] fetchSubscribersCount: задайте SUPABASE_URL и SUPABASE_ANON_KEY в `.env`.",
      );
    }
    return null;
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  try {
    const rpc = await fetch(`${base}/rest/v1/rpc/subscribers_count`, {
      method: "POST",
      headers,
      body: "{}",
    });

    if (rpc.ok) {
      const data = await rpc.json();
      const n = parseRpcSubscribersCountBody(data);
      if (n !== null) {
        return n;
      }
    }

    const head = await fetch(`${base}/rest/v1/subscribers?select=id`, {
      method: "HEAD",
      headers: {
        ...headers,
        Prefer: "count=exact",
      },
    });

    if (!head.ok) {
      if (import.meta.env.DEV) {
        console.warn(
          "[subscribers] fetchSubscribersCount: RPC и HEAD не дали число. Для RLS без SELECT на таблицу выполни SQL из supabase/sql/subscribers_count.sql",
        );
      }
      return null;
    }

    const range = head.headers.get("content-range") || head.headers.get("Content-Range") || "";
    return parseCountFromContentRange(range);
  } catch {
    return null;
  }
}
