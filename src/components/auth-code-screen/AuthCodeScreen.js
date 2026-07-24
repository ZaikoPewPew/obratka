import { requestEmailOtp, verifyEmailOtp } from "../../api/auth.js";
import { formatString, getStrings } from "../../i18n.js";
import { createBrandScreenVisual } from "../brand-screen-visual/BrandScreenVisual.js";
import { ensureFieldErrorInner } from "../../utils/fieldError.js";
import {
  isFieldErrorVisible,
  setUrlScreenOtpInvalid,
} from "../../utils/urlScreenField.js";
import {
  getAuthCodeResendCooldownMs,
  getScreenCloseFallbackMs,
} from "../../utils/motionTokens.js";
import {
  closeBrandScreen,
  openBrandScreen,
} from "../../utils/brandScreenTransition.js";

const OTP_LENGTH = 6;

/**
 * @typedef {{
 *   type: 'email';
 *   userId: string;
 *   email: string;
 *   firstName?: string | null;
 *   photoUrl?: string | null;
 * }} AuthCodeSuccess
 */

/**
 * Экран кода из письма: split как auth-screen; единый OTP-инпут (6 ячеек) + resend + назад.
 *
 * @param {{
 *   onSuccess: (result: AuthCodeSuccess) => void | Promise<void>;
 *   onBack: () => void | Promise<void>;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: (email: string, opts?: { handoff?: boolean }) => void;
 *   close: (opts?: { handoff?: boolean }) => Promise<void>;
 * }}
 */
