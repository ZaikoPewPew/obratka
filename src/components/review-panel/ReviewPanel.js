import { formatString, getStrings } from "../../i18n.js";
import { answersFromFormData } from "../../utils/reviewReport.js";
import {
  getMotionAdvanceDelayMs,
  getMotionReveal,
} from "../../utils/motionTokens.js";

const ADVICE_MIN_LEN = 100;
const ADVICE_MAX_LEN = 1000;

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
 * @param {HTMLFormElement} form
 * @param {string} name
 */
function hasRadioValue(form, name) {
  return Boolean(
    form.querySelector(`input[type="radio"][name="${name}"]:checked`),
  );
}

/**
 * @param {HTMLFormElement} form
 * @param {string} name
 */
function hasSliderValue(form, name) {
  const input = form.querySelector(
    `input.review-panel__slider-input[name="${name}"]`,
  );
  return (
    input instanceof HTMLInputElement && input.dataset.touched === "1"
  );
}

/** Ширина/высота viewBox делений слайдера (совпадает с токенами). */
const SLIDER_VIEW_W = 500;
const SLIDER_VIEW_H = 63;
const SLIDER_TICK_W = 4;
const SLIDER_TICK_MID_Y = 11;
const SLIDER_TICK_MID_H = 41;

/**
 * @param {number} count
 * @returns {SVGSVGElement}
 */
function createSliderTicks(count) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "review-panel__slider-ticks");
  svg.setAttribute("viewBox", `0 0 ${SLIDER_VIEW_W} ${SLIDER_VIEW_H}`);
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const span = (SLIDER_VIEW_W - SLIDER_TICK_W) / Math.max(count - 1, 1);
  for (let i = 0; i < count; i += 1) {
    const isEnd = i === 0 || i === count - 1;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(i * span));
    rect.setAttribute("y", isEnd ? "0" : String(SLIDER_TICK_MID_Y));
    rect.setAttribute("width", String(SLIDER_TICK_W));
    rect.setAttribute(
      "height",
      isEnd ? String(SLIDER_VIEW_H) : String(SLIDER_TICK_MID_H),
    );
    rect.setAttribute("fill", "currentColor");
    svg.append(rect);
  }

  return svg;
}

/**
 * @param {string} name
 * @param {string} value
 * @param {string} title
 * @param {string | null} [subtitle]
 * @param {"radio" | "checkbox"} [type]
 */
