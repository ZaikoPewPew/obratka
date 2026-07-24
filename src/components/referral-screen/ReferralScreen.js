import { getStrings } from "../../i18n.js";
import { brandMarkSvg } from "../../assets/brand/brandMarks.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import {
  closeBrandScreen,
  openBrandScreen,
} from "../../utils/brandScreenTransition.js";
import { normalizeReferralCode } from "../../utils/referralCode.js";

const PLACEHOLDER_AVATAR_COUNT = 4;

/**
 * Тёмный плейсхолдер-аватар (пока без реальных фото).
 * @returns {HTMLSpanElement}
 */
function createPlaceholderAvatar() {
  const avatar = document.createElement("span");
  avatar.className = "url-screen__avatar url-screen__avatar--placeholder";
  return avatar;
}

/**
 * Экран реферального кода: 1:1 с UrlScreen (Figma split), другая копирайта слева.
 * @param {{
 *   onSubmit: (referral: string) => void | Promise<void>;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: (prefill?: string, opts?: { handoff?: boolean }) => void;
 *   close: (opts?: { handoff?: boolean }) => Promise<void>;
 *   setError: (reason?: string | null) => void;
 * }}
 */
export function createReferralScreen({ onSubmit }) {
  const t = getStrings();

  const root = document.createElement("section");
  root.className = "url-screen referral-screen";
  root.setAttribute("aria-labelledby", "referral-screen-title");
  root.hidden = true;

  const layout = document.createElement("div");
  layout.className = "url-screen__layout";

  const formPane = document.createElement("div");
  formPane.className = "url-screen__form-pane";

  const block = document.createElement("div");
  block.className = "url-screen__block";

  const title = document.createElement("h1");
  title.className = "url-screen__title";
  title.id = "referral-screen-title";
  title.textContent = t.referralTitle;

  const form = document.createElement("form");
  form.className = "url-screen__form";
  form.noValidate = true;

  const field = document.createElement("div");
  field.className = "url-screen__field";

  const inputWrap = document.createElement("div");
  inputWrap.className = "url-screen__input-wrap";

  const input = document.createElement("input");
  input.className = "url-screen__input";
  input.id = "referral-screen-input";
  input.type = "text";
  input.name = "referralCode";
  input.required = true;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", t.referralTitle);
  input.placeholder = t.referralPlaceholder;

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "url-screen__submit";
  submit.hidden = true;
  submit.setAttribute("aria-label", t.referralSubmit);
  submit.title = t.referralSubmit;
  submit.innerHTML = `
    <svg class="url-screen__submit-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19 6.5V13a3.5 3.5 0 0 1-3.5 3.5H7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
      <path d="M10.5 12.5 7 16l3.5 3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  inputWrap.append(input, submit);

  const error = document.createElement("p");
  error.className = "url-screen__error";
  error.hidden = true;
  error.textContent = t.referralInvalid;

  field.append(inputWrap, error);

  const platforms = document.createElement("div");
  platforms.className = "url-screen__platforms";

  const avatars = document.createElement("div");
  avatars.className = "url-screen__avatars";
  avatars.setAttribute("aria-hidden", "true");

  for (let i = 0; i < PLACEHOLDER_AVATAR_COUNT; i += 1) {
    avatars.append(createPlaceholderAvatar());
  }

  const platformsText = document.createElement("p");
  platformsText.className = "url-screen__platforms-text";
  platformsText.textContent = t.referralColleagues;

  platforms.append(avatars, platformsText);
  form.append(field, platforms);
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
    ${brandMarkSvg("url-screen__brand-mark")}
  `;

  visual.append(glow, noise, brand);
  const meshWash = mountMeshGradientWash(glow);
  meshWash.setActive(false);

  layout.append(formPane, visual);
  root.append(layout);

  let closing = false;
  let submitting = false;

  /**
   * @param {string | null | undefined} reason
   */
  function setError(reason) {
    const strings = getStrings();
    if (!reason) {
      error.hidden = true;
      input.setAttribute("aria-invalid", "false");
      return;
    }
    const messages = {
      invalid: strings.referralInvalid,
      exhausted: strings.referralExhausted,
      not_configured: strings.referralNotConfigured,
      rpc_failed: strings.referralValidateError,
      self_referral: strings.referralInvalid,
    };
    error.textContent = messages[reason] || strings.referralInvalid;
    error.hidden = false;
    input.setAttribute("aria-invalid", "true");
  }

  function syncSubmitVisibility() {
    const hasValue = input.value.trim().length > 0;
    submit.hidden = !hasValue || submitting;
    inputWrap.classList.toggle("url-screen__input-wrap--ready", hasValue);
  }

  /**
   * @param {string} [prefill]
   * @param {{ handoff?: boolean }} [opts]
   */
  function open(prefill = "", opts = {}) {
    closing = false;
    submitting = false;
    openBrandScreen({
      root,
      meshWash,
      opts,
      prepare: () => {
        setError(null);
        input.value = prefill;
        input.disabled = false;
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
    if (submitting) return;

    const normalized = normalizeReferralCode(input.value);
    if (!normalized) {
      setError("invalid");
      input.focus();
      return;
    }

    setError(null);
    submitting = true;
    input.disabled = true;
    syncSubmitVisibility();

    void Promise.resolve(onSubmit(normalized))
      .catch((err) => {
        const reason =
          err && typeof err === "object" && "reason" in err
            ? String(/** @type {{ reason: unknown }} */ (err).reason)
            : "rpc_failed";
        setError(reason);
      })
      .finally(() => {
        submitting = false;
        input.disabled = false;
        syncSubmitVisibility();
      });
  });

  input.addEventListener("input", () => {
    if (!error.hidden) setError(null);
    syncSubmitVisibility();
  });

  return { root, open, close, setError };
}
