import { formatString, getStrings } from "../../i18n.js";
import { answersFromFormData } from "../../utils/reviewReport.js";
import {
  getMotionAdvanceDelayMs,
  getMotionReveal,
} from "../../utils/motionTokens.js";
import { createScaleSlider } from "../scale-slider/ScaleSlider.js";

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

const MIC_PATH =
  "M4.5 8.25C4.5 10.7353 6.51472 12.75 9 12.75M9 12.75C11.4853 12.75 13.5 10.7353 13.5 8.25M9 12.75V15M9 9.75C8.17157 9.75 7.5 9.07843 7.5 8.25V3.75C7.5 2.92157 8.17157 2.25 9 2.25C9.82843 2.25 10.5 2.92157 10.5 3.75V8.25C10.5 9.07843 9.82843 9.75 9 9.75Z";

/**
 * Спиннер CTA — тот же язык, что loader провайдеров на `/registration`.
 * @returns {SVGSVGElement}
 */
function createDoneLoader() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "review-panel__done-loader");
  svg.setAttribute("width", "28");
  svg.setAttribute("height", "28");
  svg.setAttribute("viewBox", "0 0 28 28");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  const track = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  track.setAttribute("class", "review-panel__done-loader-track");
  track.setAttribute("cx", "14");
  track.setAttribute("cy", "14");
  track.setAttribute("r", "11");
  const arc = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arc.setAttribute("class", "review-panel__done-loader-arc");
  arc.setAttribute("d", "M25 14a11 11 0 0 0-11-11");
  arc.setAttribute("stroke-linecap", "round");
  svg.append(track, arc);
  return svg;
}

/**
 * @returns {SVGSVGElement}
 */
function createMicIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "review-panel__rec-mic");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", MIC_PATH);
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.3");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

/**
 * @returns {SVGSVGElement}
 */
