import { formatString, getStrings } from "../../i18n.js";
import { answersFromFormData } from "../../utils/reviewReport.js";
import { shareReviewPdf } from "../../utils/shareReviewPdf.js";

const ADVICE_MAX_LEN = 100;
const PAIN_MAX = 2;
const AUTO_ADVANCE_MS = 180;

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
 * @param {string} name
 * @param {string} value
 * @param {string} labelText
 * @param {"radio" | "checkbox"} type
 */
function createChoice(name, value, labelText, type = "radio") {
  const label = document.createElement("label");
  label.className = "review-panel__choice";

  const input = document.createElement("input");
  input.className = "review-panel__choice-input";
  input.type = type;
  input.name = name;
  input.value = value;

  const text = document.createElement("span");
  text.className = "review-panel__choice-text";
  text.textContent = labelText;

  label.append(input, text);
  return { label, input };
}

/**
 * @param {string} name
 * @param {number} from
 * @param {number} to
 * @param {string} [ariaLabel]
 */
function createScale(name, from, to, ariaLabel) {
  const group = document.createElement("div");
  group.className = "review-panel__scale";
  group.setAttribute("role", "radiogroup");
  if (ariaLabel) {
    group.setAttribute("aria-label", ariaLabel);
  }

  for (let n = from; n <= to; n += 1) {
    const label = document.createElement("label");
    label.className = "review-panel__scale-item";

    const input = document.createElement("input");
    input.className = "review-panel__scale-input";
    input.type = "radio";
    input.name = name;
    input.value = String(n);

    const face = document.createElement("span");
    face.className = "review-panel__scale-face";
    face.textContent = String(n);

    label.append(input, face);
    group.append(label);
  }

  return group;
}

/**
 * @param {string} labelText
 * @param {string | null} hintText
 * @param {...Node} controls
 */
function createField(labelText, hintText, ...controls) {
  const field = document.createElement("div");
  field.className = "review-panel__field";

  const label = document.createElement("p");
  label.className = "review-panel__label";
  label.textContent = labelText;
  field.append(label);

  if (hintText) {
    const hint = document.createElement("p");
    hint.className = "review-panel__hint";
    hint.textContent = hintText;
    field.append(hint);
  }

  const stack = document.createElement("div");
  stack.className = "review-panel__options";
  stack.append(...controls);
  field.append(stack);
  return field;
}

/**
 * @param {HTMLElement} content
 * @returns {HTMLElement}
 */
function createStep(content) {
  const step = document.createElement("section");
  step.className = "review-panel__step";
  step.hidden = true;
  step.append(content);
  return step;
}

/**
 * @param {{ getPortfolioName?: () => string }} [options]
 * @returns {{
 *   root: HTMLElement;
 *   form: HTMLFormElement;
 *   open: () => void;
 *   close: () => void;
 *   reset: () => void;
 *   focus: () => void;
 * }}
 */
