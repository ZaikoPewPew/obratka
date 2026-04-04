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
 * @param {{ placeholder: string; foundersText: string; submitAria: string; invalidEmailMessage: string; className?: string; avatarCount?: number; showFoundersRow?: boolean }} opts
 * @returns {HTMLDivElement}
 */
export function createEmailField({
  placeholder,
  foundersText,
  submitAria,
  invalidEmailMessage,
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

  function performEmailSubmit() {
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

  if (showFoundersRow) {
    const row = document.createElement("div");
    row.className = "email-avatars";

    const stack = createAvatarStack(avatarCount);
    const caption = document.createElement("p");
    caption.className = "email-avatars__caption";
    caption.textContent = foundersText;

    row.append(stack, caption);
    root.append(row);
  }

  syncSubmit();
  syncAriaInvalid();
  return root;
}
