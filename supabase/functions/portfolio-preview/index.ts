import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Прокси/кэш перед thum.io для превью-скриншотов портфолио.
 *
 * Зачем: у анонимного (без ключа) тира thum.io жёсткие лимиты запросов —
 * при резком наплюве пользователей (см. план "нагрузка 200-500 дизайнеров")
 * лента из сотен непрогретых превью может словить массовые 429/битые
 * картинки. Эта функция:
 *  - кэширует успешный скриншот в Supabase Storage (`portfolio-previews`)
 *    на `CACHE_TTL_SEC`, так что повторные просмотры той же карточки любым
 *    пользователем не бьют thum.io заново;
 *  - при 429 от thum.io делает один retry с бэкоффом, а если это не
 *    помогло — отдаёт последний закэшированный (пусть и протухший) снимок
 *    вместо ошибки;
 *  - поддерживает платный ключ thum.io (`THUMIO_AUTH_KEY` secret) "из
 *    коробки" — если он появится, просто задать secret, код не трогать;
 *  - самоочищается: без cron, вероятностный фоновый sweep (см.
 *    `CLEANUP_PROBABILITY`) убирает объекты, которые никто не смотрел
 *    дольше `PURGE_AFTER_SEC` — бакет не растёт бесконечно.
 *
 * URL: `${SUPABASE_URL}/functions/v1/portfolio-preview?url=<encoded portfolio url>`
 * Вызывается напрямую из `<img src>` (см. `portfolioPreviewUrl` в
 * `src/api/portfolios.js`) — без Authorization header, поэтому
 * `verify_jwt = false` в `supabase/config.toml`.
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

const BUCKET = "portfolio-previews";
/** Совпадает по смыслу со старым `maxAge/24` у thum.io. */
const CACHE_TTL_SEC = 24 * 60 * 60;
/** Протухший, но ещё пригодный для fallback при ошибке/429 у thum.io. */
const STALE_TTL_SEC = 7 * 24 * 60 * 60;
const FETCH_TIMEOUT_MS = 20_000;
const RATE_LIMIT_RETRY_BASE_MS = 500;
const MAX_TARGET_URL_LENGTH = 2048;

/**
 * Бакет самоочищается без cron: раз в ~50 запросов (в среднем) фоново
 * подчищаем самые старые объекты, к которым никто не обращался дольше
 * `PURGE_AFTER_SEC`. Любой просмотр карточки обновляет `updated_at`
 * (upsert), так что реально смотрят — не тронем; забытые (портфолио
 * давно набрало 3/3 и выпало из очереди, никто не открывает) — со
 * временем вычистятся. Без этого бакет рос бы бесконечно с числом
 * когда-либо просмотренных URL.
 */
const CLEANUP_PROBABILITY = 0.02;
const CLEANUP_BATCH_SIZE = 50;
const PURGE_AFTER_SEC = 30 * 24 * 60 * 60;

/** Deno Deploy / Supabase Edge Runtime global — не в стандартных lib.d.ts. */
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function noStoreResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: { ...corsHeaders, "Cache-Control": "no-store" },
  });
}

function redirectToCache(publicUrl: string, ttlSec: number): Response {
  const maxAge = Math.max(0, Math.floor(ttlSec));
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: publicUrl,
      "Cache-Control": `public, max-age=${maxAge}`,
    },
  });
}

/**
 * Только http(s), без явно локальных/служебных хостов (SSRF-подстраховка).
 * Не претендует на исчерпывающий SSRF-фильтр — цель лишь отсечь очевидный
 * мусор, реальный источник url — уже отрендеренная (RLS-защищённая) лента.
 */
function parseSafeTargetUrl(raw: string): URL | null {
  if (!raw || raw.length > MAX_TARGET_URL_LENGTH) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (!host) return null;
  if (host === "localhost" || host === "0.0.0.0" || host === "::1") return null;
  if (host.endsWith(".local")) return null;
  if (/^127\./.test(host)) return null;
  if (/^10\./.test(host)) return null;
  if (/^192\.168\./.test(host)) return null;
  if (/^169\.254\./.test(host)) return null;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return null;
  return parsed;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function thumioUrl(targetUrl: string, authKey: string | undefined): string {
  const authSegment = authKey ? `auth/${encodeURIComponent(authKey)}/` : "";
  // noanimate — иначе thum.io отдаёт промежуточный "loading" кадр вместо
  // финального скриншота на первый же (единственный) серверный fetch.
  return `https://image.thum.io/get/${authSegment}maxAge/24/width/1200/crop/620/wait/3/noanimate/${targetUrl}`;
}

type ThumioResult =
  | { ok: true; response: Response }
  | { ok: false; rateLimited: boolean };

async function fetchThumioOnce(targetUrl: string, authKey: string | undefined): Promise<ThumioResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(thumioUrl(targetUrl, authKey), { signal: controller.signal });
    if (res.status === 429) return { ok: false, rateLimited: true };
    if (!res.ok) return { ok: false, rateLimited: false };
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return { ok: false, rateLimited: false };
    return { ok: true, response: res };
  } catch (err) {
    console.error("thum.io fetch failed", err);
    return { ok: false, rateLimited: false };
  } finally {
    clearTimeout(timer);
  }
}

