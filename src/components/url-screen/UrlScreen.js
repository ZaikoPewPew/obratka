import { getStrings } from "../../i18n.js";
import { createBrandScreenVisual } from "../brand-screen-visual/BrandScreenVisual.js";
import { normalizePortfolioUrl } from "../../utils/portfolioMeta.js";
import { resolvePlatformIcon } from "../../utils/platformBrandIcon.js";
import {
  ensureFieldErrorInner,
  setFieldErrorMessage,
} from "../../utils/fieldError.js";
import {
  isFieldErrorVisible,
  setUrlScreenFieldInvalid,
} from "../../utils/urlScreenField.js";
import {
  getMotionReveal,
  getReportLaunchMotion,
  getScreenCloseFallbackMs,
} from "../../utils/motionTokens.js";
import {
  closeBrandScreen,
  openBrandScreen,
} from "../../utils/brandScreenTransition.js";

/** Платформы в стеке иконок под полем URL (Framer → Dprofile → Behance → Notion). */
const PLATFORM_ICONS = Object.freeze([
  { id: "framer", host: "framer.com" },
  { id: "dprofile", host: "dprofile.ru" },
  { id: "behance", host: "behance.net" },
  { id: "notion", host: "notion.com" },
]);

const PREVIEW_DEBOUNCE_MS = 450;

/**
 * @param {{ id: string; host: string }} platform
 * @returns {HTMLSpanElement}
 */
function createPlatformAvatar({ id, host }) {
  const avatar = document.createElement("span");
  avatar.className = `url-screen__avatar url-screen__avatar--${id}`;

  const resolved = resolvePlatformIcon(host);
  if (!resolved) return avatar;

  if (resolved.kind === "web") {
    const letter = document.createElement("span");
    letter.className = "url-screen__avatar-letter";
    letter.textContent = getStrings().homePlatformWebLetter;
    letter.setAttribute("aria-hidden", "true");
    avatar.classList.add("url-screen__avatar--web");
    avatar.append(letter);
    return avatar;
  }

  const img = document.createElement("img");
  img.className = "url-screen__avatar-img";
  img.src = resolved.src;
  img.alt = "";
  img.width = 32;
  img.height = 32;
  img.decoding = "async";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";

  const fallbacks = resolved.fallbacks;
  let fallbackIndex = 0;

  img.addEventListener("error", () => {
    if (fallbackIndex < fallbacks.length) {
      img.src = fallbacks[fallbackIndex];
      fallbackIndex += 1;
      return;
    }
    img.remove();
  });

  avatar.append(img);
  return avatar;
}

/**
 * Экран ссылки: ввод URL + лист-заглушка «Портфолио» со скелетонами.
 * Submit → тот же leave/enter, что quiz → done (лист улетает, зелёный mesh).
 *
 * @param {{
 *   onSubmit: (url: string) => void | Promise<void>;
 *   onExit?: () => void | Promise<void>;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: (prefill?: string) => void;
 *   close: () => Promise<void>;
 * }}
 */
