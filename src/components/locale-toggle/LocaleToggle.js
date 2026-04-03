const LANG_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3M12 21C9.4651 18.3899 8 15.3051 8 12C8 8.69488 9.4651 5.61005 12 3M12 21C14.5349 18.3899 16 15.3051 16 12C16 8.69488 14.5349 5.61005 12 3M20 9H4M20 15H4" stroke="#242426" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const LANG_ICON_MOBILE_SVG = `<svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M9.41136 16.4707C13.3098 16.4707 16.4702 13.3103 16.4702 9.41185C16.4702 5.51337 13.3098 2.35303 9.41136 2.35303M9.41136 16.4707C5.51288 16.4707 2.35254 13.3103 2.35254 9.41185C2.35254 5.51337 5.51288 2.35303 9.41136 2.35303M9.41136 16.4707C7.4232 14.4236 6.27411 12.0041 6.27411 9.41185C6.27411 6.8196 7.4232 4.40013 9.41136 2.35303M9.41136 16.4707C11.3995 14.4236 12.5486 12.0041 12.5486 9.41185C12.5486 6.8196 11.3995 4.40013 9.41136 2.35303M15.6859 7.05891H3.13685M15.6859 11.7648H3.13685" stroke="#242426" stroke-width="1.01961" stroke-linecap="round" stroke-linejoin="round" />
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
