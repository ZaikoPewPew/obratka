import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Fields Telegram includes in the login hash (order does not matter; we sort). */
const TELEGRAM_HASH_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "username",
  "photo_url",
  "auth_date",
] as const;

type TelegramLoginPayload = {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * https://core.telegram.org/widgets/login#checking-authorization
 */
async function verifyTelegramAuth(
  payload: TelegramLoginPayload,
  botToken: string,
): Promise<boolean> {
  const hash = String(payload.hash || "");
  if (!hash) return false;

  const data: Record<string, string> = {};
  for (const key of TELEGRAM_HASH_FIELDS) {
    const value = payload[key];
    if (value === undefined || value === null || value === "") continue;
    data[key] = String(value);
  }

  const checkString = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join("\n");

  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.digest("SHA-256", enc.encode(botToken));
  const key = await crypto.subtle.importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(checkString));
  const expected = toHex(signature);
  if (expected.length !== hash.length) return false;
  // Constant-time-ish compare (mitigate timing leaks on hash string).
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return mismatch === 0;
}

function telegramEmail(telegramId: number): string {
  // Valid-looking email for GoTrue; not used for mail delivery.
  return `tg${telegramId}@t.me`;
}

function isAlreadyRegistered(
  message: string | undefined,
  code?: string | undefined,
): boolean {
  if (code === "email_exists" || code === "user_already_exists") return true;
  return /already|registered|exists|duplicate/i.test(message || "");
}

/**
 * Admin client must NOT inherit the caller's Authorization (anon / user JWT).
 * Otherwise Auth Admin APIs intermittently return 403 bad_jwt
 * (`unrecognized JWT kid <nil> for algorithm ES256`).
 */
function createAdminClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN missing");
    return json({ error: "telegram_bot_token_missing" }, 500);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL or SERVICE_ROLE missing");
    return json({ error: "supabase_admin_missing" }, 500);
  }

  let payload: TelegramLoginPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const telegramId = Number(payload.id);
  const authDate = Number(payload.auth_date);
  if (!Number.isFinite(telegramId) || telegramId <= 0) {
    return json({ error: "invalid_telegram_id" }, 400);
  }
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return json({ error: "invalid_auth_date" }, 400);
  }

  const maxAgeSec = 60 * 60; // 1h — limit replay of stolen Telegram login payloads
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - authDate) > maxAgeSec) {
    return json({ error: "auth_date_expired" }, 401);
  }

  const valid = await verifyTelegramAuth(payload, botToken);
  if (!valid) {
    console.error("invalid telegram hash for id", telegramId);
    return json({ error: "invalid_telegram_hash" }, 401);
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey);

  const email = telegramEmail(telegramId);
  const firstName = payload.first_name ? String(payload.first_name) : "";
  const lastName = payload.last_name ? String(payload.last_name) : "";
  const username = payload.username ? String(payload.username) : "";
  const photoUrl = payload.photo_url ? String(payload.photo_url) : "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const userMetadata = {
    provider: "telegram",
    username: username || null,
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    photo_url: photoUrl || null,
    avatar_url: photoUrl || null,
  };
  // telegram_id only in app_metadata (trusted); handle_new_user reads it from there.
  const appMetadata = {
    provider: "telegram",
    telegram_id: telegramId,
  };

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: userMetadata,
    app_metadata: appMetadata,
  });

  if (
    createError &&
    !isAlreadyRegistered(createError.message, createError.code)
  ) {
    console.error("createUser", createError);
    return json({ error: "create_user_failed" }, 500);
  }

  let linkData: Awaited<
    ReturnType<typeof admin.auth.admin.generateLink>
  >["data"] = null;
  let linkError: Awaited<
    ReturnType<typeof admin.auth.admin.generateLink>
  >["error"] = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    linkData = result.data;
    linkError = result.error;
    if (!linkError && linkData?.properties?.hashed_token) break;
    if (attempt === 0) {
      console.warn("generateLink retry", linkError?.message);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("generateLink", linkError);
    return json({ error: "generate_link_failed" }, 500);
  }

  if (linkData.user?.id) {
    const { error: updateError } = await admin.auth.admin.updateUserById(
      linkData.user.id,
      {
        user_metadata: userMetadata,
        app_metadata: appMetadata,
      },
    );
    if (updateError) {
      console.error("updateUserById", updateError);
    }
  }

  // Client completes sign-in with anon key via verifyOtp.
  return json({
    token_hash: linkData.properties.hashed_token,
    email,
    user: {
      id: linkData.user?.id,
      email,
      user_metadata: userMetadata,
    },
  });
});
