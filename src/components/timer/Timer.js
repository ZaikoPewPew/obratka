/**
 * Обратный отсчёт до даты (обновление раз в секунду).
 * @param {{ endIso: string; className?: string; prefix?: string; daySuffix?: string }} opts
 * @returns {{ element: HTMLDivElement; destroy: () => void }}
 */
export function createTimer({
  endIso,
  className = "",
  prefix = "До старта:",
  daySuffix = "д",
}) {
  const root = document.createElement("div");
  root.className = className;
  root.setAttribute("role", "timer");
  root.setAttribute("aria-live", "off");

  const end = new Date(endIso).getTime();

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function format(ms) {
    if (ms <= 0) {
      return `${prefix} 0${daySuffix} 00:00:00`;
    }
    const s = Math.floor(ms / 1000);
    const days = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${prefix} ${days}${daySuffix} ${pad(h)}:${pad(m)}:${pad(sec)}`;
  }

  function tick() {
    const now = Date.now();
    root.textContent = format(end - now);
  }

  tick();
  const id = window.setInterval(tick, 1000);

  return {
    element: root,
    destroy() {
      window.clearInterval(id);
    },
  };
}
