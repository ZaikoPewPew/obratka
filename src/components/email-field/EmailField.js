const SUBMIT_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M9.99999 11L5.99999 15M5.99999 15L9.99999 19M5.99999 15H17C18.1046 15 19 14.107 19 13.0025C19 10.0901 19 4.92333 19 4" stroke="#242426" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/** Совпадает с атрибутом pattern у input */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_PATTERN_ATTR = "[^\\s@]+@[^\\s@]+\\.[^\\s@]+";

function isValidEmail(value) {
  return EMAIL_RE.test(String(value).trim());
}

/** Простые плейсхолдер-аватарки (локально, без запросов) */
function createAvatarStack() {
  const colors = ["#6b8cae", "#8f7a9a", "#7a9a8a", "#9a8a7a"];
  const stack = document.createElement("div");
  stack.className = "email-avatars__stack";

  for (let i = 0; i < 4; i += 1) {
    const av = document.createElement("span");
    av.className = "email-avatars__avatar";
    av.style.background = colors[i];
    stack.appendChild(av);
  }
  return stack;
}

/**
 * Инпут email + кнопка при вводе; ниже — аватарки и текст.
 * @param {{ placeholder: string; foundersText: string; submitAria: string; invalidEmailMessage: string; className?: string }} opts
 * @returns {HTMLDivElement}
 */
export function createEmailField({
  placeholder,
  foundersText,
  submitAria,
  invalidEmailMessage,
  className = "email-field-block",
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
  input.setAttribute("pattern", EMAIL_PATTERN_ATTR);
  input.setAttribute("title", invalidEmailMessage);

  const submit = document.createElement("button");
  submit.type = "button";
  submit.className = "email-input__submit";
  submit.hidden = true;
  submit.setAttribute("aria-label", submitAria);
  submit.innerHTML = SUBMIT_SVG;

  function syncValidityMessage() {
    const v = input.value.trim();
    if (!v) {
      input.setCustomValidity("");
    } else if (!isValidEmail(input.value)) {
      input.setCustomValidity(invalidEmailMessage || "Invalid email");
    } else {
      input.setCustomValidity("");
    }
  }

  function syncShellFilled() {
    const v = input.value.trim();
    shell.classList.toggle("email-input-shell--filled", v.length > 0);
  }

  function syncAriaInvalid() {
    const invalid = shell.classList.contains("email-input-shell--invalid");
    input.setAttribute("aria-invalid", invalid ? "true" : "false");
  }

  function syncSubmit() {
    const has = input.value.trim().length > 0;
    submit.hidden = !has;
    syncShellFilled();
  }

  function onInput() {
    syncValidityMessage();
    syncSubmit();
    const v = input.value.trim();
    if (v.length === 0 || isValidEmail(input.value)) {
      shell.classList.remove("email-input-shell--invalid");
    }
    syncAriaInvalid();
  }

  function onBlur() {
    const v = input.value.trim();
    if (v.length > 0 && !isValidEmail(input.value)) {
      shell.classList.add("email-input-shell--invalid");
    } else {
      shell.classList.remove("email-input-shell--invalid");
    }
    syncAriaInvalid();
  }

  input.addEventListener("input", onInput);
  input.addEventListener("blur", onBlur);

  submit.addEventListener("click", () => {
    syncValidityMessage();
    const v = input.value.trim();
    if (!v) return;
    if (!isValidEmail(input.value)) {
      shell.classList.add("email-input-shell--invalid");
      syncAriaInvalid();
      input.reportValidity();
      return;
    }
    shell.classList.remove("email-input-shell--invalid");
    syncAriaInvalid();
    input.dispatchEvent(
      new CustomEvent("email-submit", { bubbles: true, detail: { value: v } }),
    );
  });

  shell.append(input, submit);

  const row = document.createElement("div");
  row.className = "email-avatars";

  const stack = createAvatarStack();
  const caption = document.createElement("p");
  caption.className = "email-avatars__caption";
  caption.textContent = foundersText;

  row.append(stack, caption);
  root.append(shell, row);

  syncSubmit();
  syncAriaInvalid();
  return root;
}
