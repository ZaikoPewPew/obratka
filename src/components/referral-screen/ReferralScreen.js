import {
  getFounderAvatarSourcesForPage,
  getStrings,
} from "../../i18n.js";
import { createBrandScreenShell } from "../brand-screen-shell/BrandScreenShell.js";
import { normalizeReferralCode } from "../../utils/referralCode.js";
import { ensureFieldErrorInner } from "../../utils/fieldError.js";
import {
  isFieldErrorVisible,
  setUrlScreenFieldInvalid,
} from "../../utils/urlScreenField.js";

const UNAVATAR_BASE = "https://unavatar.io/";

/**
 * @param {string} source — путь после unavatar.io/, напр. github/octocat
 * @returns {string}
 */
function unavatarSrc(source) {
  const trimmed = String(source).replace(/^\/+/, "");
  const path = trimmed
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${UNAVATAR_BASE}${path}`;
}

/**
 * Круг из рандомного пула `content/founder-avatars.json` (unavatar.io).
 * При ошибке загрузки остаётся тёмный плейсхолдер.
 * @param {string} source
 * @returns {HTMLSpanElement}
 */
function createFounderAvatar(source) {
  const avatar = document.createElement("span");
  avatar.className =
    "url-screen__avatar url-screen__avatar--placeholder url-screen__avatar--photo";

  const img = document.createElement("img");
  img.className = "url-screen__avatar-img";
  img.src = unavatarSrc(source);
  img.alt = "";
  img.width = 32;
  img.height = 32;
  img.decoding = "async";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";

  function revealPhoto() {
    avatar.classList.remove("url-screen__avatar--placeholder");
    avatar.classList.add("url-screen__avatar--photo-ready");
  }

  img.addEventListener("load", revealPhoto);
  if (img.complete && img.naturalWidth > 0) {
    revealPhoto();
  }
  img.addEventListener("error", () => {
    img.remove();
    avatar.classList.remove(
      "url-screen__avatar--photo",
      "url-screen__avatar--photo-ready",
    );
  });

  avatar.append(img);
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
  error.setAttribute("aria-hidden", "true");
  ensureFieldErrorInner(error).textContent = t.referralInvalid;

  field.append(inputWrap, error);

  const platforms = document.createElement("div");
  platforms.className = "url-screen__platforms";

  const avatars = document.createElement("div");
  avatars.className = "url-screen__avatars";
  avatars.setAttribute("aria-hidden", "true");

  for (const source of getFounderAvatarSourcesForPage()) {
    avatars.append(createFounderAvatar(source));
  }

  const platformsText = document.createElement("p");
  platformsText.className = "url-screen__platforms-text";
  platformsText.textContent = t.referralColleagues;

  platforms.append(avatars, platformsText);
  form.append(field, platforms);
  block.append(title, form);

  const shell = createBrandScreenShell({
    labelledById: "referral-screen-title",
    content: block,
    rootClassName: "url-screen",
  });
  shell.root.classList.add("referral-screen");
  const brandVisual = shell.getBrandVisual();

  let submitting = false;

  /**
   * @param {string | null | undefined} reason
   */
  function setError(reason) {
    const strings = getStrings();
    if (!reason) {
      setUrlScreenFieldInvalid(
        { wrap: inputWrap, input, error },
        { visible: false },
      );
      brandVisual.setVariant("default");
      return;
    }
    const messages = {
      invalid: strings.referralInvalid,
      exhausted: strings.referralExhausted,
      not_configured: strings.referralNotConfigured,
      rpc_failed: strings.referralValidateError,
      self_referral: strings.referralInvalid,
    };
    setUrlScreenFieldInvalid(
      { wrap: inputWrap, input, error },
      {
        visible: true,
        message: messages[reason] || strings.referralInvalid,
      },
    );
    brandVisual.setVariant("invalid");
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
    submitting = false;
    shell.open({
      ...opts,
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
    return shell.close(opts);
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
    if (isFieldErrorVisible(error)) setError(null);
    syncSubmitVisibility();
  });

  return { root: shell.root, open, close, setError };
}
