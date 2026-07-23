import { signInWithTelegram } from "../../api/auth.js";
import { getStrings } from "../../i18n.js";
import { isValidEmail } from "../../utils/emailValidation.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import {
  closeBrandScreen,
  openBrandScreen,
} from "../../utils/brandScreenTransition.js";

/**
 * @typedef {'sign-in' | 'sign-up'} AuthMode
 * @typedef {{
 *   type: 'email';
 *   email: string;
 * } | {
 *   type: 'telegram';
 *   userId: string;
 *   email?: string | null;
 *   telegramId?: number;
 *   username?: string | null;
 *   firstName?: string | null;
 *   photoUrl?: string | null;
 * } | {
 *   type: 'google';
 * }} AuthResult
 */

const SUBMIT_ICON_SVG = `
<svg class="url-screen__submit-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M19 6.5V13a3.5 3.5 0 0 1-3.5 3.5H7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
  <path d="M10.5 12.5 7 16l3.5 3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const TELEGRAM_ICON_SVG = `
<svg class="auth-screen__provider-icon auth-screen__provider-icon--telegram" width="29" height="28" viewBox="0 0 29 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M1.98628 12.0538C9.74232 8.10237 14.9142 5.49734 17.502 4.23871C24.8906 0.645084 26.4259 0.0208329 27.4266 0.000219782C27.6467 -0.00431385 28.1388 0.0594683 28.4576 0.361928C28.7267 0.61732 28.8008 0.962317 28.8362 1.20446C28.8717 1.44659 28.9158 1.99819 28.8807 2.4292C28.4803 7.3486 26.7478 19.2867 25.8664 24.7965C25.4935 27.1279 24.7591 27.9096 24.0482 27.9861C22.5032 28.1524 21.3299 26.7921 19.8335 25.6451C17.4919 23.8502 16.169 22.7328 13.896 20.9813C11.2693 18.9572 12.9721 17.8447 14.4691 16.0265C14.8609 15.5507 21.6683 8.31018 21.8001 7.65336C21.8165 7.57121 21.8318 7.265 21.6763 7.10332C21.5207 6.94163 21.2911 6.99692 21.1254 7.04089C20.8906 7.10322 17.1498 9.99446 9.90307 15.7146C8.84126 16.5672 7.87951 16.9826 7.01781 16.9608C6.06786 16.9368 4.24053 16.3328 2.8821 15.8164C1.21593 15.1831 -0.108312 14.8482 0.00699973 13.7727C0.0670611 13.2124 0.726821 12.6395 1.98628 12.0538Z" fill="url(#authTgGrad)" />
  <defs>
    <linearGradient id="authTgGrad" x1="28.4147" y1="0.186668" x2="9.97971" y2="17.3366" gradientUnits="userSpaceOnUse">
      <stop stop-color="var(--palette-telegram-start)" />
      <stop offset="1" stop-color="var(--palette-telegram-end)" />
    </linearGradient>
  </defs>
</svg>
`;

const GOOGLE_ICON_SVG = `
<svg class="auth-screen__provider-icon auth-screen__provider-icon--google" width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g clip-path="url(#authGoogleClip)">
    <path d="M27.7273 14.3223C27.7273 13.3706 27.6501 12.4138 27.4855 11.4775H14.2803V16.8687H21.8423C21.5285 18.6074 20.5202 20.1456 19.0438 21.123V24.621H23.5553C26.2046 22.1827 27.7273 18.5817 27.7273 14.3223Z" fill="var(--palette-google-blue)" />
    <path d="M14.2803 28.0009C18.0561 28.0009 21.2404 26.7611 23.5605 24.6211L19.049 21.1231C17.7938 21.977 16.1734 22.4606 14.2854 22.4606C10.633 22.4606 7.5362 19.9965 6.42505 16.6836H1.76953V20.2897C4.14616 25.0172 8.98688 28.0009 14.2803 28.0009V28.0009Z" fill="var(--palette-google-green)" />
    <path d="M6.4199 16.6842C5.83346 14.9454 5.83346 13.0626 6.4199 11.3239V7.71777H1.76953C-0.216144 11.6737 -0.216144 16.3343 1.76953 20.2903L6.4199 16.6842V16.6842Z" fill="var(--palette-google-yellow)" />
    <path d="M14.2803 5.54127C16.2762 5.51041 18.2053 6.26146 19.6508 7.64012L23.6479 3.64305C21.1169 1.26642 17.7578 -0.0402103 14.2803 0.000943444C8.98687 0.000943444 4.14616 2.98459 1.76953 7.71728L6.41991 11.3234C7.52591 8.00536 10.6279 5.54127 14.2803 5.54127V5.54127Z" fill="var(--palette-google-red)" />
  </g>
  <defs>
    <clipPath id="authGoogleClip">
      <rect width="28" height="28" fill="var(--palette-white)" />
    </clipPath>
  </defs>
