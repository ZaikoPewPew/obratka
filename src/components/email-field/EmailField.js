const SUBMIT_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M9.99999 11L5.99999 15M5.99999 15L9.99999 19M5.99999 15H17C18.1046 15 19 14.107 19 13.0025C19 10.0901 19 4.92333 19 4" stroke="#242426" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

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
 * @param {{ placeholder: string; foundersText: string; submitAria: string; className?: string }} opts
 * @returns {HTMLDivElement}
 */
export function createEmailField({
  placeholder,
  foundersText,
  submitAria,
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

  const submit = document.createElement("button");
  submit.type = "button";
  submit.className = "email-input__submit";
  submit.hidden = true;
  submit.setAttribute("aria-label", submitAria);
  submit.innerHTML = SUBMIT_SVG;

  function syncSubmit() {
    const has = input.value.trim().length > 0;
    submit.hidden = !has;
  }

  input.addEventListener("input", syncSubmit);
  submit.addEventListener("click", () => {
    input.dispatchEvent(new CustomEvent("email-submit", { bubbles: true, detail: { value: input.value } }));
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
  return root;
}
