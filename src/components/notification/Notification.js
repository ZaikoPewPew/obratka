const SUCCESS_ICON = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M22 7L11.5 17.5L7.5 13.5M6 17.5L2 13.5M16.5 7L11.5 12" stroke="white" stroke-linecap="round" stroke-linejoin="round" />
</svg>
`;

let hideTimerId = null;

function ensureNotificationNode() {
  let node = document.querySelector(".notification-toast");
  if (node) {
    return node;
  }

  node = document.createElement("div");
  node.className = "notification-toast";
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");

  const text = document.createElement("span");
  text.className = "notification-toast__text";

  const icon = document.createElement("span");
  icon.className = "notification-toast__icon";
  icon.innerHTML = SUCCESS_ICON;

  node.append(text, icon);
  document.body.append(node);
  return node;
}

/**
 * Десктоп-тост для подтверждения успешного действия (например, отправки email).
 * @param {{ message: string; durationMs?: number }} opts
 */
export function showNotification({ message, durationMs = 2800 }) {
  if (!message) {
    return;
  }

  const node = ensureNotificationNode();
  const text = node.querySelector(".notification-toast__text");
  if (text) {
    text.textContent = message;
  }

  node.classList.add("notification-toast--visible");

  if (hideTimerId !== null) {
    window.clearTimeout(hideTimerId);
  }
  hideTimerId = window.setTimeout(() => {
    node.classList.remove("notification-toast--visible");
    hideTimerId = null;
  }, durationMs);
}
