const LANG_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3M12 21C9.4651 18.3899 8 15.3051 8 12C8 8.69488 9.4651 5.61005 12 3M12 21C14.5349 18.3899 16 15.3051 16 12C16 8.69488 14.5349 5.61005 12 3M20 9H4M20 15H4" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const LANG_ICON_MOBILE_SVG = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M9.41136 16.4707C13.3098 16.4707 16.4702 13.3103 16.4702 9.41185C16.4702 5.51337 13.3098 2.35303 9.41136 2.35303M9.41136 16.4707C5.51288 16.4707 2.35254 13.3103 2.35254 9.41185C2.35254 5.51337 5.51288 2.35303 9.41136 2.35303M9.41136 16.4707C7.4232 14.4236 6.27411 12.0041 6.27411 9.41185C6.27411 6.8196 7.4232 4.40013 9.41136 2.35303M9.41136 16.4707C11.3995 14.4236 12.5486 12.0041 12.5486 9.41185C12.5486 6.8196 11.3995 4.40013 9.41136 2.35303M15.6859 7.05891H3.13685M15.6859 11.7648H3.13685" stroke="currentColor" stroke-width="0.79167" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const CHECK_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M12.9997 4.6665L5.99967 11.6665L3.33301 8.99984" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" />
</svg>`;

const CHECK_SVG_MOBILE = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M19.5 7L9 17.5L5 13.5" stroke="#242426" stroke-width="1.01961" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/**
 * Круглая кнопка смены языка (иконка глобуса).
 * @param {{ ariaLabel: string; onClick: () => void; variant?: "desktop" | "mobile" }} opts
 * @returns {HTMLButtonElement}
 */
export function createLocaleToggleButton({ ariaLabel, onClick, variant = "desktop" }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    variant === "mobile" ? "locale-toggle locale-toggle--mobile" : "locale-toggle";
  btn.setAttribute("aria-label", ariaLabel);
  btn.innerHTML = variant === "mobile" ? LANG_ICON_MOBILE_SVG : LANG_ICON_SVG;
  btn.addEventListener("click", onClick);
  return btn;
}

/**
 * Десктоп: кнопка глобуса + всплывающий список языков (фиксировано справа с отступом 16px).
 * @param {{
 *   currentLocale: string;
 *   supportedLocales: string[];
 *   nativeNames: Record<string, string>;
 *   buttonAriaLabel: string;
 *   onSelect: (code: string) => void;
 * }} opts
 * @returns {HTMLDivElement}
 */
export function createDesktopLocaleDropdown({
  currentLocale,
  supportedLocales,
  nativeNames,
  buttonAriaLabel,
  onSelect,
}) {
  const root = document.createElement("div");
  root.className = "locale-dropdown";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "locale-toggle";
  btn.setAttribute("aria-label", buttonAriaLabel);
  btn.setAttribute("aria-haspopup", "listbox");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = LANG_ICON_SVG;

  const panel = document.createElement("div");
  panel.className = "locale-dropdown__panel";
  panel.setAttribute("role", "listbox");
  panel.setAttribute("aria-label", buttonAriaLabel);
  panel.hidden = true;

  const list = document.createElement("div");
  list.className = "locale-dropdown__list";

  for (const code of supportedLocales) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "locale-dropdown__option";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", code === currentLocale ? "true" : "false");
    row.dataset.locale = code;

    const label = document.createElement("span");
    label.className = "locale-dropdown__option-label";
    label.textContent = nativeNames[code] || code;

    const check = document.createElement("span");
    check.className = "locale-dropdown__check";
    check.innerHTML = CHECK_SVG;
    check.style.visibility = code === currentLocale ? "visible" : "hidden";

    row.append(label, check);
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      close();
      onSelect(code);
    });
    list.appendChild(row);
  }

  panel.appendChild(list);
  root.append(btn, panel);

  let docListenerAttached = false;

  function positionPanel() {
    const rect = btn.getBoundingClientRect();
    panel.style.top = `${rect.bottom + 12}px`;
    panel.style.right = "16px";
  }

  function onDocClick(e) {
    if (!root.contains(e.target)) {
      close();
    }
  }

  function onKeydown(e) {
    if (e.key === "Escape" && !panel.hidden) {
      e.preventDefault();
      close();
    }
  }

  function onResizeOrScroll() {
    if (!panel.hidden) {
      positionPanel();
    }
  }

  function open() {
    btn.classList.add("locale-toggle--open");
    btn.setAttribute("aria-expanded", "true");
    panel.hidden = false;
    positionPanel();
    if (!docListenerAttached) {
      docListenerAttached = true;
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onKeydown, true);
      window.addEventListener("resize", onResizeOrScroll);
      window.addEventListener("scroll", onResizeOrScroll, true);
    }
    queueMicrotask(() => {
      positionPanel();
    });
  }

  function close() {
    if (panel.hidden) {
      return;
    }
    btn.classList.remove("locale-toggle--open");
    btn.setAttribute("aria-expanded", "false");
    panel.hidden = true;
    if (docListenerAttached) {
      docListenerAttached = false;
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKeydown, true);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    }
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (panel.hidden) {
      open();
    } else {
      close();
    }
  });

  return root;
}

/**
 * Мобилка: кнопка глобуса + bottom sheet со списком языков.
 * @param {{
 *   currentLocale: string;
 *   supportedLocales: string[];
 *   nativeNames: Record<string, string>;
 *   buttonAriaLabel: string;
 *   closeSheetAria: string;
 *   onSelect: (code: string) => void;
 * }} opts
 * @returns {HTMLDivElement}
 */
export function createMobileLocaleSheet({
  currentLocale,
  supportedLocales,
  nativeNames,
  buttonAriaLabel,
  closeSheetAria,
  onSelect,
}) {
  const root = document.createElement("div");
  root.className = "locale-sheet";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "locale-toggle locale-toggle--mobile";
  btn.setAttribute("aria-label", buttonAriaLabel);
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = LANG_ICON_MOBILE_SVG;

  const overlay = document.createElement("div");
  overlay.className = "locale-sheet__overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");

  const spacer = document.createElement("button");
  spacer.type = "button";
  spacer.className = "locale-sheet__spacer";
  spacer.setAttribute("aria-label", closeSheetAria);

  const panel = document.createElement("div");
  panel.className = "locale-sheet__panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", buttonAriaLabel);

  const list = document.createElement("div");
  list.className = "locale-sheet__list";
  list.setAttribute("role", "listbox");

  for (const code of supportedLocales) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "locale-sheet__row";
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", code === currentLocale ? "true" : "false");

    const label = document.createElement("span");
    label.className = "locale-sheet__row-label";
    label.textContent = nativeNames[code] || code;

    const check = document.createElement("span");
    check.className = "locale-sheet__row-check";
    check.innerHTML = CHECK_SVG_MOBILE;
    check.style.visibility = code === currentLocale ? "visible" : "hidden";

    row.append(label, check);
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      close();
      onSelect(code);
    });
    list.appendChild(row);
  }

  panel.appendChild(list);
  overlay.append(spacer, panel);
  root.append(btn);
  /* Портал в body: иначе оверлей ограничен z-index шапки (.mobile-top) и оказывается под hero/формой */
  overlay.classList.add("locale-sheet__overlay--portal");
  document.body.appendChild(overlay);

  let docEscAttached = false;
  /** @type {ReturnType<typeof window.setTimeout> | null} */
  let hideOverlayTimer = null;
  let sheetOpening = false;
  const SHEET_TRANSITION_MS = 320;

  function sheetIsVisible() {
    return overlay.classList.contains("locale-sheet__overlay--visible");
  }

  function sheetIsOpenOrOpening() {
    return sheetIsVisible() || sheetOpening;
  }

  function onKeydown(e) {
    if (e.key === "Escape" && sheetIsOpenOrOpening()) {
      e.preventDefault();
      close();
    }
  }

  function open() {
    if (hideOverlayTimer) {
      clearTimeout(hideOverlayTimer);
      hideOverlayTimer = null;
    }
    sheetOpening = true;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    btn.classList.add("locale-toggle--open");
    btn.setAttribute("aria-expanded", "true");
    document.body.classList.add("locale-sheet-open");
    if (!docEscAttached) {
      docEscAttached = true;
      document.addEventListener("keydown", onKeydown, true);
    }
    queueMicrotask(() => {
      overlay.classList.add("locale-sheet__overlay--visible");
      sheetOpening = false;
    });
  }

  function close() {
    if (overlay.hidden) {
      return;
    }
    if (!sheetIsVisible() && !sheetOpening) {
      return;
    }
    sheetOpening = false;
    overlay.classList.remove("locale-sheet__overlay--visible");
    btn.classList.remove("locale-toggle--open");
    btn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("locale-sheet-open");
    if (docEscAttached) {
      docEscAttached = false;
      document.removeEventListener("keydown", onKeydown, true);
    }
    hideOverlayTimer = window.setTimeout(() => {
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
      hideOverlayTimer = null;
    }, SHEET_TRANSITION_MS);
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (sheetIsOpenOrOpening()) {
      close();
    } else {
      open();
    }
  });

  spacer.addEventListener("click", () => {
    close();
  });

  return root;
}
