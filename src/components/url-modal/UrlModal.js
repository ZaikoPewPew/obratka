import { getStrings } from "../../i18n.js";
import { normalizePortfolioUrl } from "../../utils/portfolioMeta.js";

/**
 * Модалка ввода ссылки на портфолио.
 * @param {{ onSubmit: (url: string) => void }} opts
 * @returns {{
 *   backdrop: HTMLElement;
 *   open: (prefill?: string) => void;
 *   close: () => void;
 * }}
 */
export function createUrlModal({ onSubmit }) {
  const t = getStrings();

  const backdrop = document.createElement("div");
  backdrop.className = "url-modal__backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;

  const panel = document.createElement("div");
  panel.className = "url-modal";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "url-modal-title");

  const title = document.createElement("h2");
  title.className = "url-modal__title";
  title.id = "url-modal-title";
  title.textContent = t.urlModalTitle;

  const form = document.createElement("form");
  form.className = "url-modal__form";
  form.noValidate = true;

  const field = document.createElement("div");
  field.className = "url-modal__field";

  const input = document.createElement("input");
  input.className = "url-modal__input";
  input.id = "url-modal-input";
  input.type = "url";
  input.name = "portfolioUrl";
  input.required = true;
  input.autocomplete = "url";
  input.spellcheck = false;
  input.setAttribute("aria-label", t.urlModalTitle);
  input.placeholder = t.urlModalPlaceholder;

  const error = document.createElement("p");
  error.className = "url-modal__error";
  error.hidden = true;
  error.textContent = t.urlModalInvalid;

  field.append(input, error);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "iframe-shell__btn url-modal__submit";
  submit.textContent = t.urlModalSubmit;

  form.append(field, submit);
  panel.append(title, form);
  backdrop.append(panel);

  function setError(visible) {
    error.hidden = !visible;
    input.setAttribute("aria-invalid", visible ? "true" : "false");
  }

  function open(prefill = "") {
    backdrop.hidden = false;
    backdrop.setAttribute("aria-hidden", "false");
    setError(false);
    if (prefill) {
      input.value = prefill;
    }
    requestAnimationFrame(() => {
      backdrop.classList.add("url-modal__backdrop--open");
      input.focus();
      input.select();
    });
  }

  function close() {
    backdrop.classList.remove("url-modal__backdrop--open");
    backdrop.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      backdrop.hidden = true;
    }, 320);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const normalized = normalizePortfolioUrl(input.value);
    if (!normalized) {
      setError(true);
      input.focus();
      return;
    }
    setError(false);
    onSubmit(normalized);
    close();
  });

  input.addEventListener("input", () => {
    if (!error.hidden) setError(false);
  });

  return { backdrop, open, close };
}