export function createReviewPanel(options = {}) {
  const t = getStrings();
  const getPortfolioName =
    typeof options.getPortfolioName === "function"
      ? options.getPortfolioName
      : () => getStrings().brandName;

  const root = document.createElement("div");
  root.className = "review-panel";

  const heading = document.createElement("h2");
  heading.className = "review-panel__title";
  heading.id = "review-panel-title";
  heading.textContent = t.reviewTitle;

  const progress = document.createElement("div");
  progress.className = "review-panel__progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-valuemin", "1");

  const progressMeta = document.createElement("div");
  progressMeta.className = "review-panel__progress-meta";

  const progressLabel = document.createElement("span");
  progressLabel.className = "review-panel__progress-label";

  const progressTrack = document.createElement("div");
  progressTrack.className = "review-panel__progress-track";

  const progressFill = document.createElement("div");
  progressFill.className = "review-panel__progress-fill";

  progressTrack.append(progressFill);
  progressMeta.append(progressLabel);
  progress.append(progressMeta, progressTrack);

  const form = document.createElement("form");
  form.className = "review-panel__form";
  form.noValidate = true;

  const body = document.createElement("div");
  body.className = "review-panel__body";

  const gradeChoices = [
    createChoice("grade", "junior", t.reviewGradeJunior),
    createChoice("grade", "mid", t.reviewGradeMid),
    createChoice("grade", "senior", t.reviewGradeSenior),
  ].map((c) => c.label);

  const structureChoices = [
    createChoice("structure", "mess", t.reviewStructureMess),
    createChoice("structure", "clear", t.reviewStructureClear),
  ].map((c) => c.label);

  const metricsChoices = [
    createChoice("metrics", "none", t.reviewMetricsNone),
    createChoice("metrics", "nominal", t.reviewMetricsNominal),
    createChoice("metrics", "strong", t.reviewMetricsStrong),
  ].map((c) => c.label);

  const painItems = [
    createChoice("pain", "hierarchy", t.reviewPainHierarchy, "checkbox"),
    createChoice("pain", "grid", t.reviewPainGrid, "checkbox"),
    createChoice("pain", "overloaded", t.reviewPainOverloaded, "checkbox"),
    createChoice("pain", "ok", t.reviewPainOk, "checkbox"),
  ];

  const hireChoices = [
    createChoice("hire", "yes", t.reviewHireYes),
    createChoice("hire", "maybe", t.reviewHireMaybe),
    createChoice("hire", "no", t.reviewHireNo),
  ].map((c) => c.label);

  const adviceField = document.createElement("div");
  adviceField.className = "review-panel__field";

  const adviceLabel = document.createElement("label");
  adviceLabel.className = "review-panel__label";
  adviceLabel.htmlFor = "review-advice";
  adviceLabel.textContent = t.reviewAdviceLabel;

  const adviceInput = document.createElement("textarea");
  adviceInput.className = "review-panel__textarea";
  adviceInput.id = "review-advice";
  adviceInput.name = "advice";
  adviceInput.rows = 4;
  adviceInput.maxLength = ADVICE_MAX_LEN;
  adviceInput.placeholder = t.reviewAdvicePlaceholder;

  const adviceMeta = document.createElement("div");
  adviceMeta.className = "review-panel__meta";

  const adviceHint = document.createElement("span");
  adviceHint.className = "review-panel__hint";
  adviceHint.textContent = t.reviewAdviceHint;

  const adviceCount = document.createElement("span");
  adviceCount.className = "review-panel__count";
  adviceCount.textContent = `0 / ${ADVICE_MAX_LEN}`;

  adviceMeta.append(adviceHint, adviceCount);
  adviceField.append(adviceLabel, adviceInput, adviceMeta);

  /** @type {{ step: HTMLElement; validate: () => boolean; autoAdvance: boolean }[]} */
  const steps = [
    {
      step: createStep(createField(t.reviewGradeLabel, null, ...gradeChoices)),
      validate: () => hasRadioValue(form, "grade"),
      autoAdvance: true,
    },
    {
      step: createStep(
        createField(
          t.reviewContextLabel,
          t.reviewContextHint,
          createScale("context", 1, 5, t.reviewContextLabel),
        ),
      ),
      validate: () => hasRadioValue(form, "context"),
      autoAdvance: true,
    },
    {
      step: createStep(
        createField(t.reviewStructureLabel, null, ...structureChoices),
      ),
      validate: () => hasRadioValue(form, "structure"),
      autoAdvance: true,
    },
    {
      step: createStep(
        createField(t.reviewMetricsLabel, null, ...metricsChoices),
      ),
      validate: () => hasRadioValue(form, "metrics"),
      autoAdvance: true,
    },
    {
      step: createStep(
        createField(
          t.reviewVisualLabel,
          t.reviewVisualHint,
          createScale("visual", 1, 10, t.reviewVisualLabel),
        ),
      ),
      validate: () => hasRadioValue(form, "visual"),
      autoAdvance: true,
    },
    {
      step: createStep(
        createField(t.reviewPainLabel, null, ...painItems.map((c) => c.label)),
      ),
      validate: () => true,
      autoAdvance: false,
    },
    {
      step: createStep(createField(t.reviewHireLabel, null, ...hireChoices)),
      validate: () => hasRadioValue(form, "hire"),
      autoAdvance: true,
    },
    {
      step: createStep(adviceField),
      validate: () => adviceInput.value.trim().length > 0,
      autoAdvance: false,
    },
  ];

  for (const item of steps) {
    body.append(item.step);
  }

  const stepError = document.createElement("p");
  stepError.className = "review-panel__step-error";
  stepError.hidden = true;
  stepError.textContent = t.reviewStepRequired;

  const footer = document.createElement("div");
  footer.className = "review-panel__footer";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "iframe-shell__btn review-panel__nav review-panel__nav--back";
  backBtn.textContent = t.reviewBack;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "iframe-shell__btn review-panel__nav review-panel__nav--next";
  nextBtn.textContent = t.reviewNext;

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "iframe-shell__btn review-panel__submit";
  submit.textContent = t.reviewSubmit;
  submit.hidden = true;

  footer.append(backBtn, nextBtn, submit);
  form.append(body, stepError, footer);

  const done = document.createElement("div");
  done.className = "review-panel__done";
  done.hidden = true;

  const doneTitle = document.createElement("p");
  doneTitle.className = "review-panel__done-title";
  doneTitle.textContent = t.reviewDoneTitle;

  const doneHint = document.createElement("p");
  doneHint.className = "review-panel__done-hint";
  doneHint.textContent = t.reviewDoneHint;

  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "iframe-shell__btn review-panel__share";
  shareBtn.textContent = t.reviewShareReport;

  done.append(doneTitle, doneHint, shareBtn);
  root.append(heading, progress, form, done);

  let currentStep = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let advanceTimer = null;
  /** @type {import("../../utils/reviewReport.js").ReviewAnswers | null} */
  let submittedAnswers = null;
  const totalSteps = steps.length;

  function clearAdvanceTimer() {
    if (advanceTimer !== null) {
      window.clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function showStepError(visible) {
    stepError.hidden = !visible;
  }

  function syncProgress() {
    const current = currentStep + 1;
    const ratio = current / totalSteps;
    progressLabel.textContent = formatString(t.reviewProgress, {
      current,
      total: totalSteps,
    });
    progressFill.style.width = `${ratio * 100}%`;
    progress.setAttribute("aria-valuenow", String(current));
    progress.setAttribute("aria-valuemax", String(totalSteps));
    progress.setAttribute(
      "aria-valuetext",
      formatString(t.reviewProgress, { current, total: totalSteps }),
    );
  }

  function showForm() {
    form.hidden = false;
    progress.hidden = false;
    done.hidden = true;
  }

  function showDone() {
    clearAdvanceTimer();
    form.hidden = true;
    progress.hidden = true;
    done.hidden = false;
  }

  function renderStep() {
    clearAdvanceTimer();
    steps.forEach((item, index) => {
      item.step.hidden = index !== currentStep;
    });

    const isFirst = currentStep === 0;
    const isLast = currentStep === totalSteps - 1;
    const auto = Boolean(steps[currentStep]?.autoAdvance);

    backBtn.hidden = isFirst;
    nextBtn.hidden = isLast || auto;
    submit.hidden = !isLast;
    footer.hidden = isFirst && auto;
    showStepError(false);
    syncProgress();
  }

  function focusActiveStep() {
    const active = steps[currentStep]?.step;
    const focusable = active?.querySelector(
      "input:not([disabled]), textarea, button",
    );
    if (focusable instanceof HTMLElement) {
      focusable.focus();
    }
  }

  function goNext({ force = false } = {}) {
    const current = steps[currentStep];
    if (!force && !current?.validate()) {
      showStepError(true);
      focusActiveStep();
      return;
    }
    if (currentStep < totalSteps - 1) {
      currentStep += 1;
      renderStep();
      focusActiveStep();
    }
  }

  function scheduleAutoAdvance() {
    clearAdvanceTimer();
    advanceTimer = window.setTimeout(() => {
      advanceTimer = null;
      goNext({ force: true });
    }, AUTO_ADVANCE_MS);
  }

  function goBack() {
    clearAdvanceTimer();
    if (currentStep > 0) {
      currentStep -= 1;
      renderStep();
      focusActiveStep();
    }
  }

  function syncPainLimit() {
    const checked = painItems.filter((item) => item.input.checked);
    const atLimit = checked.length >= PAIN_MAX;
    for (const item of painItems) {
      if (!item.input.checked) {
        item.input.disabled = atLimit;
        item.label.classList.toggle("review-panel__choice--disabled", atLimit);
      }
    }
  }

  for (const item of painItems) {
    item.input.addEventListener("change", syncPainLimit);
  }

  adviceInput.addEventListener("input", () => {
    adviceCount.textContent = `${adviceInput.value.length} / ${ADVICE_MAX_LEN}`;
    if (!stepError.hidden) showStepError(false);
  });

  form.addEventListener("change", (event) => {
    if (!stepError.hidden) showStepError(false);

    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== "radio") return;
    if (!steps[currentStep]?.autoAdvance) return;
    if (!steps[currentStep]?.validate()) return;
    scheduleAutoAdvance();
  });

  nextBtn.addEventListener("click", () => goNext());
  backBtn.addEventListener("click", goBack);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
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

    submittedAnswers = answers;
    showDone();
    shareBtn.focus();
  });

  shareBtn.addEventListener("click", () => {
    if (!submittedAnswers) return;
    shareReviewPdf(submittedAnswers, {
      portfolioName: getPortfolioName(),
    });
  });

  function reset() {
    clearAdvanceTimer();
    form.reset();
    adviceCount.textContent = `0 / ${ADVICE_MAX_LEN}`;
    for (const item of painItems) {
      item.input.disabled = false;
      item.label.classList.remove("review-panel__choice--disabled");
    }
    submittedAnswers = null;
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
      shareBtn.focus();
      return;
    }
    focusActiveStep();
  }

  renderStep();

  return { root, form, open, close, reset, focus };
}
