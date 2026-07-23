import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  for (const [key, value] of Object.entries(payload)) {
    if (key === "hash" || value === undefined || value === null) continue;
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
  return toHex(signature) === hash;
}

function telegramEmail(telegramId: number): string {
  return `tg${telegramId}@users.telegram.local`;
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
    return json({ error: "telegram_bot_token_missing" }, 500);
  }
  if (!supabaseUrl || !serviceRoleKey) {
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

  const maxAgeSec = 24 * 60 * 60;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - authDate) > maxAgeSec) {
    return json({ error: "auth_date_expired" }, 401);
  }

  const valid = await verifyTelegramAuth(payload, botToken);
  if (!valid) {
    return json({ error: "invalid_telegram_hash" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = telegramEmail(telegramId);
  const firstName = payload.first_name ? String(payload.first_name) : "";
  const lastName = payload.last_name ? String(payload.last_name) : "";
  const username = payload.username ? String(payload.username) : "";
  const photoUrl = payload.photo_url ? String(payload.photo_url) : "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const userMetadata = {
    provider: "telegram",
    telegram_id: telegramId,
    username: username || null,
    first_name: firstName || null,
    last_name: lastName || null,
    full_name: fullName || null,
    photo_url: photoUrl || null,
    avatar_url: photoUrl || null,
  };

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (
    createError &&
    !/already|registered|exists/i.test(createError.message || "")
  ) {
    console.error("createUser", createError);
    return json({ error: "create_user_failed" }, 500);
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("generateLink", linkError);
    return json({ error: "generate_link_failed" }, 500);
  }

  if (linkData.user?.id) {
    await admin.auth.admin.updateUserById(linkData.user.id, {
      user_metadata: userMetadata,
    });
  }

  const { data: sessionData, error: otpError } = await admin.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties.hashed_token,
  });

  if (otpError || !sessionData.session) {
    console.error("verifyOtp", otpError);
    return json({ error: "session_failed" }, 500);
  }

  const session = sessionData.session;
  const user = sessionData.user ?? linkData.user;

  return json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: {
      id: user?.id,
      email: user?.email,
      user_metadata: user?.user_metadata ?? userMetadata,
    },
  });
});