export function createAuthCodeScreen({ onSuccess, onBack }) {
  const t = getStrings();
  /** @type {string} */
  let pendingEmail = "";
  let closing = false;
  let verifying = false;
  let resendBusy = false;
  /** @type {ReturnType<typeof setInterval> | null} */
  let cooldownTimer = null;
  let cooldownUntil = 0;

  const root = document.createElement("section");
  root.className = "url-screen auth-code-screen";
  root.setAttribute("aria-labelledby", "auth-code-screen-title");
  root.hidden = true;

  const layout = document.createElement("div");
  layout.className = "url-screen__layout";

  const formPane = document.createElement("div");
  formPane.className = "url-screen__form-pane auth-code-screen__pane";

  const top = document.createElement("div");
  top.className = "auth-code-screen__top review-panel__top";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "review-panel__back auth-code-screen__back";
  backBtn.setAttribute("aria-label", t.authCodeBack);

  const backIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  backIcon.setAttribute("class", "review-panel__back-icon");
  backIcon.setAttribute("width", "24");
  backIcon.setAttribute("height", "24");
  backIcon.setAttribute("viewBox", "0 0 24 24");
  backIcon.setAttribute("fill", "none");
  backIcon.setAttribute("aria-hidden", "true");
  const backPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  backPath.setAttribute("d", "M11 18L5 12L11 6M5 12H19");
  backPath.setAttribute("stroke", "currentColor");
  backPath.setAttribute("stroke-width", "1.3");
  backPath.setAttribute("stroke-linecap", "round");
  backPath.setAttribute("stroke-linejoin", "round");
  backIcon.append(backPath);

  const backLabel = document.createElement("span");
  backLabel.className = "review-panel__back-label";
  backLabel.textContent = t.authCodeBack;

  backBtn.append(backIcon, backLabel);
  top.append(backBtn);

  const stage = document.createElement("div");
  stage.className = "auth-code-screen__stage";

  const block = document.createElement("div");
  block.className = "url-screen__block auth-code-screen__block";

  const title = document.createElement("h1");
  title.className = "url-screen__title auth-code-screen__title";
  title.id = "auth-code-screen-title";
  title.textContent = t.authCodeTitle;

  const form = document.createElement("form");
  form.className = "url-screen__form auth-code-screen__form";
  form.noValidate = true;

  const cells = document.createElement("div");
  cells.className = "auth-code-screen__cells";
  cells.setAttribute("role", "group");
  cells.setAttribute("aria-label", t.authCodeLabel);

  const otpInput = document.createElement("input");
  otpInput.className = "auth-code-screen__input";
  otpInput.id = "auth-code-screen-otp";
  otpInput.type = "text";
  otpInput.name = "otp";
  otpInput.inputMode = "numeric";
  otpInput.autocomplete = "one-time-code";
  otpInput.spellcheck = false;
  otpInput.maxLength = OTP_LENGTH;
  otpInput.pattern = "[0-9]*";
  otpInput.setAttribute("aria-label", t.authCodeLabel);
  otpInput.enterKeyHint = "done";

  /** @type {HTMLElement[]} */
  const digits = [];
  for (let i = 0; i < OTP_LENGTH; i += 1) {
    const digit = document.createElement("span");
    digit.className = "auth-code-screen__cell";
    digit.setAttribute("aria-hidden", "true");
    digits.push(digit);
    cells.append(digit);
  }
  cells.append(otpInput);

  const error = document.createElement("p");
  error.className = "url-screen__error auth-code-screen__error";
  error.hidden = true;
  error.setAttribute("aria-hidden", "true");
  error.setAttribute("role", "alert");
  ensureFieldErrorInner(error).textContent = t.authOtpInvalid;

  const resend = document.createElement("button");
  resend.type = "button";
  resend.className = "auth-code-screen__resend";
  resend.textContent = t.authCodeResend;

  form.append(cells, error, resend);
  block.append(title, form);
  stage.append(block);
  formPane.append(top, stage);

  const brandVisual = createBrandScreenVisual();
  brandVisual.bindScreenRoot(root);
  const { meshWash } = brandVisual;

  layout.append(formPane, brandVisual.root);
  root.append(layout);

  /**
   * @returns {number}
   */
  function getCooldownSecondsLeft() {
    if (!cooldownUntil) return 0;
    return Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  }

  /**
   * @returns {boolean}
   */
  function isCooldownActive() {
    return getCooldownSecondsLeft() > 0;
  }

  function clearCooldownTimer() {
    if (cooldownTimer != null) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }

  function syncResendLabel() {
    if (resendBusy) {
      resend.textContent = t.authOtpResending;
      return;
    }
    const seconds = getCooldownSecondsLeft();
    if (seconds > 0) {
      resend.textContent = formatString(t.authCodeResendWait, { seconds });
      return;
    }
    resend.textContent = t.authCodeResend;
  }

  function syncControls() {
    const locked = verifying || resendBusy;
    const cooldown = isCooldownActive();
    otpInput.disabled = locked;
    resend.disabled = locked || cooldown;
    backBtn.disabled = locked;
    cells.classList.toggle("auth-code-screen__cells--busy", locked);
    resend.classList.toggle(
      "auth-code-screen__resend--cooldown",
      cooldown && !resendBusy,
    );
    syncResendLabel();
    syncDigits();
  }

  function stopCooldown() {
    cooldownUntil = 0;
    clearCooldownTimer();
    syncControls();
  }

  function startCooldown() {
    cooldownUntil = Date.now() + getAuthCodeResendCooldownMs();
    clearCooldownTimer();
    syncControls();
    cooldownTimer = setInterval(() => {
      if (!isCooldownActive()) {
        stopCooldown();
        return;
      }
      syncResendLabel();
    }, 250);
  }

  /**
   * @returns {string}
   */
  function getCode() {
    return otpInput.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
  }

  function syncDigits() {
    const code = getCode();
    const activeIndex = Math.min(code.length, OTP_LENGTH - 1);
    digits.forEach((digit, index) => {
      digit.textContent = code[index] ?? "";
      digit.classList.toggle(
        "auth-code-screen__cell--filled",
        Boolean(code[index]),
      );
      digit.classList.toggle(
        "auth-code-screen__cell--active",
        !verifying && !resendBusy && index === activeIndex,
      );
    });
    cells.classList.toggle(
      "auth-code-screen__cells--complete",
      code.length === OTP_LENGTH,
    );
  }

  /**
   * @param {boolean} visible
   * @param {string} [message]
   */
  function setError(visible, message) {
    setUrlScreenOtpInvalid(
      { cells, input: otpInput, error },
      { visible, message: message || t.authOtpInvalid },
    );
    brandVisual.setVariant(visible ? "invalid" : "default");
  }

  /**
   * @param {unknown} err
   * @returns {string}
   */
  function otpErrorMessage(err) {
    const code = err instanceof Error ? err.message : String(err || "");
    if (code === "supabase_not_configured") return t.authOtpNotConfigured;
    if (code === "email_otp_rate_limit") return t.authOtpRateLimit;
    if (code === "email_otp_invalid") return t.authOtpInvalid;
    if (code === "auth_identity_conflict") return t.authIdentityConflict;
    return t.authOtpSendError;
  }

  /**
   * @param {boolean} busy
   */
  function setBusy(busy) {
    verifying = busy;
    syncControls();
  }

  /**
   * @param {boolean} busy
   */
  function setResendBusy(busy) {
    resendBusy = busy;
    resend.setAttribute("aria-busy", busy ? "true" : "false");
    syncControls();
  }

  function clearCode() {
    otpInput.value = "";
    syncDigits();
  }

  function focusOtp() {
    otpInput.focus();
    const len = getCode().length;
    try {
      otpInput.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
  }

  async function maybeVerify() {
    if (verifying || resendBusy) return;
    const code = getCode();
    if (code.length !== OTP_LENGTH) return;
    if (!pendingEmail) return;

    setError(false);
    setBusy(true);
    try {
      const session = await verifyEmailOtp(pendingEmail, code);
      void Promise.resolve(
        onSuccess({
          type: "email",
          userId: session.user.userId,
          email: session.user.email || pendingEmail,
          firstName: session.user.firstName,
          photoUrl: session.user.photoUrl,
        }),
      );
    } catch (err) {
      const codeName = err instanceof Error ? err.message : String(err || "");
      setError(
        true,
        codeName === "email_otp_invalid" ? t.authOtpInvalid : otpErrorMessage(err),
      );
      clearCode();
      focusOtp();
      if (import.meta.env.DEV) {
        console.warn("[auth-code] verify failed", err);
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * @param {string} email
   * @param {{ handoff?: boolean }} [opts]
   */
  function open(email, opts = {}) {
    pendingEmail = String(email || "")
      .trim()
      .toLowerCase();
    closing = false;
    openBrandScreen({
      root,
      meshWash,
      opts,
      prepare: () => {
        setBusy(false);
        setResendBusy(false);
        setError(false);
        clearCode();
        title.textContent = t.authCodeTitle;
        startCooldown();
        queueMicrotask(() => focusOtp());
      },
    });
  }

  /**
   * @param {{ handoff?: boolean }} [opts]
   * @returns {Promise<void>}
   */
  function close(opts = {}) {
    stopCooldown();
    return closeBrandScreen({
      root,
      meshWash,
      opts,
      isClosing: () => closing,
      setClosing: (value) => {
        closing = value;
      },
      getFallbackMs: getScreenCloseFallbackMs,
    });
  }

  cells.addEventListener("pointerdown", (event) => {
    if (verifying || resendBusy) return;
    if (event.target === otpInput) return;
    event.preventDefault();
    focusOtp();
  });

  otpInput.addEventListener("input", () => {
    if (isFieldErrorVisible(error)) setError(false);
    otpInput.value = getCode();
    syncDigits();
    void maybeVerify();
  });

  otpInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void maybeVerify();
    }
  });

  otpInput.addEventListener("focus", () => {
    syncDigits();
  });

  otpInput.addEventListener("blur", () => {
    digits.forEach((digit) => {
      digit.classList.remove("auth-code-screen__cell--active");
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void maybeVerify();
  });

  backBtn.addEventListener("click", () => {
    if (verifying || resendBusy) return;
    void Promise.resolve(onBack());
  });

  resend.addEventListener("click", async () => {
    if (verifying || resendBusy || isCooldownActive() || !pendingEmail) return;
    setError(false);
    setResendBusy(true);
    try {
      await requestEmailOtp(pendingEmail);
      clearCode();
      focusOtp();
      startCooldown();
    } catch (err) {
      setError(true, otpErrorMessage(err));
      if (import.meta.env.DEV) {
        console.warn("[auth-code] resend failed", err);
      }
    } finally {
      setResendBusy(false);
    }
  });

  syncDigits();

  return { root, open, close };
}