export function createUrlScreen({ onSubmit, onExit }) {
  const t = getStrings();

  const root = document.createElement("section");
  root.className = "url-screen";
  root.setAttribute("aria-labelledby", "url-screen-title");
  root.hidden = true;

  const layout = document.createElement("div");
  layout.className = "url-screen__layout";

  const formPane = document.createElement("div");
  formPane.className = "url-screen__form-pane";

  const block = document.createElement("div");
  block.className = "url-screen__block";

  const title = document.createElement("h1");
  title.className = "url-screen__title";
  title.id = "url-screen-title";
  title.textContent = t.urlModalTitle;

  const form = document.createElement("form");
  form.className = "url-screen__form";
  form.noValidate = true;

  const field = document.createElement("div");
  field.className = "url-screen__field";

  const inputWrap = document.createElement("div");
  inputWrap.className = "url-screen__input-wrap";

  const input = document.createElement("input");
  input.className = "url-screen__input";
  input.id = "url-screen-input";
  input.type = "url";
  input.name = "portfolioUrl";
  input.required = true;
  input.autocomplete = "url";
  input.spellcheck = false;
  input.setAttribute("aria-label", t.urlModalTitle);
  input.placeholder = t.urlModalPlaceholder;

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "url-screen__submit";
  submit.hidden = true;
  submit.setAttribute("aria-label", t.urlModalSubmit);
  submit.title = t.urlModalSubmit;
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
  ensureFieldErrorInner(error).textContent = t.urlModalInvalid;

  field.append(inputWrap, error);

  const platforms = document.createElement("div");
  platforms.className = "url-screen__platforms";

  const avatars = document.createElement("div");
  avatars.className = "url-screen__avatars";
  avatars.setAttribute("aria-hidden", "true");

  for (const platform of PLATFORM_ICONS) {
    avatars.append(createPlatformAvatar(platform));
  }

  const platformsText = document.createElement("p");
  platformsText.className = "url-screen__platforms-text";
  platformsText.textContent = t.urlScreenPlatforms;

  platforms.append(avatars, platformsText);
  form.append(field, platforms);
  block.append(title, form);

  const done = document.createElement("div");
  done.className = "url-screen__done";
  done.hidden = true;

  const doneTitle = document.createElement("h2");
  doneTitle.className = "url-screen__done-title";
  doneTitle.id = "url-screen-done-title";

  const doneActions = document.createElement("div");
  doneActions.className = "url-screen__done-actions";

  const exitBtn = document.createElement("button");
  exitBtn.type = "button";
  exitBtn.className = "iframe-shell__btn url-screen__done-btn";

  doneActions.append(exitBtn);
  done.append(doneTitle, doneActions);
  formPane.append(block, done);

  const brandVisual = createBrandScreenVisual({ withBrandSlot: true });
  brandVisual.bindScreenRoot(root);
  const { meshWash } = brandVisual;

  const preview = document.createElement("div");
  preview.className = "url-screen__preview";

  const previewSheet = document.createElement("div");
  previewSheet.className = "url-screen__preview-sheet";

  const previewStub = document.createElement("div");
  previewStub.className = "url-screen__preview-stub";

  const stubTitle = document.createElement("p");
  stubTitle.className = "url-screen__preview-stub-title";

  const stubBones = document.createElement("div");
  stubBones.className = "url-screen__preview-stub-bones";

  /** @type {readonly string[]} */
  const boneWidths = ["full", "long", "mid", "full", "long", "short", "mid", "short"];
  for (const width of boneWidths) {
    const bone = document.createElement("span");
    bone.className = `url-screen__preview-stub-bone url-screen__preview-stub-bone--${width}`;
    stubBones.append(bone);
  }

  previewStub.append(stubTitle, stubBones);
  previewSheet.append(previewStub);
  preview.append(previewSheet);
  brandVisual.root.insertBefore(preview, brandVisual.brand);

  layout.append(formPane, brandVisual.root);
  root.append(layout);

  let closing = false;
  let submitting = false;
  let transitioning = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let previewDebounceId = null;
  /** @type {Animation | null} */
  let previewLaunchAnim = null;
  let pendingDoneMesh = false;

  function syncCopy() {
    const strings = getStrings();
    title.textContent = strings.urlModalTitle;
    input.setAttribute("aria-label", strings.urlModalTitle);
    input.placeholder = strings.urlModalPlaceholder;
    submit.setAttribute("aria-label", strings.urlModalSubmit);
    submit.title = strings.urlModalSubmit;
    setFieldErrorMessage(error, strings.urlModalInvalid);
    platformsText.textContent = strings.urlScreenPlatforms;
    stubTitle.textContent = strings.urlPreviewStubTitle;
    doneTitle.textContent = strings.successPortfolioTitle;
    exitBtn.textContent = strings.successGenericPrimary;
  }

  function setError(visible) {
    setUrlScreenFieldInvalid(
      { wrap: inputWrap, input, error },
      { visible },
    );
    brandVisual.setVariant(visible ? "invalid" : "default");
  }

  function syncSubmitVisibility() {
    const hasValue = input.value.trim().length > 0;
    submit.hidden = !hasValue;
    inputWrap.classList.toggle("url-screen__input-wrap--ready", hasValue);
  }

  function clearDoneMesh() {
    pendingDoneMesh = false;
    brandVisual.setVariant("default");
  }

  /** Зелёный mesh + logo-done: старт вместе со спуском лого. */
  function activateDoneMesh() {
    brandVisual.setVariant("done");
  }

  function releasePreviewBrand() {
    root.classList.remove("url-screen--preview");
    if (pendingDoneMesh) {
      pendingDoneMesh = false;
      activateDoneMesh();
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function cancelPreviewLaunch() {
    if (!previewLaunchAnim) return;
    previewLaunchAnim.cancel();
    previewLaunchAnim = null;
    preview.style.transition = "";
    preview.style.opacity = "";
    preview.style.transform = "";
  }

  /**
   * @returns {Promise<void>}
   */
  function launchPreviewAway() {
    cancelPreviewLaunch();

    if (!root.classList.contains("url-screen--preview")) {
      if (pendingDoneMesh) {
        pendingDoneMesh = false;
        activateDoneMesh();
      }
      return Promise.resolve();
    }

    if (prefersReducedMotion()) {
      releasePreviewBrand();
      return Promise.resolve();
    }

    const { durationMs, liftPx, peak, easeLift, easeDive } =
      getReportLaunchMotion();
    const styles = getComputedStyle(root);
    const shown =
      styles.getPropertyValue("--shell-review-report-shift-shown").trim() ||
      "22%";
    const hidden =
      styles.getPropertyValue("--shell-review-report-shift-hidden").trim() ||
      "100%";

    preview.style.transition = "none";
    preview.style.opacity = "1";

    const anim = preview.animate(
      [
        {
          transform: `translate(-50%, ${shown})`,
          opacity: 1,
          offset: 0,
          easing: easeLift,
        },
        {
          transform: `translate(-50%, calc(${shown} - ${liftPx}px))`,
          opacity: 1,
          offset: peak,
          easing: easeDive,
        },
        {
          transform: `translate(-50%, ${hidden})`,
          opacity: 1,
          offset: 1,
        },
      ],
      {
        duration: durationMs,
        fill: /** @type {FillMode} */ ("forwards"),
      },
    );
    previewLaunchAnim = anim;

    return anim.finished
      .catch(() => {
        /* cancelled */
      })
      .then(() => {
        if (previewLaunchAnim !== anim) return;
        previewLaunchAnim = null;
        if (typeof anim.commitStyles === "function") {
          anim.commitStyles();
        }
        anim.cancel();
        releasePreviewBrand();
        preview.style.transition = "none";
        preview.style.opacity = "";
        preview.style.transform = "";
        void preview.offsetWidth;
        preview.style.transition = "";
      });
  }

  function showPreviewStub() {
    syncCopy();
    root.classList.add("url-screen--preview");
  }

  function hidePreview() {
    if (!root.classList.contains("url-screen--preview")) return;
    void launchPreviewAway();
  }

  function schedulePreviewSync() {
    if (previewDebounceId != null) {
      window.clearTimeout(previewDebounceId);
    }
    previewDebounceId = window.setTimeout(() => {
      previewDebounceId = null;
      if (submitting || transitioning || !done.hidden) return;
      const normalized = normalizePortfolioUrl(input.value);
      if (!normalized) {
        hidePreview();
        return;
      }
      cancelPreviewLaunch();
      pendingDoneMesh = false;
      showPreviewStub();
    }, PREVIEW_DEBOUNCE_MS);
  }

  function resetFormState() {
    if (previewDebounceId != null) {
      window.clearTimeout(previewDebounceId);
      previewDebounceId = null;
    }
    cancelPreviewLaunch();
    pendingDoneMesh = false;
    transitioning = false;
    submitting = false;
    submit.disabled = false;
    root.classList.remove("url-screen--preview", "url-screen--to-done");
    clearDoneMesh();
    block.hidden = false;
    done.hidden = true;
    formPane.style.minHeight = "";
    block.style.opacity = "";
    block.style.transform = "";
    block.style.filter = "";
    done.style.opacity = "";
    done.style.transform = "";
    done.style.filter = "";
  }

  /**
   * Как review-panel showDone: leave формы → enter done; лист улетает + mesh.
   * @returns {Promise<void>}
   */
  async function showDone() {
    if (!done.hidden && block.hidden) {
      pendingDoneMesh = true;
      void launchPreviewAway();
      return;
    }

    pendingDoneMesh = true;
    void launchPreviewAway();

    if (prefersReducedMotion()) {
      block.hidden = true;
      done.hidden = false;
      root.setAttribute("aria-labelledby", "url-screen-done-title");
      return;
    }

    transitioning = true;
    const { durationMs, shiftPx, blurPx, easing } = getMotionReveal();
    const halfMs = Math.max(1, Math.round(durationMs / 2));
    const leaveTiming = {
      duration: halfMs,
      easing,
      fill: /** @type {FillMode} */ ("forwards"),
    };

    formPane.style.minHeight = `${formPane.getBoundingClientRect().height}px`;
    root.classList.add("url-screen--to-done");

    const leave = block.animate(
      [
        {
          opacity: 1,
          transform: "translateY(0)",
          filter: "blur(0px)",
        },
        {
          opacity: 0,
          transform: `translateY(${-shiftPx}px)`,
          filter: `blur(${blurPx}px)`,
        },
      ],
      leaveTiming,
    );

    try {
      await leave.finished.catch(() => undefined);
    } finally {
      leave.cancel();
      block.style.opacity = "";
      block.style.transform = "";
      block.style.filter = "";
    }

    block.hidden = true;
    done.hidden = false;
    root.setAttribute("aria-labelledby", "url-screen-done-title");

    const enter = done.animate(
      [
        {
          opacity: 0,
          transform: `translateY(${shiftPx}px)`,
          filter: `blur(${blurPx}px)`,
        },
        { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
      ],
      {
        duration: halfMs,
        easing,
        fill: /** @type {FillMode} */ ("both"),
      },
    );

    try {
      await enter.finished;
    } finally {
      if (typeof enter.commitStyles === "function") {
        enter.commitStyles();
      }
      enter.cancel();
      done.style.opacity = "";
      done.style.transform = "";
      done.style.filter = "";
      formPane.style.minHeight = "";
      root.classList.remove("url-screen--to-done");
      transitioning = false;
      /* Форма гарантированно вне потока после смены. */
      block.hidden = true;
    }
  }

  /**
   * @param {string} [prefill]
   * @param {{ handoff?: boolean }} [opts]
   */
  function open(prefill = "", opts = {}) {
    closing = false;
    resetFormState();
    syncCopy();
    openBrandScreen({
      root,
      meshWash,
      opts,
      prepare: () => {
        setError(false);
        input.value = prefill;
        syncSubmitVisibility();
        root.setAttribute("aria-labelledby", "url-screen-title");
        if (prefill) schedulePreviewSync();
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
    }).then(() => {
      resetFormState();
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (submitting || transitioning) return;

    const normalized = normalizePortfolioUrl(input.value);
    if (!normalized) {
      setError(true);
      input.focus();
      return;
    }

    setError(false);
    submitting = true;
    submit.disabled = true;
    if (previewDebounceId != null) {
      window.clearTimeout(previewDebounceId);
      previewDebounceId = null;
    }

    if (!root.classList.contains("url-screen--preview")) {
      showPreviewStub();
    }

    /* Done сразу — сеть не блокирует ощущение отправки. */
    void showDone();
    void Promise.resolve(onSubmit(normalized)).catch(() => {
      submitting = false;
      submit.disabled = false;
    });
  });

  exitBtn.addEventListener("click", () => {
    void onExit?.();
  });

  input.addEventListener("input", () => {
    if (isFieldErrorVisible(error)) setError(false);
    syncSubmitVisibility();
    if (submitting || transitioning || !done.hidden) return;
    schedulePreviewSync();
  });

  syncCopy();

  return { root, open, close };
}
