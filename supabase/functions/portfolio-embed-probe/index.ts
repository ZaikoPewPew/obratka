import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * HEAD/GET portfolio URL server-side → can we iframe it?
 * Client cannot read XFO/CSP (CORS); Chromium also cannot tell XFO-deny
 * from a live cross-origin frame (both throw SecurityError on location).
 *
 * POST JSON: { url, embedderOrigin }
 * → { canFrame, reason, hostLabel?, status? }
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_TARGET_URL_LENGTH = 2048;
const READYMAG_HTML_PROBE_CHARS = 120_000;

const READYMAG_HTML_MARKERS: RegExp[] = [
  /name\s*=\s*["']generator["'][^>]*content\s*=\s*["']Readymag["']/i,
  /content\s*=\s*["']Readymag["'][^>]*name\s*=\s*["']generator["']/i,
  /Designed with Readymag/i,
  /__RM_PROPS__/i,
  /\.rmcdn\.net\b/i,
  /\.rmcdn1\.net\b/i,
];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

function canFrameFromXfo(xfoRaw: string | null): boolean | null {
  if (xfoRaw == null || !xfoRaw.trim()) return null;
  const value = xfoRaw.trim().toLowerCase();
  if (value === "deny") return false;
  if (value === "sameorigin") return false;
  if (value.startsWith("allow-from")) return false;
  return false;
}

function canFrameFromCsp(
  cspRaw: string | null,
  embedderOrigin: string,
): boolean | null {
  if (cspRaw == null || !cspRaw.trim()) return null;
  const frameAncestors = cspRaw
    .split(";")
    .map((d) => d.trim())
    .find((d) => /^frame-ancestors\b/i.test(d));
  if (!frameAncestors) return null;

  const tokens = frameAncestors
    .replace(/^frame-ancestors\b/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());

  if (tokens.length === 0) return null;
  if (tokens.includes("'none'")) return false;
  if (tokens.includes("*")) return true;

  let embedder: string;
  try {
    embedder = new URL(embedderOrigin).origin.toLowerCase();
  } catch {
    return false;
  }

  for (const token of tokens) {
    if (token === "'self'") continue;
    if (token === embedder) return true;
    try {
      if (new URL(token).origin.toLowerCase() === embedder) return true;
    } catch {
      const host = embedder.replace(/^https?:\/\//, "");
      if (token === host || host.endsWith(token.replace(/^\*\./, "."))) {
        return true;
      }
    }
  }
  return false;
}

function resolveFramePolicy(
  headers: Headers,
  embedderOrigin: string,
): { canFrame: boolean; reason: string } {
  const xfo = canFrameFromXfo(headers.get("x-frame-options"));
  if (xfo === false) return { canFrame: false, reason: "xfo" };

  const csp =
    canFrameFromCsp(headers.get("content-security-policy"), embedderOrigin) ??
    canFrameFromCsp(
      headers.get("content-security-policy-report-only"),
      embedderOrigin,
    );
  if (csp === false) return { canFrame: false, reason: "csp" };
  if (csp === true) return { canFrame: true, reason: "csp_allow" };
  return { canFrame: true, reason: "default_allow" };
}

function looksLikeReadymagHtml(html: string): boolean {
  const sample = html.slice(0, READYMAG_HTML_PROBE_CHARS);
  if (!sample) return false;
  return READYMAG_HTML_MARKERS.some((re) => re.test(sample));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let body: { url?: unknown; embedderOrigin?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const target = parseSafeTargetUrl(
    typeof body.url === "string" ? body.url : "",
  );
  if (!target) {
    return jsonResponse({ error: "invalid_url", canFrame: null }, 400);
  }

  const embedderOrigin =
    typeof body.embedderOrigin === "string" && body.embedderOrigin
      ? body.embedderOrigin
      : "";
  if (!embedderOrigin) {
    return jsonResponse({ error: "embedder_required", canFrame: null }, 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(target.href, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; ObratkaEmbedProbe/1.0; +https://zaikopewpew.github.io/obratka/)",
      },
    });

    const policy = resolveFramePolicy(res.headers, embedderOrigin);
    let hostLabel: string | null = null;

    const contentType = res.headers.get("content-type") || "";
    if (/text\/html/i.test(contentType)) {
      const html = await res.text();
      if (looksLikeReadymagHtml(html)) {
        hostLabel = "Readymag";
      }
    } else {
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
    }

    return jsonResponse({
      canFrame: policy.canFrame,
      reason: policy.reason,
      hostLabel,
      status: res.status,
    });
  } catch (err) {
    console.error("portfolio-embed-probe fetch failed", err);
    return jsonResponse({
      canFrame: null,
      error: "fetch_failed",
      reason: "fetch_failed",
    });
  } finally {
    clearTimeout(timer);
  }
});
