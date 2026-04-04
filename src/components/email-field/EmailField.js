import { EMAIL_MAX_LENGTH, isValidEmail } from "../../utils/emailValidation.js";

const SUBMIT_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M9.99999 11L5.99999 15M5.99999 15L9.99999 19M5.99999 15H17C18.1046 15 19 14.107 19 13.0025C19 10.0901 19 4.92333 19 4" stroke="#242426" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/** Простые плейсхолдер-аватарки (локально, без запросов) */
function createAvatarStack(count = 4) {
  const colors = ["#6b8cae", "#8f7a9a", "#7a9a8a", "#9a8a7a"];
  const n = Math.min(Math.max(0, Math.floor(count)), colors.length);
  const stack = document.createElement("div");
  stack.className =
    n === 2 ? "email-avatars__stack email-avatars__stack--pair" : "email-avatars__stack";

  for (let i = 0; i < n; i += 1) {
    const av = document.createElement("span");
    av.className = "email-avatars__avatar";
    av.style.background = colors[i];
    stack.appendChild(av);
  }
  return stack;
}

/**
 * Инпут email + кнопка при вводе; ниже — аватарки и текст.
 * @param {{ placeholder: string; foundersText: string; submitAria: string; invalidEmailMessage?: string; invalidCaption?: string; className?: string; avatarCount?: number; showFoundersRow?: boolean }} opts
 * @returns {HTMLDivElement}
 */
export function createEmailField({
  placeholder,
  foundersText,
  submitAria,
  invalidEmailMessage = "",
  invalidCaption = "",
  className = "email-field-block",
  avatarCount = 4,
  showFoundersRow = true,
}) {
  const root = document.createElement("div");
  root.className = className;

  const shell = document.createElement("div");
  shell.className = "email-input-shell";

  const input = document.createElement("input");
  input.className = "email-input";
  input.type = "email";
  input.name = "email";
  input.autocomplete = "email";
  input.placeholder = placeholder;
  input.setAttribute("inputmode", "email");
  input.setAttribute("maxlength", String(EMAIL_MAX_LENGTH));

  const submit = document.createElement("button");
  submit.type = "button";
  submit.className = "email-input__submit";
  submit.hidden = true;
  submit.setAttribute("aria-label", submitAria);
  submit.innerHTML = SUBMIT_SVG;

  function syncShellFilled() {
    const v = input.value.trim();
    shell.classList.toggle("email-input-shell--filled", v.length > 0);
  }

  function syncAriaInvalid() {
    const invalid = shell.classList.contains("email-input-shell--invalid");
    input.setAttribute("aria-invalid", invalid ? "true" : "false");
  }

  /** Подпись под аватарками: соц.текст или короткая красная фраза при невалидном email (после blur/submit). */
  function syncFoundersCaption() {
    if (!foundersCaption) return;
    const invalid = shell.classList.contains("email-input-shell--invalid");
    const errText = (invalidCaption || invalidEmailMessage || "").trim();
    if (invalid && errText) {
      foundersCaption.textContent = errText;
      foundersCaption.classList.add("email-avatars__caption--error");
    } else {
      foundersCaption.textContent = foundersText;
      foundersCaption.classList.remove("email-avatars__caption--error");
    }
  }

  function syncSubmit() {
    const has = input.value.trim().length > 0;
    submit.hidden = !has;
    syncShellFilled();
  }

  function onInput() {
    syncSubmit();
    const v = input.value.trim();
    if (v.length === 0 || isValidEmail(input.value)) {
      shell.classList.remove("email-input-shell--invalid");
    }
    syncAriaInvalid();
    syncFoundersCaption();
  }

  function onBlur() {
    const v = input.value.trim();
    if (v.length > 0 && !isValidEmail(input.value)) {
      shell.classList.add("email-input-shell--invalid");
    } else {
      shell.classList.remove("email-input-shell--invalid");
    }
    syncAriaInvalid();
    syncFoundersCaption();
  }

  input.addEventListener("input", onInput);
  input.addEventListener("blur", onBlur);

  function performEmailSubmit() {
    const v = input.value.trim();
    if (!v) return;
    if (!isValidEmail(input.value)) {
      shell.classList.add("email-input-shell--invalid");
      syncAriaInvalid();
      syncFoundersCaption();
      return;
    }
    shell.classList.remove("email-input-shell--invalid");
    syncAriaInvalid();
    syncFoundersCaption();
    input.dispatchEvent(
      new CustomEvent("email-submit", { bubbles: true, detail: { value: v } }),
    );
  }

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    performEmailSubmit();
  });

  /** Мобилка: при открытии клавиатуры держим поле в видимой области (visualViewport + scrollIntoView). */
  input.addEventListener(
    "focus",
    () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        return;
      }

      const scrollTarget = shell;

      const scrollIntoComfort = () => {
        scrollTarget.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      };

      scrollIntoComfort();
      requestAnimationFrame(scrollIntoComfort);
      setTimeout(scrollIntoComfort, 350);

      const vv = window.visualViewport;
      if (!vv) {
        return;
      }

      const onViewportChange = () => {
        const rect = scrollTarget.getBoundingClientRect();
        const viewBottom = vv.offsetTop + vv.height;
        const pad = 16;
        if (rect.bottom > viewBottom - pad) {
          const delta = rect.bottom - (viewBottom - pad);
          window.scrollBy({ top: delta, behavior: "smooth" });
        }
      };

      onViewportChange();
      vv.addEventListener("resize", onViewportChange);
      vv.addEventListener("scroll", onViewportChange);

      const stop = () => {
        vv.removeEventListener("resize", onViewportChange);
        vv.removeEventListener("scroll", onViewportChange);
        input.removeEventListener("blur", stop);
      };
      input.addEventListener("blur", stop);
    },
    { passive: true },
  );

  submit.addEventListener("click", performEmailSubmit);

  shell.append(input, submit);

  root.append(shell);

  let foundersRow = null;
  let foundersCaption = null;

  if (showFoundersRow) {
    foundersRow = document.createElement("div");
    foundersRow.className = "email-avatars";

    const stack = createAvatarStack(avatarCount);
    foundersCaption = document.createElement("p");
    foundersCaption.className = "email-avatars__caption";
    foundersCaption.textContent = foundersText;

    foundersRow.append(stack, foundersCaption);
    root.append(foundersRow);
  }

  syncSubmit();
  syncAriaInvalid();
  syncFoundersCaption();
  return root;
}
