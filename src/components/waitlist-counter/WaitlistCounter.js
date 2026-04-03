/**
 * Бейдж «сейчас в базе …» с мигающей точкой.
 * @param {{ text: string; className?: string }} opts
 * @returns {HTMLDivElement}
 */
export function createWaitlistCounter({ text, className = "" }) {
  const root = document.createElement("div");
  root.className = className;
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");

  const inner = document.createElement("div");
  inner.className = "desktop-counter__inner";

  const pointer = document.createElement("span");
  pointer.className = "desktop-counter__pointer";
  pointer.setAttribute("aria-hidden", "true");
  pointer.innerHTML = `
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle class="desktop-counter__dot" cx="4.5" cy="4.5" r="4.5" />
    </svg>
  `;

  const label = document.createElement("span");
  label.className = "desktop-counter__text";
  label.textContent = text;

  inner.append(pointer, label);
  root.append(inner);
  return root;
}
