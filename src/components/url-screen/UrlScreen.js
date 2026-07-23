import { getStrings } from "../../i18n.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import { normalizePortfolioUrl } from "../../utils/portfolioMeta.js";
import { resolvePlatformIcon } from "../../utils/platformBrandIcon.js";
import {
  getMotionReveal,
  getReportLaunchMotion,
  getReviewMeshDoneMotion,
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
  error.textContent = t.urlModalInvalid;

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

  const visual = document.createElement("div");
  visual.className = "url-screen__visual";
  visual.setAttribute("aria-hidden", "true");

  const glow = document.createElement("div");
  glow.className = "url-screen__glow";

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

  const noise = document.createElement("span");
  noise.className = "url-screen__noise";

  const brand = document.createElement("div");
  brand.className = "url-screen__brand";

  const brandSlot = document.createElement("div");
  brandSlot.className = "url-screen__brand-slot";
  brandSlot.innerHTML = `
    <svg class="url-screen__brand-mark" width="44" height="30" viewBox="0 0 44 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14.6249 30C11.6748 30 9.10235 29.4585 6.90772 28.3755C4.71308 27.2924 3.00414 25.7762 1.7809 23.8267C0.593632 21.8773 0 19.5848 0 16.9495C0 13.7004 0.755531 10.8123 2.26659 8.2852C3.77766 5.72202 5.84637 3.70036 8.47274 2.22022C11.1351 0.740072 14.1572 0 17.5391 0C20.5253 0 23.0977 0.541516 25.2563 1.62455C27.451 2.70758 29.1419 4.22383 30.3292 6.17328C31.5524 8.08664 32.1641 10.3791 32.1641 13.0505C32.1641 16.2635 31.4085 19.1516 29.8975 21.7148C28.3864 24.278 26.3177 26.2996 23.6913 27.7798C21.0649 29.2599 18.0428 30 14.6249 30ZM15.1646 23.0686C16.8196 23.0686 18.2767 22.6715 19.5359 21.8773C20.8311 21.0469 21.8385 19.9097 22.558 18.4657C23.2776 17.0217 23.6373 15.343 23.6373 13.4296C23.6373 11.4801 23.0617 9.90975 21.9104 8.71841C20.7591 7.52708 19.1401 6.93141 17.0534 6.93141C15.3984 6.93141 13.9234 7.34657 12.6282 8.1769C11.3689 8.97112 10.3616 10.0903 9.60604 11.5343C8.88649 12.9783 8.52671 14.657 8.52671 16.5704C8.52671 18.556 9.10235 20.1444 10.2536 21.3357C11.4049 22.491 13.0419 23.0686 15.1646 23.0686Z" fill="white"/>
      <path d="M38.4415 30C37.0023 30 35.8151 29.5487 34.8797 28.6462C33.9442 27.7076 33.4765 26.5343 33.4765 25.1264C33.4765 23.4296 34.0162 22.0758 35.0955 21.065C36.2108 20.0181 37.542 19.4946 39.089 19.4946C40.5282 19.4946 41.6974 19.9458 42.5969 20.8484C43.5323 21.7509 44 22.9242 44 24.3682C44 25.4874 43.7302 26.4801 43.1905 27.3466C42.6868 28.1769 42.0212 28.8267 41.1937 29.296C40.3663 29.7653 39.4488 30 38.4415 30Z" fill="white"/>
    </svg>
  `;
  brand.append(brandSlot);

  visual.append(glow, noise, preview, brand);
  const meshWash = mountMeshGradientWash(glow);
  meshWash.setActive(false);

  layout.append(formPane, visual);
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
    error.textContent = strings.urlModalInvalid;
    platformsText.textContent = strings.urlScreenPlatforms;
    stubTitle.textContent = strings.urlPreviewStubTitle;
    doneTitle.textContent = strings.successPortfolioTitle;
    exitBtn.textContent = strings.reviewDoneExit;
  }

  function setError(visible) {
    error.hidden = !visible;
    input.setAttribute("aria-invalid", visible ? "true" : "false");
  }

  function syncSubmitVisibility() {
    const hasValue = input.value.trim().length > 0;
    submit.hidden = !hasValue;
    inputWrap.classList.toggle("url-screen__input-wrap--ready", hasValue);
  }

  function clearDoneMesh() {
    pendingDoneMesh = false;
    root.classList.remove("url-screen--done");
    meshWash.refresh();
  }

  function activateDoneMesh() {
    if (root.classList.contains("url-screen--done")) return;
    root.classList.add("url-screen--done");
    const { durationMs, easing } = getReviewMeshDoneMotion();
    meshWash.transitionToCssColors({ durationMs, easing });
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

    void (async () => {
      try {
        await Promise.resolve(onSubmit(normalized));
        await showDone();
      } catch {
        submitting = false;
        submit.disabled = false;
      }
    })();
  });

  exitBtn.addEventListener("click", () => {
    void onExit?.();
  });

  input.addEventListener("input", () => {
    if (!error.hidden) setError(false);
    syncSubmitVisibility();
    if (submitting || transitioning || !done.hidden) return;
    schedulePreviewSync();
  });

  syncCopy();

  return { root, open, close };
}
