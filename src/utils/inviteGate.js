/** Device-scoped invite gate — переживает `clearSession` / logout. */
const STORAGE_KEY = "obratka.inviteGatePassed";

/**
 * Проходил ли этот браузер успешный `validate_referral`.
 * @returns {boolean}
 */
export function getInviteGatePassed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * @param {boolean} passed
 */
export function setInviteGatePassed(passed) {
  try {
    if (passed) {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}