</svg>
`;

/**
 * Экран регистрации: split как url-screen; форма — как старый PDF/done
 * (заголовок → email → разделитель → Telegram / Google).
 *
 * @param {{
 *   onSuccess: (result: AuthResult) => void | Promise<void>;
 *   mode?: AuthMode;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: (mode?: AuthMode) => void;
 *   close: () => Promise<void>;
 *   setMode: (mode: AuthMode) => void;
 * }}
 */
export function createAuthScreen({ onSuccess, mode: initialMode = "sign-up" }) {
  const t = getStrings();
  /** @type {AuthMode} */
  let mode = initialMode;

  const root = document.createElement("section");
  root.className = "url-screen auth-screen";
  root.setAttribute("aria-labelledby", "auth-screen-title");
  root.hidden = true;

  const layout = document.createElement("div");
  layout.className = "url-screen__layout";

  const formPane = document.createElement("div");
  formPane.className = "url-screen__form-pane";

  const block = document.createElement("div");
  block.className = "url-screen__block auth-screen__block";

  const title = document.createElement("h1");
  title.className = "url-screen__title auth-screen__title";
  title.id = "auth-screen-title";
  title.textContent = t.authWelcomeTitle;

  const form = document.createElement("form");
  form.className = "url-screen__form auth-screen__form";
  form.noValidate = true;

  const field = document.createElement("div");
  field.className = "url-screen__field";

  const inputWrap = document.createElement("div");
  inputWrap.className = "url-screen__input-wrap";

  const input = document.createElement("input");
  input.className = "url-screen__input";
  input.id = "auth-screen-email";
  input.type = "email";
  input.name = "email";
  input.required = true;
  input.autocomplete = "email";
  input.inputMode = "email";
  input.spellcheck = false;
  input.setAttribute("aria-label", t.authEmailLabel);
  input.placeholder = t.authEmailPlaceholder;

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "url-screen__submit";
  submit.hidden = true;
  submit.setAttribute("aria-label", t.authEmailSubmitAria);
  submit.title = t.authEmailSubmitAria;
  submit.innerHTML = SUBMIT_ICON_SVG;

  inputWrap.append(input, submit);

  const error = document.createElement("p");
  error.className = "url-screen__error";
  error.hidden = true;
  error.textContent = t.authEmailInvalid;

  const providerError = document.createElement("p");
  providerError.className = "url-screen__error auth-screen__provider-error";
  providerError.hidden = true;
  providerError.setAttribute("role", "alert");

  field.append(inputWrap, error);

  const divider = document.createElement("div");
  divider.className = "auth-screen__divider";
  divider.setAttribute("aria-hidden", "true");

  const dividerLineStart = document.createElement("span");
  dividerLineStart.className = "auth-screen__divider-line";

  const dividerLabel = document.createElement("span");
  dividerLabel.className = "auth-screen__divider-label";
  dividerLabel.textContent = t.authDividerOr;

  const dividerLineEnd = document.createElement("span");
  dividerLineEnd.className = "auth-screen__divider-line";

  divider.append(dividerLineStart, dividerLabel, dividerLineEnd);

  const actions = document.createElement("div");
  actions.className = "auth-screen__actions";

  const telegramBtn = document.createElement("button");
  telegramBtn.type = "button";
  telegramBtn.className = "auth-screen__provider";
  telegramBtn.innerHTML = `${TELEGRAM_ICON_SVG}<span class="auth-screen__provider-label">${t.authTelegram}</span>`;

  const googleBtn = document.createElement("button");
  googleBtn.type = "button";
  googleBtn.className = "auth-screen__provider";
  googleBtn.innerHTML = `${GOOGLE_ICON_SVG}<span class="auth-screen__provider-label">${t.authGoogle}</span>`;

  actions.append(telegramBtn, googleBtn);
  form.append(field, divider, actions, providerError);
  block.append(title, form);
  formPane.append(block);

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

  let closing = false;
  let telegramBusy = false;

  function setError(visible) {
    error.hidden = !visible;
    input.setAttribute("aria-invalid", visible ? "true" : "false");
    inputWrap.classList.toggle("url-screen__input-wrap--invalid", visible);
  }

  /**
   * @param {string | null} message
   */
  function setProviderError(message) {
    if (!message) {
      providerError.hidden = true;
      providerError.textContent = "";
      return;
    }
    providerError.hidden = false;
    providerError.textContent = message;
  }

  /**
   * @param {unknown} err
   * @returns {string}
   */
  function telegramErrorMessage(err) {
    const code = err instanceof Error ? err.message : String(err || "");
    if (code === "telegram_cancelled") return t.authTelegramCancelled;
    if (code === "telegram_bot_id_missing") return t.authTelegramNotConfigured;
    if (code === "supabase_not_configured") return t.authTelegramNotConfigured;
    return t.authTelegramError;
  }

  /**
   * @param {boolean} busy
   */
  function setTelegramBusy(busy) {
    telegramBusy = busy;
    telegramBtn.disabled = busy;
    telegramBtn.setAttribute("aria-busy", busy ? "true" : "false");
    telegramBtn.classList.toggle("auth-screen__provider--busy", busy);
  }

  function syncSubmitVisibility() {
    const hasValue = input.value.trim().length > 0;
    submit.hidden = !hasValue;
    inputWrap.classList.toggle("url-screen__input-wrap--ready", hasValue);
  }

  /**
   * @param {AuthResult} result
   */
  function finish(result) {
    void Promise.resolve(onSuccess(result));
  }

  /**
   * @param {AuthMode} next
   */
  function setMode(next) {
    mode = next;
    void mode;
  }

  /**
   * @param {AuthMode | { handoff?: boolean }} [modeOrOpts]
   * @param {{ handoff?: boolean }} [maybeOpts]
   */
  function open(modeOrOpts, maybeOpts = {}) {
    /** @type {AuthMode | undefined} */
    let nextMode;
    /** @type {{ handoff?: boolean }} */
    let opts = maybeOpts;

    if (modeOrOpts && typeof modeOrOpts === "object") {
      opts = modeOrOpts;
    } else if (typeof modeOrOpts === "string") {
      nextMode = modeOrOpts;
    }

    if (nextMode) setMode(nextMode);
    closing = false;
    openBrandScreen({
      root,
      meshWash,
      opts,
      prepare: () => {
        setError(false);
        setProviderError(null);
        setTelegramBusy(false);
        input.value = "";
        input.placeholder = t.authEmailPlaceholder;
        syncSubmitVisibility();
      },
    });
  }

  /**
   * @param {{ handoff?: boolean }} [opts]
   * @returns {Promise<void>}
   */
  function close(opts = {}) {
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = input.value.trim();
    if (!isValidEmail(email)) {
      setError(true);
      input.focus();
      return;
    }
    setError(false);
    finish({ type: "email", email });
  });

  input.addEventListener("input", () => {
    if (!error.hidden) setError(false);
    syncSubmitVisibility();
  });

  telegramBtn.addEventListener("click", async () => {
    if (telegramBusy) return;
    setProviderError(null);
    setTelegramBusy(true);
    try {
      const session = await signInWithTelegram();
      finish({
        type: "telegram",
        userId: session.user.userId,
        email: session.user.email,
        telegramId: session.user.telegramId,
        username: session.user.username,
        firstName: session.user.firstName,
        photoUrl: session.user.photoUrl,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "telegram_cancelled") {
        setProviderError(null);
      } else {
        setProviderError(telegramErrorMessage(err));
      }
      if (import.meta.env.DEV) {
        console.warn("[auth] telegram sign-in failed", err);
      }
    } finally {
      setTelegramBusy(false);
    }
  });

  googleBtn.addEventListener("click", () => {
    setProviderError(null);
    finish({ type: "google" });
  });

  return { root, open, close, setMode };
}
