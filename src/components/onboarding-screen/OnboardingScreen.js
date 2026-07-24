import { formatString, getStrings } from "../../i18n.js";
import { brandMarkSvg } from "../../assets/brand/brandMarks.js";
import onboardingContent from "../../../content/onboarding.json";
import { saveOnboardingAnswers } from "../../api/onboarding.js";
import {
  getMotionAdvanceDelayMs,
  getMotionReveal,
} from "../../utils/motionTokens.js";
import { createBrandScreenShell } from "../brand-screen-shell/BrandScreenShell.js";

const CHECKBOX_IDLE_PATH =
  "M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V6Z";
const CHECKBOX_CHECKED_PATH =
  "M21 5L12 14L9 11M16 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V12";

/**
 * @param {string} d
 * @returns {SVGSVGElement}
 */
function createCheckboxIcon(d) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "review-panel__check-icon");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.3");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

/**
 * @param {string} name
 * @param {string} value
 * @param {string} title
 * @param {"radio" | "checkbox"} [type]
 */
function createChoice(name, value, title, type = "radio") {
  const label = document.createElement("label");
  label.className = "review-panel__choice";
  if (type === "checkbox") {
    label.classList.add("review-panel__choice--check");
  }

  const input = document.createElement("input");
  input.className = "review-panel__choice-input";
  input.type = type;
  input.name = name;
  input.value = value;
  input.autocomplete = "off";

  const copy = document.createElement("span");
  copy.className = "review-panel__choice-copy";

  const text = document.createElement("span");
  text.className = "review-panel__choice-text";
  text.textContent = title;
  copy.append(text);

  if (type === "checkbox") {
    const mark = document.createElement("span");
    mark.className = "review-panel__check";
    mark.setAttribute("aria-hidden", "true");
    const idle = createCheckboxIcon(CHECKBOX_IDLE_PATH);
    idle.classList.add("review-panel__check-icon--idle");
    const checked = createCheckboxIcon(CHECKBOX_CHECKED_PATH);
    checked.classList.add("review-panel__check-icon--checked");
    mark.append(idle, checked);
    label.append(input, copy, mark);
  } else {
    label.append(input, copy);
  }

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

/**
 * @param {HTMLFormElement} form
 * @param {string} name
 */
function hasCheckboxValue(form, name) {
  return new FormData(form).getAll(name).some((value) => typeof value === "string" && value);
}

/**
 * @param {unknown} type
 * @returns {"single" | "multi"}
 */
function normalizeStepType(type) {
  return type === "multi" ? "multi" : "single";
}

const BRAND_MARK_SVG = brandMarkSvg("url-screen__brand-mark");


/**
 * Онбординг: те же паттерны, что у review-panel (choice / top / progress / footer).
 *
 * @param {{
 *   onComplete: (answers: Record<string, string | string[]>) => void | Promise<void>;
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
   *   type: "single" | "multi";
   *   title: string;
   *   validate: () => boolean;
   *   autoAdvance: boolean;
   * }[]} */
  const steps = contentSteps.map((stepDef, index) => {
    const fieldName = String(stepDef.id);
    const stepType = normalizeStepType(stepDef.type);
    const inputType = stepType === "multi" ? "checkbox" : "radio";
    const options = Array.isArray(stepDef.options) ? stepDef.options : [];
    const choices = options.map((opt) =>
      createChoice(
        fieldName,
        String(opt.value),
        t[opt.labelKey] ?? String(opt.value),
        inputType,
      ),
    );
    const isLast = index === contentSteps.length - 1;
    const required = stepDef.required !== false;
    return {
      step: createStep(createOptions(...choices.map((c) => c.label))),
      fieldName,
      type: stepType,
      title: t[stepDef.labelKey] ?? t.onboardingTitle,
      validate: () => {
        if (!required) return true;
        return stepType === "multi"
          ? hasCheckboxValue(form, fieldName)
          : hasRadioValue(form, fieldName);
      },
      autoAdvance: stepType === "single" && !isLast,
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
   * Смена шага: `review-panel__stage` + footer одной пачкой.
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

    /**
     * @param {HTMLElement[]} targets
     * @param {Keyframe[]} keyframes
     */
    async function runPack(targets, keyframes) {
      if (targets.length === 0) return;
      const anims = targets.map((el) => el.animate(keyframes, timing));
      await Promise.all(
        anims.map((anim) => anim.finished.catch(() => undefined)),
      );
      for (const anim of anims) {
        anim.cancel();
      }
      for (const el of targets) {
        el.style.opacity = "";
        el.style.transform = "";
        el.style.filter = "";
      }
    }

    const leaveTargets = [stage];
    if (!footer.hidden) {
      leaveTargets.push(footer);
    }

    await runPack(leaveTargets, [
      { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
      {
        opacity: 0,
        transform: `translateY(${leaveY}px)`,
        filter: `blur(${blurPx}px)`,
      },
    ]);

    apply();

    const enterTargets = [stage];
    if (!footer.hidden) {
      /* Не дать CSS motion-reveal с --open перезапуститься поверх WAAPI. */
      footer.style.animation = "none";
      enterTargets.push(footer);
    }

    await runPack(enterTargets, [
      {
        opacity: 0,
        transform: `translateY(${enterY}px)`,
        filter: `blur(${blurPx}px)`,
      },
      { opacity: 1, transform: "translateY(0)", filter: "blur(0px)" },
    ]);
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
    /** @type {Record<string, string | string[]>} */
    const answers = {};
    const data = new FormData(form);
    for (const step of steps) {
      if (step.type === "multi") {
        const values = data
          .getAll(step.fieldName)
          .filter((value) => typeof value === "string" && value);
        if (values.length > 0) {
          answers[step.fieldName] = /** @type {string[]} */ (values);
        }
        continue;
      }
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
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[onboarding] saveOnboardingAnswers failed", err);
      }
    }
    await onComplete(answers);
  }

  function reset() {
    clearAdvanceTimer();
    transitioning = false;
    body.classList.remove("review-panel__body--animating");
    footer.style.animation = "";
    form.reset();
    for (const input of form.querySelectorAll(
      'input[type="radio"], input[type="checkbox"]',
    )) {
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
