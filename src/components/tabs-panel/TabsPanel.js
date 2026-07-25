/**
 * Сегментированный tabs-panel (Figma `tabspanel` 476:1762).
 * Shared UI: не пишет history / go(), только onChange наверх.
 *
 * @param {{
 *   tabs: Array<{ id: string; label?: string }>;
 *   activeId?: string;
 *   ariaLabel?: string;
 *   onChange?: (id: string) => void;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   setActive: (id: string) => void;
 *   getActive: () => string;
 *   setLabels: (labels: Record<string, string>) => void;
 *   setAriaLabel: (label: string) => void;
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
   * @param {string} id
   */
  function setActive(id) {
    if (!buttons.has(id)) return;
    currentId = id;
    for (const [tabId, btn] of buttons) {
      const selected = tabId === currentId;
      btn.classList.toggle("tabs-panel__tab--active", selected);
      btn.setAttribute("aria-selected", selected ? "true" : "false");
      btn.tabIndex = selected ? 0 : -1;
    }
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

  setActive(currentId);

  return {
    root,
    setActive,
    getActive: () => currentId,
    setLabels,
    setAriaLabel,
  };
}
