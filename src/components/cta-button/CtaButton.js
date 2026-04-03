/**
 * @param {{ text: string; className?: string; type?: "button" | "submit" }} opts
 * @returns {HTMLButtonElement}
 */
export function createCtaButton({ text, className = "cta-button", type = "button" }) {
  const btn = document.createElement("button");
  btn.type = type;
  btn.className = className;
  btn.textContent = text;
  return btn;
}