function createChoice(name, value, title, subtitle = null, type = "radio") {
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

  if (subtitle) {
    const hint = document.createElement("span");
    hint.className = "review-panel__choice-hint";
    hint.textContent = subtitle;
    copy.append(hint);
  }

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
 * @param {string} name
 * @param {number} from
 * @param {number} to
 * @param {string} [ariaLabel]
 * @param {{ low: string; high: string }} ends
 */
function createScale(name, from, to, ariaLabel, ends) {
  const count = to - from + 1;

  const block = document.createElement("div");
  block.className = "review-panel__scale-block";

  const slider = document.createElement("div");
  slider.className = "review-panel__slider";

  const ticks = createSliderTicks(count);

  const track = document.createElement("span");
  track.className = "review-panel__slider-track";
  track.setAttribute("aria-hidden", "true");

  const fill = document.createElement("span");
  fill.className = "review-panel__slider-fill";
  fill.setAttribute("aria-hidden", "true");

  const thumb = document.createElement("span");
  thumb.className = "review-panel__slider-thumb";
  thumb.setAttribute("aria-hidden", "true");

  const input = document.createElement("input");
  input.className = "review-panel__slider-input";
  input.type = "range";
  input.name = name;
  input.min = String(from);
  input.max = String(to);
  input.step = "1";
  input.value = String(from);
  input.dataset.touched = "0";
  input.autocomplete = "off";
  if (ariaLabel) {
    input.setAttribute("aria-label", ariaLabel);
  }

  let visualProgress = 0;
  let targetProgress = 0;
  let rafId = 0;
  let dragging = false;

  function readLerp(token) {
    const raw = getComputedStyle(slider).getPropertyValue(token).trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0.2;
  }

  function clampProgress(value) {
    return Math.min(1, Math.max(0, value));
  }

  function progressFromValue(value) {
    const min = Number(input.min);
    const max = Number(input.max);
    return max === min ? 0 : (value - min) / (max - min);
  }

  function valueFromProgress(progress) {
    const min = Number(input.min);
    const max = Number(input.max);
    return Math.round(min + clampProgress(progress) * (max - min));
  }

  function progressFromClientX(clientX) {
    const rect = slider.getBoundingClientRect();
    if (rect.width <= 0) return targetProgress;
    const tick = Number.parseFloat(
      getComputedStyle(slider).getPropertyValue("--shell-review-slider-tick-width"),
    );
    const tickW = Number.isFinite(tick) ? tick : 4;
    const start = tickW / 2;
    const travel = Math.max(rect.width - tickW, 1);
    return clampProgress((clientX - rect.left - start) / travel);
  }

  function applyVisual(progress) {
    slider.style.setProperty(
      "--shell-review-slider-progress",
      String(clampProgress(progress)),
    );
  }

  function tickFrame() {
    const lerp = readLerp(
      dragging
        ? "--shell-review-slider-lerp-drag"
        : "--shell-review-slider-lerp",
    );
    const diff = targetProgress - visualProgress;
    if (Math.abs(diff) < 0.0004) {
      visualProgress = targetProgress;
      applyVisual(visualProgress);
      rafId = 0;
      return;
    }
    visualProgress += diff * lerp;
    applyVisual(visualProgress);
    rafId = requestAnimationFrame(tickFrame);
  }

  function setTargetProgress(progress, { immediate = false } = {}) {
    targetProgress = clampProgress(progress);
    if (immediate) {
      visualProgress = targetProgress;
      applyVisual(visualProgress);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      return;
    }
    if (!rafId) {
      rafId = requestAnimationFrame(tickFrame);
    }
  }

  function syncFromInputValue({ immediate = false } = {}) {
    setTargetProgress(progressFromValue(Number(input.value)), { immediate });
    slider.classList.toggle(
      "review-panel__slider--touched",
      input.dataset.touched === "1",
    );
  }

  function setFromClientX(clientX) {
    const progress = progressFromClientX(clientX);
    input.dataset.touched = "1";
    input.value = String(valueFromProgress(progress));
    setTargetProgress(progress);
    slider.classList.add("review-panel__slider--touched");
  }

  function snapToValue() {
    const snapped = valueFromProgress(targetProgress);
    input.value = String(snapped);
    setTargetProgress(progressFromValue(snapped));
  }

  input.addEventListener("pointerdown", (event) => {
    dragging = true;
    slider.classList.add("review-panel__slider--dragging");
    try {
      input.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    setFromClientX(event.clientX);
  });

  input.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    setFromClientX(event.clientX);
  });

  const endPointer = () => {
    if (!dragging) return;
    dragging = false;
    slider.classList.remove("review-panel__slider--dragging");
    snapToValue();
  };

  input.addEventListener("pointerup", endPointer);
  input.addEventListener("pointercancel", endPointer);
  input.addEventListener("lostpointercapture", endPointer);

  input.addEventListener("input", () => {
    if (dragging) return;
    input.dataset.touched = "1";
    syncFromInputValue();
  });

  input.addEventListener("keydown", () => {
    // Стрелки: дождаться обновления value, затем плавно дотянуть.
    queueMicrotask(() => {
      if (dragging) return;
      input.dataset.touched = "1";
      syncFromInputValue();
    });
  });

  // Экспорт сброса визуала для clearAllSelections через dataset hook
  input.addEventListener("reset-visual", () => {
    dragging = false;
    slider.classList.remove("review-panel__slider--dragging");
    input.dataset.touched = "0";
    input.value = input.min;
    setTargetProgress(0, { immediate: true });
    slider.classList.remove("review-panel__slider--touched");
  });

  syncFromInputValue({ immediate: true });
  slider.append(track, fill, ticks, thumb, input);

  const endsRow = document.createElement("div");
  endsRow.className = "review-panel__scale-ends";

  const low = document.createElement("span");
  low.className = "review-panel__scale-end";
  low.textContent = ends.low;

  const high = document.createElement("span");
  high.className = "review-panel__scale-end review-panel__scale-end--high";
  high.textContent = ends.high;

  endsRow.append(low, high);
  block.append(slider, endsRow);
  return block;
}

