/**
 * Referral API stub.
 */

/**
 * @param {string} _codeOrUrl
 * @returns {Promise<{ ok: true; code: string } | { ok: false; reason: string }>}
 */
export async function validateReferral(_codeOrUrl) {
  throw new Error("referrals.validateReferral: not implemented");
}

/**
 * @param {string} _code
 * @returns {Promise<void>}
 */
export async function redeemReferral(_code) {
  throw new Error("referrals.redeemReferral: not implemented");
}
