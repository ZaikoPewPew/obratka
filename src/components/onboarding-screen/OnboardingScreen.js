import { formatString, getStrings } from "../../i18n.js";
import onboardingContent from "../../../content/onboarding.json";
import { saveOnboardingAnswers } from "../../api/onboarding.js";
import {
  getMotionAdvanceDelayMs,
  getMotionReveal,
} from "../../utils/motionTokens.js";
import { createBrandScreenShell } from "../brand-screen-shell/BrandScreenShell.js";

/**
 * @param {string} name
 * @param {string} value
 * @param {string} title
 */
function createChoice(name, value, title) {
  const label = document.createElement("label");
  label.className = "review-panel__choice";

  const input = document.createElement("input");
  input.className = "review-panel__choice-input";
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.autocomplete = "off";

  const copy = document.createElement("span");
  copy.className = "review-panel__choice-copy";

  const text = document.createElement("span");
  text.className = "review-panel__choice-text";
  text.textContent = title;
  copy.append(text);

  label.append(input, copy);
  return { label, input };
}

/**
 * @param {...HTMLElement} controls
 * @returns {HTMLElement}
 */
function createOptions(...controls) {
  const stack = document.createElement("div");
  stack.className = "review-panel__options";
  stack.append(...controls);
  return stack;
}

/**
 * @param {HTMLElement} content
 * @returns {HTMLElement}
 */
function createStep(content) {
  const step = document.createElement("section");
  step.className = "review-panel__step";
  step.hidden = true;
  step.setAttribute("aria-hidden", "true");
  step.append(content);
  return step;
}

/**
 * @param {HTMLFormElement} form
 * @param {string} name
 */
function hasRadioValue(form, name) {
  return Boolean(new FormData(form).get(name));
}

const BRAND_MARK_SVG = `
<svg class="url-screen__brand-mark" width="44" height="30" viewBox="0 0 44 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M14.6249 30C11.6748 30 9.10235 29.4585 6.90772 28.3755C4.71308 27.2924 3.00414 25.7762 1.7809 23.8267C0.593632 21.8773 0 19.5848 0 16.9495C0 13.7004 0.755531 10.8123 2.26659 8.2852C3.77766 5.72202 5.84637 3.70036 8.47274 2.22022C11.1351 0.740072 14.1572 0 17.5391 0C20.5253 0 23.0977 0.541516 25.2563 1.62455C27.451 2.70758 29.1419 4.22383 30.3292 6.17328C31.5524 8.08664 32.1641 10.3791 32.1641 13.0505C32.1641 16.2635 31.4085 19.1516 29.8975 21.7148C28.3864 24.278 26.3177 26.2996 23.6913 27.7798C21.0649 29.2599 18.0428 30 14.6249 30ZM15.1646 23.0686C16.8196 23.0686 18.2767 22.6715 19.5359 21.8773C20.8311 21.0469 21.8385 19.9097 22.558 18.4657C23.2776 17.0217 23.6373 15.343 23.6373 13.4296C23.6373 11.4801 23.0617 9.90975 21.9104 8.71841C20.7591 7.52708 19.1401 6.93141 17.0534 6.93141C15.3984 6.93141 13.9234 7.34657 12.6282 8.1769C11.3689 8.97112 10.3616 10.0903 9.60604 11.5343C8.88649 12.9783 8.52671 14.657 8.52671 16.5704C8.52671 18.556 9.10235 20.1444 10.2536 21.3357C11.4049 22.491 13.0419 23.0686 15.1646 23.0686Z" fill="white"/>
  <path d="M38.4415 30C37.0023 30 35.8151 29.5487 34.8797 28.6462C33.9442 27.7076 33.4765 26.5343 33.4765 25.1264C33.4765 23.4296 34.0162 22.0758 35.0955 21.065C36.2108 20.0181 37.542 19.4946 39.089 19.4946C40.5282 19.4946 41.6974 19.9458 42.5969 20.8484C43.5323 21.7509 44 22.9242 44 24.3682C44 25.4874 43.7302 26.4801 43.1905 27.3466C42.6868 28.1769 42.0212 28.8267 41.1937 29.296C40.3663 29.7653 39.4488 30 38.4415 30Z" fill="white"/>
</svg>
`;

/**
 * Онбординг: те же паттерны, что у review-panel (choice / top / progress / footer).
 *
 * @param {{
 *   onComplete: (answers: Record<string, string>) => void | Promise<void>;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: (opts?: { handoff?: boolean }) => void;
 *   close: (opts?: { handoff?: boolean }) => Promise<void>;
 * }}
 */
