/**
 * Сегментированный tabs-panel (Figma `tabspanel` 476:1762).
 * Shared UI: не пишет history / go(), только onChange наверх.
 * Активный фон — скользящий thumb (как home tabbar).
 *
 * @param {{
 *   tabs: Array<{ id: string; label?: string }>;
 *   activeId?: string;
 *   ariaLabel?: string;
 *   onChange?: (id: string) => void;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   setActive: (id: string, opts?: { instant?: boolean }) => void;
 *   getActive: () => string;
 *   setLabels: (labels: Record<string, string>) => void;
 *   setAriaLabel: (label: string) => void;
 *   syncThumb: (instant?: boolean) => void;
 * }}
 */
export function createTabsPanel({
  tabs,
  activeId,
  ariaLabel,
  onChange,
} = {}) {
  const tabDefs = Array.isArray(tabs) ? tabs.filter((t) => t?.id) : [];
  let currentId =
    (activeId && tabDefs.some((t) => t.id === activeId) && activeId) ||
    tabDefs[0]?.id ||
    "";

  const root = document.createElement("div");
  root.className = "tabs-panel";
  root.setAttribute("role", "tablist");
  if (ariaLabel) {
    root.setAttribute("aria-label", ariaLabel);
  }

  const thumb = document.createElement("div");
  thumb.className = "tabs-panel__thumb";
  thumb.setAttribute("aria-hidden", "true");
  root.append(thumb);

  /** @type {Map<string, HTMLButtonElement>} */
  const buttons = new Map();

  for (const tab of tabDefs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tabs-panel__tab";
    btn.setAttribute("role", "tab");
    btn.dataset.tab = tab.id;
    btn.textContent = typeof tab.label === "string" ? tab.label : "";
    btn.addEventListener("click", () => {
      if (btn.dataset.tab === currentId) return;
      setActive(tab.id);
      onChange?.(tab.id);
    });
    buttons.set(tab.id, btn);
    root.append(btn);
  }

  /**
   * Скользящий пилл активного таба.
   * @param {boolean} [instant]
   */
  function syncThumb(instant = false) {
    const activeBtn = buttons.get(currentId);
    if (!activeBtn) return;
    if (root.hidden) return;
    const barRect = root.getBoundingClientRect();
    const tabRect = activeBtn.getBoundingClientRect();
    if (!barRect.width || !tabRect.width) return;
    const left = tabRect.left - barRect.left;
    if (instant) {
      thumb.style.transition = "none";
    }
    thumb.style.width = `${tabRect.width}px`;
    thumb.style.transform = `translateX(${left}px)`;
    if (instant) {
      void thumb.offsetWidth;
      thumb.style.transition = "";
    }
  }

  /**
   * @param {boolean} [instant]
   */
  function scheduleThumbSync(instant = false) {
    requestAnimationFrame(() => {
      syncThumb(instant);
    });
  }

  /**
   * @param {string} id
   * @param {{ instant?: boolean }} [opts]
   */
  function setActive(id, opts = {}) {
    if (!buttons.has(id)) return;
    const instant = opts.instant === true;
    currentId = id;
    for (const [tabId, btn] of buttons) {
      const selected = tabId === currentId;
      btn.classList.toggle("tabs-panel__tab--active", selected);
      btn.setAttribute("aria-selected", selected ? "true" : "false");
      btn.tabIndex = selected ? 0 : -1;
    }
    scheduleThumbSync(instant);
  }

  /**
   * @param {Record<string, string>} labels
   */
  function setLabels(labels) {
    if (!labels || typeof labels !== "object") return;
    for (const [id, label] of Object.entries(labels)) {
      const btn = buttons.get(id);
      if (btn && typeof label === "string") {
        btn.textContent = label;
      }
    }
    scheduleThumbSync();
  }

  /**
   * @param {string} label
   */
  function setAriaLabel(label) {
    if (typeof label === "string" && label) {
      root.setAttribute("aria-label", label);
      return;
    }
    root.removeAttribute("aria-label");
  }

  if (typeof ResizeObserver === "function") {
    const resize = new ResizeObserver(() => {
      syncThumb(true);
    });
    resize.observe(root);
    for (const btn of buttons.values()) {
      resize.observe(btn);
    }
  }

  window.addEventListener("resize", () => {
    scheduleThumbSync(true);
  });

  setActive(currentId, { instant: true });

  return {
    root,
    setActive,
    getActive: () => currentId,
    setLabels,
    setAriaLabel,
    syncThumb,
  };
}
