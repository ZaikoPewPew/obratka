/**
 * Подставляет отформатированное число в шаблон: сегменты текста и `span.count-value`.
 * @param {HTMLElement} parent
 * @param {string} template — может содержать один или несколько `{count}`
 * @param {string} countFormatted
 */
export function fillCountTemplate(parent, template, countFormatted) {
  parent.textContent = "";
  const parts = String(template).split("{count}");
  parts.forEach((part, i) => {
    parent.append(document.createTextNode(part));
    if (i < parts.length - 1) {
      const span = document.createElement("span");
      span.className = "count-value";
      span.textContent = countFormatted;
      parent.append(span);
    }
  });
}
