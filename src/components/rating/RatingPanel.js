/**
 * Рейтинг на главной: топ пользователей по игровой валюте (активные).
 * Пока заглушка — не монтируется в home-screen (контент позже).
 *
 * @returns {{
 *   root: HTMLElement;
 * }}
 */
export function createRatingPanel() {
  const root = document.createElement("aside");
  root.className = "rating-panel";
  root.hidden = true;
  root.setAttribute("aria-hidden", "true");

  const panel = document.createElement("div");
  panel.className = "rating-panel__surface";
  root.append(panel);

  return { root };
}
