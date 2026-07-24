import { getSupabase } from "../lib/supabaseClient.js";
import {
  buildReferralShareUrl,
  normalizeReferralCode,
  REFERRAL_MAX_USES,
} from "../utils/referralCode.js";

export {
  buildReferralShareUrl,
  normalizeReferralCode,
  REFERRAL_MAX_USES,
};

/**
 * @typedef {{
 *   ok: true;
 *   code: string;
 *   slotsLeft: number;
 *   kind?: 'user' | 'seed';
 * } | {
 *   ok: false;
 *   reason: 'invalid' | 'exhausted' | 'not_configured' | 'self_referral' | 'not_authenticated' | 'no_profile' | 'rpc_failed';
 *   code?: string;
 *   slotsLeft?: number;
 * }} ReferralResult
 */

/**
 * @param {unknown} data
 * @returns {ReferralResult}
 */
function mapRpcPayload(data) {
  if (!data || typeof data !== "object") {
    return { ok: false, reason: "rpc_failed" };
  }
  const row = /** @type {Record<string, unknown>} */ (data);
  const code = typeof row.code === "string" ? row.code : undefined;
  const slotsLeft =
    typeof row.slots_left === "number"
      ? row.slots_left
      : typeof row.slotsLeft === "number"
        ? row.slotsLeft
        : undefined;
  const kind =
    row.kind === "user" || row.kind === "seed" ? row.kind : undefined;
  const reasonRaw = typeof row.reason === "string" ? row.reason : "";

  if (row.ok === true) {
    const okCode = code || (reasonRaw === "already_redeemed" ? "REDEEMED" : "");
    if (!okCode) return { ok: false, reason: "rpc_failed" };
    return {
      ok: true,
      code: okCode,
      slotsLeft: typeof slotsLeft === "number" ? slotsLeft : 0,
      kind,
    };
  }

  /** @type {ReferralResult['reason']} */
  let reason = "invalid";
  if (
    reasonRaw === "exhausted" ||
    reasonRaw === "self_referral" ||
    reasonRaw === "not_authenticated" ||
    reasonRaw === "no_profile" ||
    reasonRaw === "not_configured" ||
    reasonRaw === "invalid"
  ) {
    reason = reasonRaw;
  } else if (reasonRaw) {
    reason = "rpc_failed";
  }

  return { ok: false, reason, code, slotsLeft };
}

/**
 * @param {string} codeOrUrl
 * @returns {Promise<ReferralResult>}
 */
export async function validateReferral(codeOrUrl) {
  const code = normalizeReferralCode(codeOrUrl);
  if (!code) {
    return { ok: false, reason: "invalid" };
  }

  const supabase = getSupabase();
  if (!supabase) {
    if (import.meta.env.DEV) {
      return { ok: true, code, slotsLeft: REFERRAL_MAX_USES, kind: "seed" };
    }
    return { ok: false, reason: "not_configured" };
  }

  const { data, error } = await supabase.rpc("validate_referral", {
    p_code: code,
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[referrals] validateReferral", error.message);
    }
    return { ok: false, reason: "rpc_failed" };
  }

  return mapRpcPayload(data);
}

/**
 * Погасить код после логина (один раз на аккаунт).
 * @param {string} codeOrUrl
 * @returns {Promise<ReferralResult>}
 */
export async function redeemReferral(codeOrUrl) {
  const code = normalizeReferralCode(codeOrUrl);
  if (!code) {
    return { ok: false, reason: "invalid" };
  }

  const supabase = getSupabase();
  if (!supabase) {
    if (import.meta.env.DEV) {
      return { ok: true, code, slotsLeft: REFERRAL_MAX_USES, kind: "seed" };
    }
    return { ok: false, reason: "not_configured" };
  }

  const { data, error } = await supabase.rpc("redeem_referral", {
    p_code: code,
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[referrals] redeemReferral", error.message);
    }
    return { ok: false, reason: "rpc_failed" };
  }

  return mapRpcPayload(data);
}

/**
 * @typedef {{
 *   code: string | null;
 *   uses: number;
 *   maxUses: number;
 *   slotsLeft: number;
 * }} MyReferral
 */

/**
 * Мой код и оставшиеся слоты (из профиля).
 * @returns {Promise<MyReferral | null>}
 */
export async function fetchMyReferral() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("referral_code, referral_uses")
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[referrals] fetchMyReferral", error.message);
    }
    return null;
  }

  const code =
    typeof data?.referral_code === "string" ? data.referral_code : null;
  const uses =
    typeof data?.referral_uses === "number" ? data.referral_uses : 0;

  return {
    code,
    uses,
    maxUses: REFERRAL_MAX_USES,
    slotsLeft: Math.max(0, REFERRAL_MAX_USES - uses),
  };
}