/** 429 → один retry с небольшим бэкоффом + джиттером, иначе сразу сдаёмся вызывающему. */
async function fetchThumioWithRetry(targetUrl: string, authKey: string | undefined): Promise<Response | null> {
  const first = await fetchThumioOnce(targetUrl, authKey);
  if (first.ok) return first.response;
  if (!first.rateLimited) return null;

  console.warn("thum.io 429, retrying once", targetUrl);
  const delay = RATE_LIMIT_RETRY_BASE_MS + Math.floor(Math.random() * 300);
  await new Promise((resolve) => setTimeout(resolve, delay));

  const second = await fetchThumioOnce(targetUrl, authKey);
  return second.ok ? second.response : null;
}

function createAdminClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
    },
  });
}

/** Фоновая подчистка самых старых непосещаемых объектов бакета (см. `CLEANUP_PROBABILITY`). */
async function sweepStaleObjects(admin: ReturnType<typeof createAdminClient>): Promise<void> {
  try {
    const { data, error } = await admin.storage.from(BUCKET).list("", {
      limit: CLEANUP_BATCH_SIZE,
      sortBy: { column: "updated_at", order: "asc" },
    });
    if (error || !data || data.length === 0) return;

    const cutoffMs = Date.now() - PURGE_AFTER_SEC * 1000;
    const stalePaths = data
      .filter((item) => {
        const updatedAt = item.updated_at || item.created_at;
        return updatedAt ? new Date(updatedAt).getTime() < cutoffMs : false;
      })
      .map((item) => item.name);
    if (stalePaths.length === 0) return;

    const { error: removeError } = await admin.storage.from(BUCKET).remove(stalePaths);
    if (removeError) {
      console.error("preview cache sweep: remove failed", removeError);
    } else {
      console.log(`preview cache sweep: removed ${stalePaths.length} stale object(s)`);
    }
  } catch (err) {
    console.error("preview cache sweep failed", err);
  }
}

/** Возраст кэшированного объекта в секундах, либо `null` если объекта нет. */
async function getCachedObjectAgeSec(
  admin: ReturnType<typeof createAdminClient>,
  objectPath: string,
): Promise<number | null> {
  const { data, error } = await admin.storage.from(BUCKET).list("", { limit: 1, search: objectPath });
  if (error || !data || data.length === 0) return null;
  const entry = data.find((item) => item.name === objectPath) ?? data[0];
  const updatedAt = entry.updated_at || entry.created_at;
  if (!updatedAt) return null;
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return ageMs >= 0 ? ageMs / 1000 : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const thumioAuthKey = Deno.env.get("THUMIO_AUTH_KEY")?.trim() || undefined;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL or SERVICE_ROLE missing");
    return jsonResponse({ error: "supabase_admin_missing" }, 500);
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey);
  if (Math.random() < CLEANUP_PROBABILITY) {
    EdgeRuntime.waitUntil(sweepStaleObjects(admin));
  }

  const requestUrl = new URL(req.url);
  const target = parseSafeTargetUrl(requestUrl.searchParams.get("url") || "");
  if (!target) {
    return jsonResponse({ error: "invalid_url" }, 400);
  }

  const targetHref = target.toString();
  const cacheKey = await sha256Hex(targetHref);
  const objectPath = `${cacheKey}.jpg`;
  const { data: publicUrlData } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
  const publicUrl = publicUrlData.publicUrl;

  const cachedAgeSec = await getCachedObjectAgeSec(admin, objectPath);
  if (cachedAgeSec !== null && cachedAgeSec < CACHE_TTL_SEC) {
    return redirectToCache(publicUrl, CACHE_TTL_SEC - cachedAgeSec);
  }

  const fresh = await fetchThumioWithRetry(targetHref, thumioAuthKey);
  if (fresh) {
    const contentType = fresh.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await fresh.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(
      objectPath,
      new Blob([bytes], { type: contentType }),
      { contentType, upsert: true, cacheControl: String(CACHE_TTL_SEC) },
    );
    if (uploadError) {
      console.error("storage upload failed", uploadError);
      // Кэш не записался — всё равно отдаём свежие байты напрямую, best-effort.
      return new Response(bytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": `public, max-age=${CACHE_TTL_SEC}`,
        },
      });
    }
    return redirectToCache(publicUrl, CACHE_TTL_SEC);
  }

  // thum.io недоступен/лимит — отдаём протухший кэш, если он ещё не совсем старый.
  if (cachedAgeSec !== null && cachedAgeSec < STALE_TTL_SEC) {
    return redirectToCache(publicUrl, 60);
  }

  return noStoreResponse(204);
});
