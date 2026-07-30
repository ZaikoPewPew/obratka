import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient.js";
import {
  probeReadymagPortfolio,
  resolvePortfolioEmbed,
  toExternalEmbedPlan,
} from "../utils/portfolioEmbed.js";

/**
 * @typedef {{
 *   canFrame: boolean | null,
 *   reason?: string,
 *   hostLabel?: string | null,
 *   error?: string,
 * }} PortfolioEmbedProbeResult
 */

/**
 * Sync-резолвер + Edge/Readymag probe для optimistic iframe.
 * Blocklist / Figma / YouTube — сразу без сети.
 * `canFrame === false` или Readymag → external plan до открытия `/review`.
 *
 * @param {string} portfolioUrl
 * @param {{ embedderOrigin?: string, timeoutMs?: number }} [opts]
 * @returns {Promise<import("../utils/portfolioEmbed.js").PortfolioEmbedPlan>}
 */
export async function resolvePortfolioEmbedPlan(portfolioUrl, opts = {}) {
  const plan = resolvePortfolioEmbed(portfolioUrl);
  if (plan.mode === "external" || plan.allowFullscreen || !plan.frameSrc) {
    return plan;
  }

  const timeoutMs =
    typeof opts.timeoutMs === "number" && opts.timeoutMs > 0
      ? opts.timeoutMs
      : 5000;

  const [policy, isReadymag] = await Promise.all([
    probePortfolioEmbed(portfolioUrl, { ...opts, timeoutMs }),
    probeReadymagPortfolio(portfolioUrl, { timeoutMs }),
  ]);

  if (isReadymag) {
    return toExternalEmbedPlan(portfolioUrl, "Readymag");
  }
  if (policy.canFrame === false) {
    return toExternalEmbedPlan(
      portfolioUrl,
      policy.hostLabel || plan.hostLabel || "site",
    );
  }
  return plan;
}

/**
 * @param {string} portfolioUrl
 * @param {{ embedderOrigin?: string, timeoutMs?: number }} [opts]
 * @returns {Promise<PortfolioEmbedProbeResult>}
 */
export async function probePortfolioEmbed(portfolioUrl, opts = {}) {
  if (!isSupabaseConfigured()) {
    return { canFrame: null, error: "supabase_missing" };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { canFrame: null, error: "supabase_missing" };
  }

  const embedderOrigin =
    typeof opts.embedderOrigin === "string" && opts.embedderOrigin
      ? opts.embedderOrigin
      : typeof window !== "undefined"
        ? window.location.origin
        : "";
  const timeoutMs =
    typeof opts.timeoutMs === "number" && opts.timeoutMs > 0
      ? opts.timeoutMs
      : 5000;

  try {
    const invokePromise = supabase.functions.invoke("portfolio-embed-probe", {
      body: {
        url: portfolioUrl,
        embedderOrigin,
      },
    });
    const { data, error } = await Promise.race([
      invokePromise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("probe_timeout")), timeoutMs);
      }),
    ]);

    if (error) {
      return { canFrame: null, error: error.message || "invoke_failed" };
    }

    const canFrame =
      data && typeof data.canFrame === "boolean" ? data.canFrame : null;
    return {
      canFrame,
      reason: typeof data?.reason === "string" ? data.reason : undefined,
      hostLabel: typeof data?.hostLabel === "string" ? data.hostLabel : null,
      error: typeof data?.error === "string" ? data.error : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "probe_failed";
    return { canFrame: null, error: message };
  }
}
