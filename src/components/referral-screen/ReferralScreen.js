import { getStrings } from "../../i18n.js";
import { createBrandScreenShell } from "../brand-screen-shell/BrandScreenShell.js";

/**
 * Экран реферальной ссылки / кода.
 * Stub: каркас на brand-shell; поле и валидация — при реализации UI.
 *
 * @param {{ onSubmit: (referral: string) => void | Promise<void> }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: (prefill?: string) => void;
 *   close: () => Promise<void>;
 * }}
 */
export function createReferralScreen({ onSubmit }) {
  const t = getStrings();

  const block = document.createElement("div");
  block.className = "brand-screen__block referral-screen__block";

  const title = document.createElement("h1");
  title.className = "brand-screen__title";
  title.id = "referral-screen-title";
  title.textContent = t.referralTitle;

  const hint = document.createElement("p");
  hint.className = "referral-screen__stub-hint";
  hint.textContent = t.referralStubHint;

  block.append(title, hint);

  const shell = createBrandScreenShell({
    labelledById: "referral-screen-title",
    content: block,
  });

  /**
   * @param {string} [prefill]
   */
  function open(prefill = "") {
    void prefill;
    void onSubmit;
    shell.open();
  }

  return {
    root: shell.root,
    open,
    close: shell.close,
  };
}