function createRecDot() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "review-panel__rec-dot");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "10");
  svg.setAttribute("viewBox", "0 0 10 10");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  const circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  circle.setAttribute("cx", "5");
  circle.setAttribute("cy", "5");
  circle.setAttribute("r", "5");
  circle.setAttribute("fill", "currentColor");
  svg.append(circle);
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
 *   onDictationToggle?: () => void;
 * }} [options]
 * @returns {{
 *   root: HTMLElement;
 *   form: HTMLFormElement;
 *   open: () => void;
 *   close: () => void;
 *   reset: () => void;
 *   focus: () => void;
 *   openDone: () => void;
 *   setDictationSupported: (supported: boolean) => void;
 *   setDictationRecording: (recording: boolean) => void;
 *   setDictationTranscript: (text: string) => void;
 *   setAdviceText: (text: string) => void;
 *   setNextCaseBusy: (busy: boolean) => void;
 *   setNextCasePreparing: (preparing: boolean) => void;
 *   setNextCaseEmpty: (empty: boolean) => void;
 *   setNextCaseVisible: (visible: boolean) => void;
 *   setExitBusy: (busy: boolean) => void;
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
  const onDictationToggle =
    typeof options.onDictationToggle === "function"
      ? options.onDictationToggle
      : null;

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
    createChoice(
      "pain",
      "composition",
      t.reviewPainComposition,
      null,
      "checkbox",
    ),
    createChoice("pain", "contrast", t.reviewPainContrast, null, "checkbox"),
    createChoice(
      "pain",
      "components",
      t.reviewPainComponents,
      null,
      "checkbox",
    ),
    createChoice(
      "pain",
      "overloaded",
      t.reviewPainOverloaded,
      null,
      "checkbox",
    ),
  ];

  const tierChoices = [
    createChoice("tier", "early", t.reviewTierEarly, t.reviewTierEarlyHint),
    createChoice("tier", "mid", t.reviewTierMid, t.reviewTierMidHint),
    createChoice("tier", "strong", t.reviewTierStrong, t.reviewTierStrongHint),
    createChoice("tier", "top", t.reviewTierTop, t.reviewTierTopHint),
  ].map((c) => c.label);

  const adviceStack = document.createElement("div");
  adviceStack.className = "review-panel__options review-panel__options--advice";

  const adviceField = document.createElement("div");
  adviceField.className = "review-panel__field";

  const adviceRecBtn = document.createElement("button");
  adviceRecBtn.type = "button";
  adviceRecBtn.className = "review-panel__rec";
  adviceRecBtn.hidden = true;
  adviceRecBtn.setAttribute("aria-pressed", "false");
  adviceRecBtn.append(createMicIcon(), createRecDot());

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
  adviceField.append(adviceInput, adviceRecBtn);
  adviceStack.append(adviceField, adviceMeta);

  /**
   * @returns {number}
   */
  function readVisualScore() {
    const input = form.querySelector(
      'input.review-panel__slider-input[name="visual"]',
    );
    if (!(input instanceof HTMLInputElement)) return NaN;
    return Number(input.value);
  }

  /**
   * Pain только при низкой оценке visual (≤ 2).
   * @returns {boolean}
   */
  function isPainStepVisible() {
    const score = readVisualScore();
    return Number.isFinite(score) && score <= 2;
  }

  /** @type {{
   *   id: string;
   *   step: HTMLElement;
   *   title: string;
   *   hint: string | null;
   *   validate: () => boolean;
   *   autoAdvance: boolean;
   *   isVisible?: () => boolean;
   *   errorMessage?: string;
   * }[]} */
  const steps = [
    {
      id: "grade",
      step: createStep(createOptions(...gradeChoices)),
      title: t.reviewGradeLabel,
      hint: null,
      validate: () => hasRadioValue(form, "grade"),
      autoAdvance: true,
    },
    {
      id: "context",
      step: createStep(
        createOptions(
          createScaleSlider({
            name: "context",
            from: 1,
            to: 5,
            title: t.reviewContextShort,
            description: t.reviewContextLabel,
            ariaLabel: t.reviewContextLabel,
            ends: {
              low: t.reviewContextScaleLow,
              high: t.reviewContextScaleHigh,
            },
            valueTitles: {
              1: t.reviewContextValue1,
              2: t.reviewContextValue2,
              3: t.reviewContextValue3,
              4: t.reviewContextValue4,
              5: t.reviewContextValue5,
            },
            valueHints: {
              1: t.reviewContextHint1,
              2: t.reviewContextHint2,
              3: t.reviewContextHint3,
              4: t.reviewContextHint4,
              5: t.reviewContextHint5,
            },
          }),
        ),
      ),
      title: "",
      hint: null,
      validate: () => hasSliderValue(form, "context"),
      autoAdvance: true,
    },
    {
      id: "structure",
      step: createStep(createOptions(...structureChoices)),
      title: t.reviewStructureLabel,
      hint: null,
      validate: () => hasRadioValue(form, "structure"),
      autoAdvance: true,
    },
    {
      id: "metrics",
      step: createStep(createOptions(...metricsChoices)),
      title: t.reviewMetricsLabel,
      hint: null,
      validate: () => hasRadioValue(form, "metrics"),
      autoAdvance: true,
    },
    {
      id: "visual",
      step: createStep(
        createOptions(
          createScaleSlider({
            name: "visual",
            from: 1,
            to: 5,
            title: t.reviewVisualShort,
            description: t.reviewVisualLabel,
            ariaLabel: t.reviewVisualLabel,
            ends: {
              low: t.reviewVisualScaleLow,
              high: t.reviewVisualScaleHigh,
            },
            valueTitles: {
              1: t.reviewVisualValue1,
              2: t.reviewVisualValue2,
              3: t.reviewVisualValue3,
              4: t.reviewVisualValue4,
              5: t.reviewVisualValue5,
            },
            valueHints: {
              1: t.reviewVisualHint1,
              2: t.reviewVisualHint2,
              3: t.reviewVisualHint3,
              4: t.reviewVisualHint4,
              5: t.reviewVisualHint5,
            },
          }),
        ),
      ),
      title: "",
      hint: null,
      validate: () => hasSliderValue(form, "visual"),
      autoAdvance: true,
    },
    {
      id: "pain",
      step: createStep(createOptions(...painItems.map((c) => c.label))),
      title: t.reviewPainLabel,
      hint: null,
      validate: () => true,
      autoAdvance: false,
      isVisible: isPainStepVisible,
    },
    {
      id: "tier",
      step: createStep(createOptions(...tierChoices)),
      title: t.reviewTierLabel,
      hint: null,
      validate: () => hasRadioValue(form, "tier"),
      autoAdvance: true,
    },
    {
      id: "advice",
      step: createStep(adviceStack),
      title: t.reviewAdviceLabel,
      hint: null,
      validate: () => adviceInput.value.trim().length >= ADVICE_MIN_LEN,
      autoAdvance: false,
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
  const exitLabel = document.createElement("span");
  exitLabel.className = "review-panel__done-btn-label";
  exitLabel.textContent = t.reviewDoneExit;
  exitBtn.append(exitLabel, createDoneLoader());

  const nextCaseBtn = document.createElement("button");
  nextCaseBtn.type = "button";
  nextCaseBtn.className =
    "iframe-shell__btn review-panel__done-btn review-panel__done-btn--next";
  const nextCaseLabel = document.createElement("span");
  nextCaseLabel.className = "review-panel__done-btn-label";
  nextCaseLabel.textContent = t.reviewDoneNextCase;
  nextCaseBtn.append(nextCaseLabel, createDoneLoader());
  /* Сразу на done с лоадером; без кандидатов — empty-подпись, не hide. */
  nextCaseBtn.hidden = true;
  nextCaseBtn.setAttribute("aria-hidden", "true");

  actions.append(exitBtn, nextCaseBtn);

  /** Prewarm ленты на done — лоадер на next, exit кликабелен. */
  let nextCasePreparing = false;
  /** Клик «Следующий кейс» — claim / переход. */
  let nextCaseOpeningBusy = false;
  /** Кандидатов нет — disabled + короткая подпись. */
  let nextCaseEmpty = false;
  /** Клик «На главную» — ждём submit / release. */
  let exitBusy = false;
  done.append(doneTitle, actions);
  root.append(heading, top, form, done);

  let currentStep = 0;
  let dictationSupported = false;
  let dictationRecording = false;
  /** Текст поля на момент старта записи — транскрипт дописывается к нему. */
  let dictationBase = "";
  let transitioning = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let advanceTimer = null;
  /** @type {Record<string, FormDataEntryValue> | null} */
  let completedAnswers = null;
  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /**
   * @param {number} index
   * @returns {boolean}
   */
  function isStepIndexVisible(index) {
    const item = steps[index];
    if (!item) return false;
    return typeof item.isVisible === "function" ? item.isVisible() : true;
  }

  /**
   * @returns {number[]}
   */
  function visibleStepIndices() {
    return steps
      .map((_, index) => index)
      .filter((index) => isStepIndexVisible(index));
  }

  /**
   * @param {number} fromIndex
   * @param {1 | -1} direction
   * @returns {number}
   */
  function findAdjacentVisibleStep(fromIndex, direction) {
    let index = fromIndex + direction;
    while (index >= 0 && index < steps.length) {
      if (isStepIndexVisible(index)) return index;
      index += direction;
    }
    return fromIndex;
  }

  function clearPainSelections() {
    for (const item of painItems) {
      item.input.checked = false;
      item.input.disabled = false;
      item.label.classList.remove("review-panel__choice--disabled");
    }
  }

  /**
   * Если visual вырос выше порога — сбросить pain (шаг скрыт).
   */
  function syncPainForVisual() {
    if (!isPainStepVisible()) clearPainSelections();
  }

  function clearAdvanceTimer() {
    if (advanceTimer !== null) {
      window.clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function showStepError(visible) {
    const isAdvice = steps[currentStep]?.id === "advice";
    // На шаге совета ошибка — цвет «Минимум 100…», без отдельной строки.
    adviceHint.classList.toggle(
      "review-panel__meta-hint--error",
      Boolean(visible && isAdvice),
    );
    if (isAdvice) {
      stepError.hidden = true;
      return;
    }
    if (visible) {
      stepError.textContent =
        steps[currentStep]?.errorMessage ?? t.reviewStepRequired;
    }
    stepError.hidden = !visible;
  }

  function syncQuestion() {
    const item = steps[currentStep];
    const title = item?.title ?? "";
    const hint = item?.hint ?? null;
    questionTitle.textContent = title;
    question.hidden = !title && !hint;
    if (hint) {
      questionHint.textContent = hint;
      questionHint.hidden = false;
    } else {
      questionHint.textContent = "";
      questionHint.hidden = true;
    }
  }

  function syncProgress() {
    const visible = visibleStepIndices();
    const position = Math.max(0, visible.indexOf(currentStep));
    const current = position + 1;
    const total = visible.length;
    progressLabel.textContent = formatString(t.reviewProgress, {
      current,
      total,
    });
    progress.setAttribute("aria-valuenow", String(current));
    progress.setAttribute("aria-valuemax", String(total));
    progress.setAttribute(
      "aria-valuetext",
      formatString(t.reviewProgress, { current, total }),
    );
  }

  function syncChrome() {
    const isFirst = currentStep === 0;
    const isLast = steps[currentStep]?.id === "advice";
    const auto = Boolean(steps[currentStep]?.autoAdvance);

    // Шаг с полем ушёл — микрофон не должен остаться включённым.
    if (dictationRecording && !isLast) onDictationToggle?.();

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

  function syncAdviceMeta() {
    adviceCount.textContent = `${adviceInput.value.length} / ${ADVICE_MAX_LEN}`;
    if (
      !stepError.hidden ||
      adviceHint.classList.contains("review-panel__meta-hint--error")
    ) {
      showStepError(false);
    }
    if (steps[currentStep]?.id === "advice") {
      syncReportReveal();
    }
  }

  function syncDictationChrome() {
    const strings = getStrings();
    adviceRecBtn.hidden = !dictationSupported;
    adviceRecBtn.classList.toggle(
      "review-panel__rec--recording",
      dictationRecording,
    );
    adviceRecBtn.setAttribute(
      "aria-pressed",
      dictationRecording ? "true" : "false",
    );
    adviceRecBtn.setAttribute(
      "aria-label",
      dictationRecording
        ? strings.reviewRecStopAria
        : strings.reviewAdviceRecStartAria,
    );
    adviceRecBtn.title = dictationRecording
      ? strings.reviewRecStopTitle
      : strings.reviewAdviceRecStartTitle;
    // Во время записи текст принадлежит движку: ручная правка разъехалась бы
    // с накопленным транскриптом.
    adviceInput.readOnly = dictationRecording;
  }

  function syncReportReveal() {
    const onAdvice =
      done.hidden && !form.hidden && steps[currentStep]?.id === "advice";

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

  function syncDoneActions() {
    const nextBusy = nextCasePreparing || nextCaseOpeningBusy;
    const lockExit = exitBusy || nextCaseOpeningBusy;

    nextCaseBtn.disabled = nextBusy || exitBusy || nextCaseEmpty;
    exitBtn.disabled = lockExit;

    nextCaseBtn.classList.toggle("review-panel__done-btn--busy", nextBusy);
    nextCaseBtn.classList.toggle(
      "review-panel__done-btn--empty",
      nextCaseEmpty && !nextBusy,
    );
    exitBtn.classList.toggle("review-panel__done-btn--busy", exitBusy);

    nextCaseBtn.setAttribute("aria-busy", nextBusy ? "true" : "false");
    exitBtn.setAttribute("aria-busy", exitBusy ? "true" : "false");

    const strings = getStrings();
    let nextLabel = strings.reviewDoneNextCase;
    let nextAria = strings.reviewDoneNextCase;
    if (nextBusy) {
      nextAria = strings.reviewDoneNextCaseBusy;
    } else if (nextCaseEmpty) {
      nextLabel = strings.reviewDoneNextCaseEmpty;
      nextAria = strings.reviewDoneNextCaseEmpty;
    }
    nextCaseLabel.textContent = nextLabel;
    nextCaseBtn.setAttribute("aria-label", nextAria);
    exitBtn.setAttribute(
      "aria-label",
      exitBusy ? strings.reviewDoneExitBusy : strings.reviewDoneExit,
    );
  }

  /**
   * @param {boolean} busy
   */
  function setNextCaseBusy(busy) {
    nextCaseOpeningBusy = Boolean(busy);
    if (nextCaseOpeningBusy) nextCaseEmpty = false;
    syncDoneActions();
  }

  /**
   * Prewarm на done: кнопка видна с лоадером, «На главную» не блокируется.
   * @param {boolean} preparing
   */
  function setNextCasePreparing(preparing) {
    nextCasePreparing = Boolean(preparing);
    if (nextCasePreparing) nextCaseEmpty = false;
    syncDoneActions();
  }

  /**
   * Нет кандидатов после prewarm — disabled + «Кейсов больше нет».
   * @param {boolean} empty
   */
  function setNextCaseEmpty(empty) {
    nextCaseEmpty = Boolean(empty);
    if (nextCaseEmpty) {
      nextCasePreparing = false;
      nextCaseOpeningBusy = false;
    }
    syncDoneActions();
  }

  /**
   * @param {boolean} busy
   */
  function setExitBusy(busy) {
    exitBusy = Boolean(busy);
    syncDoneActions();
  }

  /**
   * @param {boolean} visible
   */
  function setNextCaseVisible(visible) {
    const show = Boolean(visible);
    nextCaseBtn.hidden = !show;
    nextCaseBtn.setAttribute("aria-hidden", show ? "false" : "true");
    if (!show) {
      nextCasePreparing = false;
      nextCaseOpeningBusy = false;
      nextCaseEmpty = false;
      syncDoneActions();
    }
  }

  /**
   * Финальный вопрос → done слева; PDF-лист уезжает вниз справа.
   * Form/top уходят на --motion-reveal-*, done входит тем же языком.
   * @param {Record<string, FormDataEntryValue> | null} [answers]
   * @returns {Promise<void>}
   */
  async function showDone(answers = null) {
    clearAdvanceTimer();
    setNextCaseVisible(true);
    setNextCasePreparing(true);

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
    if (current?.id === "visual") syncPainForVisual();
    const nextIndex = findAdjacentVisibleStep(currentStep, 1);
    if (nextIndex !== currentStep) {
      await goToStep(nextIndex, { direction: 1 });
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
    const prevIndex = findAdjacentVisibleStep(currentStep, -1);
    if (prevIndex !== currentStep) {
      await goToStep(prevIndex, { direction: -1 });
      focusActiveStep();
    }
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
    syncAdviceMeta();
  });

  adviceRecBtn.addEventListener("click", () => {
    onDictationToggle?.();
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
    if (exitBtn.disabled) return;
    setExitBusy(true);
    onExit?.();
  });

  nextCaseBtn.addEventListener("click", () => {
    if (nextCaseBtn.disabled || nextCaseBtn.hidden) return;
    setNextCaseBusy(true);
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
    dictationRecording = false;
    dictationBase = "";
    syncDictationChrome();
    currentStep = 0;
    exitBusy = false;
    nextCasePreparing = false;
    nextCaseOpeningBusy = false;
    nextCaseEmpty = false;
    setNextCaseVisible(false);
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
  syncDictationChrome();

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
    setDictationSupported: (supported) => {
      dictationSupported = Boolean(supported);
      syncDictationChrome();
    },
    setDictationRecording: (recording) => {
      const next = Boolean(recording);
      if (next && !dictationRecording) {
        dictationBase = adviceInput.value.trim();
      }
      dictationRecording = next;
      syncDictationChrome();
    },
    setDictationTranscript: (text) => {
      if (!dictationRecording) return;
      adviceInput.value = [dictationBase, text]
        .filter(Boolean)
        .join(" ")
        .slice(0, ADVICE_MAX_LEN);
      adviceInput.scrollTop = adviceInput.scrollHeight;
      syncAdviceMeta();
    },
    /** Абсолютная запись в поле совета (после polish / без живой записи). */
    setAdviceText: (text) => {
      adviceInput.value = String(text ?? "").slice(0, ADVICE_MAX_LEN);
      adviceInput.scrollTop = adviceInput.scrollHeight;
      syncAdviceMeta();
    },
    setNextCaseBusy,
    setNextCasePreparing,
    setNextCaseEmpty,
    setNextCaseVisible,
    setExitBusy,
  };
}
