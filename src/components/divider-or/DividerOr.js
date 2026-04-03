/**
 * Линия — «или» — линия
 * @param {{ text: string; className?: string }} opts
 * @returns {HTMLDivElement}
 */
export function createDividerOr({ text, className = "divider-or" }) {
  const root = document.createElement("div");
  root.className = className;

  const line1 = document.createElement("span");
  line1.className = "divider-or__line";
  line1.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "divider-or__label";
  label.textContent = text;

  const line2 = document.createElement("span");
  line2.className = "divider-or__line";
  line2.setAttribute("aria-hidden", "true");

  root.append(line1, label, line2);
  return root;
}
