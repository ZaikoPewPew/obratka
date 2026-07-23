import { requestEmailOtp, verifyEmailOtp } from "../../api/auth.js";
import { formatString, getStrings } from "../../i18n.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
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
  error.setAttribute("role", "alert");
  error.textContent = t.authOtpInvalid;

  const resend = document.createElement("button");
  resend.type = "button";
  resend.className = "auth-code-screen__resend";
  resend.textContent = t.authCodeResend;

  form.append(cells, error, resend);
  block.append(title, form);
  stage.append(block);
  formPane.append(top, stage);

  const visual = document.createElement("div");
  visual.className = "url-screen__visual";
  visual.setAttribute("aria-hidden", "true");

  const glow = document.createElement("div");
  glow.className = "url-screen__glow";

  const noise = document.createElement("span");
  noise.className = "url-screen__noise";

  const brand = document.createElement("div");
  brand.className = "url-screen__brand";
  brand.innerHTML = `
    <svg class="url-screen__brand-mark" width="44" height="30" viewBox="0 0 44 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14.6249 30C11.6748 30 9.10235 29.4585 6.90772 28.3755C4.71308 27.2924 3.00414 25.7762 1.7809 23.8267C0.593632 21.8773 0 19.5848 0 16.9495C0 13.7004 0.755531 10.8123 2.26659 8.2852C3.77766 5.72202 5.84637 3.70036 8.47274 2.22022C11.1351 0.740072 14.1572 0 17.5391 0C20.5253 0 23.0977 0.541516 25.2563 1.62455C27.451 2.70758 29.1419 4.22383 30.3292 6.17328C31.5524 8.08664 32.1641 10.3791 32.1641 13.0505C32.1641 16.2635 31.4085 19.1516 29.8975 21.7148C28.3864 24.278 26.3177 26.2996 23.6913 27.7798C21.0649 29.2599 18.0428 30 14.6249 30ZM15.1646 23.0686C16.8196 23.0686 18.2767 22.6715 19.5359 21.8773C20.8311 21.0469 21.8385 19.9097 22.558 18.4657C23.2776 17.0217 23.6373 15.343 23.6373 13.4296C23.6373 11.4801 23.0617 9.90975 21.9104 8.71841C20.7591 7.52708 19.1401 6.93141 17.0534 6.93141C15.3984 6.93141 13.9234 7.34657 12.6282 8.1769C11.3689 8.97112 10.3616 10.0903 9.60604 11.5343C8.88649 12.9783 8.52671 14.657 8.52671 16.5704C8.52671 18.556 9.10235 20.1444 10.2536 21.3357C11.4049 22.491 13.0419 23.0686 15.1646 23.0686Z" fill="white"/>
      <path d="M38.4415 30C37.0023 30 35.8151 29.5487 34.8797 28.6462C33.9442 27.7076 33.4765 26.5343 33.4765 25.1264C33.4765 23.4296 34.0162 22.0758 35.0955 21.065C36.2108 20.0181 37.542 19.4946 39.089 19.4946C40.5282 19.4946 41.6974 19.9458 42.5969 20.8484C43.5323 21.7509 44 22.9242 44 24.3682C44 25.4874 43.7302 26.4801 43.1905 27.3466C42.6868 28.1769 42.0212 28.8267 41.1937 29.296C40.3663 29.7653 39.4488 30 38.4415 30Z" fill="white"/>
    </svg>
  `;

  visual.append(glow, noise, brand);
  const meshWash = mountMeshGradientWash(glow);
  meshWash.setActive(false);

  layout.append(formPane, visual);
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
    error.hidden = !visible;
    error.textContent = message || t.authOtpInvalid;
    cells.classList.toggle("auth-code-screen__cells--invalid", visible);
    otpInput.setAttribute("aria-invalid", visible ? "true" : "false");
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
    if (!error.hidden) setError(false);
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