/**
 * @param {...Node} controls
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
 * @param {{
 *   getPortfolioName?: () => string;
 *   onReportReveal?: (
 *     active: boolean,
 *     payload?: {
 *       answers?: import("../../utils/reviewReport.js").ReviewAnswers | null;
 *       portfolioName?: string;
 *       submitted?: boolean;
 *     },
 *   ) => void;
 *   onComplete?: (answers: Record<string, FormDataEntryValue>) => void | Promise<void>;
 *   onExit?: () => void;
 *   onNextCase?: () => void;
 *   onDoneChange?: (done: boolean) => void;
 * }} [options]
 * @returns {{
 *   root: HTMLElement;
 *   form: HTMLFormElement;
 *   open: () => void;
 *   close: () => void;
 *   reset: () => void;
 *   focus: () => void;
 *   openDone: () => void;
 * }}
 */
export function createReviewPanel(options = {}) {
  const t = getStrings();
  const getPortfolioName =
    typeof options.getPortfolioName === "function"
      ? options.getPortfolioName
      : () => getStrings().brandName;
  const onReportReveal =
    typeof options.onReportReveal === "function" ? options.onReportReveal : null;
  const onComplete =
    typeof options.onComplete === "function" ? options.onComplete : null;
  const onExit = typeof options.onExit === "function" ? options.onExit : null;
  const onNextCase =
    typeof options.onNextCase === "function" ? options.onNextCase : null;
  const onDoneChange =
    typeof options.onDoneChange === "function" ? options.onDoneChange : null;

  const root = document.createElement("div");
  root.className = "review-panel";

  const heading = document.createElement("h2");
  heading.className = "review-panel__title";
  heading.id = "review-panel-title";
  heading.textContent = t.reviewTitle;

  const top = document.createElement("div");
  top.className = "review-panel__top";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "review-panel__back";
  backBtn.setAttribute("aria-label", t.reviewBack);

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
  backLabel.textContent = t.reviewBack;

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

  const questionHint = document.createElement("p");
  questionHint.className = "review-panel__hint";
  questionHint.hidden = true;

  question.append(questionTitle, questionHint);

  const body = document.createElement("div");
  body.className = "review-panel__body";

  const gradeChoices = [
    createChoice("grade", "junior", t.reviewGradeJunior, t.reviewGradeJuniorHint),
    createChoice("grade", "mid", t.reviewGradeMid, t.reviewGradeMidHint),
    createChoice("grade", "senior", t.reviewGradeSenior, t.reviewGradeSeniorHint),
    createChoice("grade", "staff", t.reviewGradeStaff, t.reviewGradeStaffHint),
    createChoice("grade", "lead", t.reviewGradeLead, t.reviewGradeLeadHint),
    createChoice("grade", "head", t.reviewGradeHead, t.reviewGradeHeadHint),
  ].map((c) => c.label);

  const structureChoices = [
    createChoice(
      "structure",
      "mess",
      t.reviewStructureMess,
      t.reviewStructureMessHint,
    ),
    createChoice(
      "structure",
      "dump",
      t.reviewStructureDump,
      t.reviewStructureDumpHint,
    ),
    createChoice(
      "structure",
      "outline",
      t.reviewStructureOutline,
      t.reviewStructureOutlineHint,
    ),
    createChoice(
      "structure",
      "clear",
      t.reviewStructureClear,
      t.reviewStructureClearHint,
    ),
  ].map((c) => c.label);

  const metricsChoices = [
    createChoice("metrics", "none", t.reviewMetricsNone, t.reviewMetricsNoneHint),
    createChoice(
      "metrics",
      "vanity",
      t.reviewMetricsVanity,
      t.reviewMetricsVanityHint,
    ),
    createChoice(
      "metrics",
      "nominal",
      t.reviewMetricsNominal,
      t.reviewMetricsNominalHint,
    ),
    createChoice(
      "metrics",
      "solid",
      t.reviewMetricsSolid,
      t.reviewMetricsSolidHint,
    ),
    createChoice(
      "metrics",
      "strong",
      t.reviewMetricsStrong,
      t.reviewMetricsStrongHint,
    ),
  ].map((c) => c.label);

  const painItems = [
    createChoice("pain", "hierarchy", t.reviewPainHierarchy, null, "checkbox"),
    createChoice("pain", "grid", t.reviewPainGrid, null, "checkbox"),
    createChoice("pain", "overloaded", t.reviewPainOverloaded, null, "checkbox"),
    createChoice("pain", "contrast", t.reviewPainContrast, null, "checkbox"),
    createChoice("pain", "components", t.reviewPainComponents, null, "checkbox"),
    createChoice("pain", "ok", t.reviewPainOk, null, "checkbox"),
  ];

  const hireChoices = [
    createChoice("hire", "yes", t.reviewHireYes, t.reviewHireYesHint),
    createChoice("hire", "maybe", t.reviewHireMaybe, t.reviewHireMaybeHint),
    createChoice("hire", "no", t.reviewHireNo, t.reviewHireNoHint),
  ].map((c) => c.label);

  const adviceStack = document.createElement("div");
  adviceStack.className = "review-panel__options review-panel__options--advice";

  const adviceInput = document.createElement("textarea");
  adviceInput.className = "review-panel__textarea";
  adviceInput.id = "review-advice";
  adviceInput.name = "advice";
  adviceInput.rows = 4;
  adviceInput.maxLength = ADVICE_MAX_LEN;
  adviceInput.placeholder = t.reviewAdvicePlaceholder;
  adviceInput.autocomplete = "off";
  const advicePlaceholder = t.reviewAdvicePlaceholder;

  const adviceMeta = document.createElement("div");
  adviceMeta.className = "review-panel__meta";

  const adviceHint = document.createElement("span");
  adviceHint.className = "review-panel__meta-hint";
  adviceHint.textContent = t.reviewAdviceHint;

  const adviceCount = document.createElement("span");
  adviceCount.className = "review-panel__count";
  adviceCount.textContent = `0 / ${ADVICE_MAX_LEN}`;

  adviceMeta.append(adviceHint, adviceCount);
  adviceStack.append(adviceInput, adviceMeta);

  /** @type {{
   *   step: HTMLElement;
   *   title: string;
   *   hint: string | null;
   *   validate: () => boolean;
   *   autoAdvance: boolean;
   *   errorMessage?: string;
   * }[]} */
  const steps = [
    {
      step: createStep(createOptions(...gradeChoices)),
      title: t.reviewGradeLabel,
      hint: null,
      validate: () => hasRadioValue(form, "grade"),
      autoAdvance: true,
    },
    {
      step: createStep(
        createOptions(
          createScale("context", 1, 5, t.reviewContextLabel, {
            low: t.reviewContextScaleLow,
            high: t.reviewContextScaleHigh,
          }),
        ),
      ),
      title: t.reviewContextLabel,
      hint: null,
      validate: () => hasSliderValue(form, "context"),
      autoAdvance: true,
    },
    {
      step: createStep(createOptions(...structureChoices)),
      title: t.reviewStructureLabel,
      hint: null,
      validate: () => hasRadioValue(form, "structure"),
      autoAdvance: true,
    },
    {
      step: createStep(createOptions(...metricsChoices)),
      title: t.reviewMetricsLabel,
      hint: null,
      validate: () => hasRadioValue(form, "metrics"),
      autoAdvance: true,
    },
    {
      step: createStep(
        createOptions(
          createScale("visual", 1, 10, t.reviewVisualLabel, {
            low: t.reviewVisualScaleLow,
            high: t.reviewVisualScaleHigh,
          }),
        ),
      ),
      title: t.reviewVisualLabel,
      hint: null,
      validate: () => hasSliderValue(form, "visual"),
      autoAdvance: true,
    },
    {
      step: createStep(createOptions(...painItems.map((c) => c.label))),
      title: t.reviewPainLabel,
      hint: null,
      validate: () => true,
      autoAdvance: false,
    },
    {
      step: createStep(createOptions(...hireChoices)),
      title: t.reviewHireLabel,
      hint: null,
      validate: () => hasRadioValue(form, "hire"),
      autoAdvance: true,
    },
    {
      step: createStep(adviceStack),
      title: t.reviewAdviceLabel,
      hint: null,
      validate: () => adviceInput.value.trim().length >= ADVICE_MIN_LEN,
      autoAdvance: false,
      errorMessage: t.reviewAdviceTooShort,
    },
  ];

  for (const item of steps) {
    body.append(item.step);
  }

  const stage = document.createElement("div");
  stage.className = "review-panel__stage";
  stage.append(question, body);

  const stepError = document.createElement("p");
  stepError.className = "review-panel__step-error";
  stepError.hidden = true;
  stepError.textContent = t.reviewStepRequired;

  const footer = document.createElement("div");
  footer.className = "review-panel__footer";

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "iframe-shell__btn review-panel__nav review-panel__nav--next";
  nextBtn.textContent = t.reviewNext;

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "iframe-shell__btn review-panel__submit";
  submit.textContent = t.reviewSubmit;
  submit.hidden = true;

  footer.append(nextBtn, submit);
  form.append(stage, stepError, footer);

  const done = document.createElement("div");
  done.className = "review-panel__done";
  done.hidden = true;

  const doneTitle = document.createElement("h2");
  doneTitle.className = "review-panel__done-title";
  doneTitle.id = "review-done-title";
  doneTitle.textContent = t.reviewDoneTitle;

  const actions = document.createElement("div");
  actions.className = "review-panel__done-actions";

  const exitBtn = document.createElement("button");
  exitBtn.type = "button";
  exitBtn.className =
    "iframe-shell__btn review-panel__done-btn review-panel__done-btn--exit";
  exitBtn.textContent = t.reviewDoneExit;

  const nextCaseBtn = document.createElement("button");
  nextCaseBtn.type = "button";
  nextCaseBtn.className =
    "iframe-shell__btn review-panel__done-btn review-panel__done-btn--next";
  nextCaseBtn.textContent = t.reviewDoneNextCase;

  actions.append(exitBtn, nextCaseBtn);
  done.append(doneTitle, actions);
  root.append(heading, top, form, done);

  let currentStep = 0;
  let transitioning = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let advanceTimer = null;
  /** @type {Record<string, FormDataEntryValue> | null} */
  let completedAnswers = null;
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
      stepError.textContent =
        steps[currentStep]?.errorMessage ?? t.reviewStepRequired;
    }
    stepError.hidden = !visible;
  }

  function syncQuestion() {
    const item = steps[currentStep];
    questionTitle.textContent = item?.title ?? "";
    const hint = item?.hint ?? null;
    if (hint) {
      questionHint.textContent = hint;
      questionHint.hidden = false;
    } else {
      questionHint.textContent = "";
      questionHint.hidden = true;
    }
  }

  function syncProgress() {
    const current = currentStep + 1;
    progressLabel.textContent = formatString(t.reviewProgress, {
      current,
      total: totalSteps,
    });
    progress.setAttribute("aria-valuenow", String(current));
    progress.setAttribute("aria-valuemax", String(totalSteps));
    progress.setAttribute(
      "aria-valuetext",
      formatString(t.reviewProgress, { current, total: totalSteps }),
    );
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
    syncQuestion();
    syncProgress();
    syncReportReveal();
  }

  function syncReportReveal() {
    const onAdvice =
      done.hidden && !form.hidden && currentStep === totalSteps - 1;

    if (!onAdvice) {
      onReportReveal?.(false);
      return;
    }

    const answers = answersFromFormData(new FormData(form));
    onReportReveal?.(true, {
      answers,
      portfolioName: getPortfolioName(),
    });
  }

  function showForm() {
    form.hidden = false;
    top.hidden = false;
    done.hidden = true;
    root.classList.remove("review-panel--to-done");
    root.style.minHeight = "";
    form.style.opacity = "";
    form.style.transform = "";
    form.style.filter = "";
    top.style.opacity = "";
    top.style.transform = "";
    top.style.filter = "";
    done.style.opacity = "";
    done.style.transform = "";
    done.style.filter = "";
    onReportReveal?.(false);
    onDoneChange?.(false);
  }

  /**
   * Финальный вопрос → done слева; PDF-лист уезжает вниз справа.
   * Form/top уходят на --motion-reveal-*, done входит тем же языком.
   * @param {Record<string, FormDataEntryValue> | null} [answers]
   * @returns {Promise<void>}
   */
  async function showDone(answers = null) {
    clearAdvanceTimer();

    if (!done.hidden && form.hidden) {
      onReportReveal?.(false, { submitted: true });
      onDoneChange?.(true);
      return;
    }

    if (answers) {
      completedAnswers = answers;
      void onComplete?.(answers);
    }

    onReportReveal?.(false, { submitted: true });
    onDoneChange?.(true);

    if (prefersReducedMotion()) {
      form.hidden = true;
      top.hidden = true;
      done.hidden = false;
      form.classList.remove("review-panel__form--advice");
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

    /* Фиксируем высоту панели, чтобы не схлопнулась между leave и enter */
    root.style.minHeight = `${root.getBoundingClientRect().height}px`;
    root.classList.add("review-panel--to-done");

    const leaveTargets = [top, form].filter((el) => !el.hidden);
    const leaveAnims = leaveTargets.map((el) =>
      el.animate(
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
      ),
    );

    try {
      await Promise.all(
        leaveAnims.map((anim) => anim.finished.catch(() => undefined)),
      );
    } finally {
      for (const anim of leaveAnims) {
        anim.cancel();
      }
      for (const el of leaveTargets) {
        el.style.opacity = "";
        el.style.transform = "";
        el.style.filter = "";
      }
    }

    form.hidden = true;
    top.hidden = true;
    done.hidden = false;
    form.classList.remove("review-panel__form--advice");

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
      root.style.minHeight = "";
      root.classList.remove("review-panel--to-done");
      transitioning = false;
    }
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
   * Смена шага: `review-panel__stage` + footer (Продолжить) одной пачкой.
   * @param {1 | -1} direction
   * @param {() => void} apply
   * @returns {Promise<void>}
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
   * @returns {Promise<void>}
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
        item.step.classList.remove("review-panel__step--leaving");
        item.step.style.opacity = "";
        item.step.style.transform = "";
        item.step.style.filter = "";
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
      applyStep();
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
    const focusable = active?.querySelector(
      "input:not([disabled]), textarea, button",
    );
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

  function syncPainExclusive() {
    const okItem = painItems.find((item) => item.input.value === "ok");
    const otherItems = painItems.filter((item) => item.input.value !== "ok");
    const okChecked = Boolean(okItem?.input.checked);

    for (const item of otherItems) {
      if (okChecked) {
        item.input.checked = false;
        item.input.disabled = true;
        item.label.classList.add("review-panel__choice--disabled");
      } else {
        item.input.disabled = false;
        item.label.classList.remove("review-panel__choice--disabled");
      }
    }

    if (okItem) {
      okItem.input.disabled = false;
      okItem.label.classList.remove("review-panel__choice--disabled");
    }
  }

  function onPainChange(changed) {
    if (changed.input.value === "ok" && changed.input.checked) {
      for (const item of painItems) {
        if (item.input.value !== "ok") {
          item.input.checked = false;
        }
      }
    } else if (changed.input.value !== "ok" && changed.input.checked) {
      const okItem = painItems.find((item) => item.input.value === "ok");
      if (okItem) okItem.input.checked = false;
    }
    syncPainExclusive();
  }

  function clearAllSelections() {
    for (const input of form.querySelectorAll(
      "input[type='radio'], input[type='checkbox']",
    )) {
      if (input instanceof HTMLInputElement) {
        input.checked = false;
        input.disabled = false;
      }
    }
    for (const input of form.querySelectorAll(
      "input.review-panel__slider-input",
    )) {
      if (!(input instanceof HTMLInputElement)) continue;
      input.dispatchEvent(new Event("reset-visual"));
    }
    for (const item of painItems) {
      item.label.classList.remove("review-panel__choice--disabled");
    }
    syncPainExclusive();
  }

  for (const item of painItems) {
    item.input.addEventListener("change", () => onPainChange(item));
  }

  adviceInput.addEventListener("focus", () => {
    adviceInput.placeholder = "";
  });

  adviceInput.addEventListener("blur", () => {
    if (!adviceInput.value.trim()) {
      adviceInput.placeholder = advicePlaceholder;
    }
  });

  adviceInput.addEventListener("input", () => {
    adviceCount.textContent = `${adviceInput.value.length} / ${ADVICE_MAX_LEN}`;
    if (!stepError.hidden) showStepError(false);
    if (currentStep === totalSteps - 1) {
      syncReportReveal();
    }
  });

  form.addEventListener("change", () => {
    if (!stepError.hidden) showStepError(false);
  });

  // click, а не только change: повторный тап по уже выбранному radio тоже ведёт дальше.
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

  // Слайдер: фиксация значения по pointerup / change (клавиатура).
  function commitSlider(input) {
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.classList.contains("review-panel__slider-input")) return;
    input.dataset.touched = "1";
    const slider = input.closest(".review-panel__slider");
    if (slider instanceof HTMLElement) {
      slider.classList.add("review-panel__slider--touched");
    }
    if (!steps[currentStep]?.autoAdvance) return;
    if (!steps[currentStep]?.validate()) return;
    scheduleAutoAdvance();
  }

  form.addEventListener("pointerup", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    commitSlider(target);
  });

  form.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains("review-panel__slider-input")) return;
    commitSlider(target);
  });

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

    const answers = answersFromFormData(new FormData(form));
    if (!answers) {
      showStepError(true);
      focusActiveStep();
      return;
    }

    void showDone(answers);
  });

  exitBtn.addEventListener("click", () => {
    onExit?.();
  });

  nextCaseBtn.addEventListener("click", () => {
    onNextCase?.();
  });

  function reset() {
    clearAdvanceTimer();
    transitioning = false;
    body.classList.remove("review-panel__body--animating");
    root.classList.remove("review-panel--to-done");
    root.style.minHeight = "";
    footer.style.animation = "";
    completedAnswers = null;
    form.reset();
    clearAllSelections();
    adviceInput.value = "";
    adviceCount.textContent = `0 / ${ADVICE_MAX_LEN}`;
    currentStep = 0;
    showForm();
    renderStep();
  }

  function open() {
    root.removeAttribute("hidden");
    renderStep();
  }

  function close() {
    clearAdvanceTimer();
    root.setAttribute("hidden", "");
  }

  function focus() {
    if (!done.hidden) {
      return;
    }
    focusActiveStep();
  }

  renderStep();

  return {
    root,
    form,
    open,
    close,
    reset,
    focus,
    openDone: () => {
      void showDone(completedAnswers);
    },
  };
}