export function createOnboardingScreen({ onComplete }) {
  const t = getStrings();
  const contentSteps = Array.isArray(onboardingContent?.steps)
    ? onboardingContent.steps
    : [];

  const panel = document.createElement("div");
  panel.className = "review-panel";

  const heading = document.createElement("h2");
  heading.className = "review-panel__title";
  heading.id = "onboarding-screen-title";
  heading.textContent = t.onboardingTitle;

  const top = document.createElement("div");
  top.className = "review-panel__top";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "review-panel__back";
  backBtn.setAttribute("aria-label", t.onboardingBack);

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
  backLabel.textContent = t.onboardingBack;

  backBtn.append(backIcon, backLabel);

  const progress = document.createElement("div");
  progress.className = "review-panel__progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-valuemin", "1");

  const progressLabel = document.createElement("span");
  progressLabel.className = "review-panel__progress-label";
  progress.append(progressLabel);
  top.append(backBtn, progress);

  const form = document.createElement("form");
  form.className = "review-panel__form";
  form.noValidate = true;
  form.autocomplete = "off";

  const question = document.createElement("div");
  question.className = "review-panel__question";

  const questionTitle = document.createElement("p");
  questionTitle.className = "review-panel__label";
  question.append(questionTitle);

  const body = document.createElement("div");
  body.className = "review-panel__body";

  /** @type {{
   *   step: HTMLElement;
   *   fieldName: string;
   *   title: string;
   *   validate: () => boolean;
   *   autoAdvance: boolean;
   * }[]} */
  const steps = contentSteps.map((stepDef, index) => {
    const fieldName = String(stepDef.id);
    const options = Array.isArray(stepDef.options) ? stepDef.options : [];
    const choices = options.map((opt) =>
      createChoice(
        fieldName,
        String(opt.value),
        t[opt.labelKey] ?? String(opt.value),
      ),
    );
    const isLast = index === contentSteps.length - 1;
    return {
      step: createStep(createOptions(...choices.map((c) => c.label))),
      fieldName,
      title: t[stepDef.labelKey] ?? t.onboardingTitle,
      validate: () => hasRadioValue(form, fieldName),
      autoAdvance: !isLast,
    };
  });

  for (const item of steps) {
    body.append(item.step);
  }

  const stage = document.createElement("div");
  stage.className = "review-panel__stage";
  stage.append(question, body);

  const stepError = document.createElement("p");
  stepError.className = "review-panel__step-error";
  stepError.hidden = true;
  stepError.textContent = t.onboardingStepRequired;

  const footer = document.createElement("div");
  footer.className = "review-panel__footer";

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "iframe-shell__btn review-panel__nav review-panel__nav--next";
  nextBtn.textContent = t.onboardingNext;

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "iframe-shell__btn review-panel__submit";
  submit.textContent = t.onboardingFinish;
  submit.hidden = true;

  footer.append(nextBtn, submit);
  form.append(stage, stepError, footer);
  panel.append(heading, top, form);

  const shell = createBrandScreenShell({
    labelledById: "onboarding-screen-title",
    content: panel,
    rootClassName: "url-screen",
  });
  shell.root.classList.add("onboarding-screen");

  const brandSlot = shell.getVisualRoot().querySelector(".url-screen__brand");
  if (brandSlot) {
    brandSlot.innerHTML = BRAND_MARK_SVG;
    delete brandSlot.dataset.brandMark;
  }

  let currentStep = 0;
  let transitioning = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let advanceTimer = null;
  const totalSteps = steps.length;
  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clearAdvanceTimer() {
    if (advanceTimer !== null) {
      window.clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function showStepError(visible) {
    if (visible) {
      stepError.textContent = t.onboardingStepRequired;
    }
    stepError.hidden = !visible;
  }

  function syncChrome() {
    const isFirst = currentStep === 0;
    const isLast = currentStep === totalSteps - 1;
    const auto = Boolean(steps[currentStep]?.autoAdvance);

    backBtn.hidden = isFirst;
    top.classList.toggle("review-panel__top--first", isFirst);
    nextBtn.hidden = isLast || auto;
    submit.hidden = !isLast;
    footer.hidden = isLast ? false : auto;
    form.classList.toggle("review-panel__form--advice", isLast);
    showStepError(false);

    questionTitle.textContent = steps[currentStep]?.title ?? t.onboardingTitle;

    const current = currentStep + 1;
    progressLabel.textContent = formatString(t.onboardingProgress, {
      current,
      total: totalSteps,
    });
    progress.setAttribute("aria-valuenow", String(current));
    progress.setAttribute("aria-valuemax", String(totalSteps));
    progress.setAttribute(
      "aria-valuetext",
      formatString(t.onboardingProgress, { current, total: totalSteps }),
    );
  }

  /**
   * @param {HTMLElement} el
   * @param {boolean} active
   */
  function setStepActive(el, active) {
    el.hidden = !active;
    el.setAttribute("aria-hidden", active ? "false" : "true");
    el.classList.toggle("review-panel__step--active", active);
    el.style.opacity = "";
    el.style.transform = "";
  }

  /**
   * Смена шага: весь `review-panel__stage` целиком (вопрос + варианты).
   * @param {1 | -1} direction
   * @param {() => void} apply
   */
  async function animateStageChange(direction, apply) {
    const { durationMs, shiftPx, blurPx, easing } = getMotionReveal();
    const leaveY = direction > 0 ? -shiftPx : shiftPx;
    const enterY = direction > 0 ? shiftPx : -shiftPx;
    const halfMs = Math.max(1, Math.round(durationMs / 2));
    const timing = {
      duration: halfMs,
      easing,
      fill: /** @type {FillMode} */ ("forwards"),
    };

    const leave = stage.animate(
      [
        { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
        {
          opacity: 0,
          transform: `translateY(${leaveY}px)`,
          filter: `blur(${blurPx}px)`,
        },
      ],
      timing,
    );
    await leave.finished.catch(() => undefined);
    leave.cancel();

    apply();

    const enter = stage.animate(
      [
        {
          opacity: 0,
          transform: `translateY(${enterY}px)`,
          filter: `blur(${blurPx}px)`,
        },
        { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
      ],
      timing,
    );
    await enter.finished.catch(() => undefined);
    enter.cancel();
    stage.style.opacity = "";
    stage.style.transform = "";
    stage.style.filter = "";
  }

  /**
   * @param {number} nextIndex
   * @param {{ animate?: boolean; direction?: 1 | -1 }} [opts]
   */
  async function goToStep(nextIndex, opts = {}) {
    const animate = opts.animate !== false && !prefersReducedMotion();
    const direction = opts.direction ?? (nextIndex >= currentStep ? 1 : -1);
    const to = steps[nextIndex]?.step;
    if (!to || nextIndex === currentStep) {
      syncChrome();
      return;
    }

    clearAdvanceTimer();
    const prevIndex = currentStep;
    currentStep = nextIndex;

    const applyStep = () => {
      steps.forEach((item, index) => {
        setStepActive(item.step, index === currentStep);
      });
      syncChrome();
    };

    if (!animate || prevIndex === nextIndex) {
      applyStep();
      return;
    }

    transitioning = true;
    body.classList.add("review-panel__body--animating");
    try {
      await animateStageChange(direction, applyStep);
    } finally {
      body.classList.remove("review-panel__body--animating");
      transitioning = false;
    }
  }

  function renderStep() {
    steps.forEach((item, index) => {
      item.step.classList.remove("review-panel__step--leaving");
      setStepActive(item.step, index === currentStep);
    });
    syncChrome();
  }

  function focusActiveStep() {
    const active = steps[currentStep]?.step;
    const focusable = active?.querySelector("input:not([disabled])");
    if (focusable instanceof HTMLElement) {
      focusable.focus({ preventScroll: true });
    }
  }

  async function goNext({ force = false } = {}) {
    if (transitioning) return;
    const current = steps[currentStep];
    if (!force && !current?.validate()) {
      showStepError(true);
      focusActiveStep();
      return;
    }
    if (currentStep < totalSteps - 1) {
      await goToStep(currentStep + 1, { direction: 1 });
      focusActiveStep();
    }
  }

  function scheduleAutoAdvance() {
    clearAdvanceTimer();
    advanceTimer = window.setTimeout(() => {
      advanceTimer = null;
      void goNext({ force: true });
    }, getMotionAdvanceDelayMs());
  }

  async function goBack() {
    if (transitioning) return;
    clearAdvanceTimer();
    if (currentStep > 0) {
      await goToStep(currentStep - 1, { direction: -1 });
      focusActiveStep();
    }
  }

  function collectAnswers() {
    /** @type {Record<string, string>} */
    const answers = {};
    const data = new FormData(form);
    for (const step of steps) {
      const value = data.get(step.fieldName);
      if (typeof value === "string" && value) {
        answers[step.fieldName] = value;
      }
    }
    return answers;
  }

  async function finish() {
    const answers = collectAnswers();
    try {
      await saveOnboardingAnswers(answers);
    } catch {
      /* stub */
    }
    await onComplete(answers);
  }

  function reset() {
    clearAdvanceTimer();
    transitioning = false;
    body.classList.remove("review-panel__body--animating");
    form.reset();
    for (const input of form.querySelectorAll('input[type="radio"]')) {
      if (input instanceof HTMLInputElement) {
        input.checked = false;
      }
    }
    currentStep = 0;
    renderStep();
  }

  nextBtn.addEventListener("click", () => {
    void goNext();
  });
  backBtn.addEventListener("click", () => {
    void goBack();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (transitioning) return;
    if (!steps[currentStep]?.validate()) {
      showStepError(true);
      focusActiveStep();
      return;
    }
    void finish();
  });

  form.addEventListener("change", () => {
    if (!stepError.hidden) showStepError(false);
  });

  form.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const label = target.closest("label.review-panel__choice");
    if (!label) return;
    const input = label.querySelector('input[type="radio"]');
    if (!(input instanceof HTMLInputElement) || input.disabled) return;
    if (!steps[currentStep]?.autoAdvance) return;

    queueMicrotask(() => {
      if (!input.checked) return;
      if (!steps[currentStep]?.validate()) return;
      scheduleAutoAdvance();
    });
  });

  function open(opts = {}) {
    reset();
    shell.open(opts);
  }

  /**
   * @param {{ handoff?: boolean }} [opts]
   * @returns {Promise<void>}
   */
  function close(opts = {}) {
    clearAdvanceTimer();
    return shell.close(opts);
  }

  return {
    root: shell.root,
    open,
    close,
  };
}
