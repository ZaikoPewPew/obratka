import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Post-edit сырого Web Speech транскрипта → читаемый текст
 * (пунктуация, регистр, пробелы). Смысл не меняем.
 *
 * POST JSON: { text, locale?, maxLen? }
 * → { text } | { text, skipped: true } | error
 *
 * Секрет: ZAI_API_KEY (Dashboard / `supabase secrets set`).
 * Модель по умолчанию: glm-4.5-flash (бесплатная); переопределение — ZAI_MODEL,
 * запасные — ZAI_MODEL_FALLBACK (через запятую).
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ZAI_BASE_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const DEFAULT_MODEL = "glm-4.5-flash";
const DEFAULT_FALLBACK_MODELS = ["glm-4.7-flash"];
const DEFAULT_MAX_LEN = 4000;
const HARD_MAX_LEN = 8000;
const MIN_LEN = 8;
// Общий бюджет держим ниже клиентского таймаута в src/api/dictationPolish.js.
const ATTEMPT_TIMEOUT_MS = 7_000;
const TOTAL_BUDGET_MS = 12_000;
const RETRY_BACKOFF_MS = 600;

/** Коды Z.AI, при которых имеет смысл повторить: перегрузка / конкурентность. */
const RETRYABLE_ZAI_CODES = new Set(["1302", "1303", "1305"]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clampMaxLen(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_LEN;
  return Math.min(HARD_MAX_LEN, Math.max(MIN_LEN, Math.floor(n)));
}

function normalizeLocale(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s.startsWith("en")) return "en";
  return "ru";
}

function systemPrompt(locale: string): string {
  if (locale === "en") {
    return [
      "You clean up speech-to-text transcripts.",
      "Add punctuation, capitalization, and normal spacing.",
      "Do not change meaning, add facts, translate, summarize, or rewrite as advice.",
      "Do not use markdown or quotes around the whole result.",
      "Return only the cleaned text.",
    ].join(" ");
  }
  return [
    "Ты приводишь в порядок транскрипт голосового ввода.",
    "Добавь знаки препинания, нормальные пробелы и регистр.",
    "Не меняй смысл, не добавляй факты, не переводи, не сокращай и не переписывай как совет.",
    "Без markdown и без кавычек вокруг всего ответа.",
    "Верни только очищенный текст.",
  ].join(" ");
}

/**
 * JWT gateway уже проверил токен (verify_jwt=true).
 * Дополнительно убеждаемся, что пользователь живой — не anon-only.
 */
async function requireUser(req: Request): Promise<Response | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !anonKey) {
    return json({ error: "server_misconfigured" }, 500);
  }
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

function extractAssistantText(payload: unknown): string {
  const row = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
  const choices = Array.isArray(row?.choices) ? row.choices : [];
  const first = choices[0] && typeof choices[0] === "object"
    ? (choices[0] as Record<string, unknown>)
    : null;
  const message = first?.message && typeof first.message === "object"
    ? (first.message as Record<string, unknown>)
    : null;
  const content = message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

/** Цепочка моделей: основная + запасные, без дублей. */
function resolveModels(): string[] {
  const primary = (Deno.env.get("ZAI_MODEL") || "").trim() || DEFAULT_MODEL;
  const configured = (Deno.env.get("ZAI_MODEL_FALLBACK") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fallbacks = configured.length ? configured : DEFAULT_FALLBACK_MODELS;
  return [...new Set([primary, ...fallbacks])];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Z.AI отдаёт код и в теле 200-ответа, и в теле ошибки. */
function zaiErrorCode(payload: unknown): string {
  const row = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
  const err = row?.error && typeof row.error === "object"
    ? (row.error as Record<string, unknown>)
    : null;
  const code = err?.code;
  if (typeof code === "string") return code;
  if (typeof code === "number") return String(code);
  return "";
}

function stripWrappingQuotes(text: string): string {
  const t = text.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("«") && t.endsWith("»")) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authError = await requireUser(req);
  if (authError) return authError;

  const apiKey = (Deno.env.get("ZAI_API_KEY") || "").trim();
  if (!apiKey) {
    return json({ error: "zai_key_missing" }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const maxLen = clampMaxLen(body.maxLen);
  const rawText = typeof body.text === "string" ? body.text.trim() : "";
  if (!rawText) {
    return json({ text: "", skipped: true });
  }
  if (rawText.length < MIN_LEN) {
    return json({ text: rawText.slice(0, maxLen), skipped: true });
  }

  const input = rawText.slice(0, maxLen);
  const locale = normalizeLocale(body.locale);
  const models = resolveModels();
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  const payloadBase = {
    messages: [
      { role: "system", content: systemPrompt(locale) },
      { role: "user", content: input },
    ],
    temperature: 0.2,
    max_tokens: Math.min(4096, Math.max(256, Math.ceil(maxLen * 1.2))),
    // Без этого reasoning съедает лимит токенов и content приходит пустым.
    thinking: { type: "disabled" },
  };

  let lastError = "upstream_failed";

  for (const model of models) {
    // Перегрузка бесплатного тира лечится повтором чаще, чем сменой модели.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (Date.now() >= deadline) {
        return json({ text: input, skipped: true, error: "deadline" });
      }

      const controller = new AbortController();
      const budget = Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now());
      const timer = setTimeout(() => controller.abort(), budget);
      try {
        const upstream = await fetch(ZAI_BASE_URL, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model, ...payloadBase }),
        });

        const raw = await upstream.text();
        let payload: unknown = null;
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = null;
        }
        const code = zaiErrorCode(payload);

        if (!upstream.ok || code) {
          console.error(
            "[polish-dictation] zai",
            model,
            upstream.status,
            raw.slice(0, 400),
          );
          const retryable = upstream.status === 429 ||
            upstream.status >= 500 ||
            RETRYABLE_ZAI_CODES.has(code);
          lastError = code ? `zai_${code}` : "upstream_failed";
          if (retryable) {
            await sleep(RETRY_BACKOFF_MS);
            continue;
          }
          break;
        }

        const polished = stripWrappingQuotes(extractAssistantText(payload));
        if (!polished) {
          lastError = "empty_model";
          break;
        }
        return json({ text: polished.slice(0, maxLen), model });
      } catch (err) {
        const message = err instanceof Error ? err.message : "fetch_failed";
        console.error("[polish-dictation]", model, message);
        lastError = "fetch_failed";
      } finally {
        clearTimeout(timer);
      }
    }
  }

  // Fallback: сырой текст, submit не ломаем.
  return json({ text: input, skipped: true, error: lastError });
});
