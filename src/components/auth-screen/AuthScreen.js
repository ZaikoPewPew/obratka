import { getStrings } from "../../i18n.js";
import { createBrandScreenShell } from "../brand-screen-shell/BrandScreenShell.js";

/**
 * @typedef {'sign-in' | 'sign-up'} AuthMode
 */

/**
 * Экран входа / регистрации.
 * Stub: каркас на brand-shell; форма и API — при реализации.
 *
 * @param {{
 *   onSuccess: (session: unknown) => void | Promise<void>;
 *   mode?: AuthMode;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: (mode?: AuthMode) => void;
 *   close: () => Promise<void>;
 *   setMode: (mode: AuthMode) => void;
 * }}
 */
export function createAuthScreen({ onSuccess, mode: initialMode = "sign-up" }) {
  const t = getStrings();
  /** @type {AuthMode} */
  let mode = initialMode;

  const block = document.createElement("div");
  block.className = "brand-screen__block auth-screen__block";

  const title = document.createElement("h1");
  title.className = "brand-screen__title";
  title.id = "auth-screen-title";

  const hint = document.createElement("p");
  hint.className = "auth-screen__stub-hint";
  hint.textContent = t.authStubHint;

  block.append(title, hint);

  const shell = createBrandScreenShell({
    labelledById: "auth-screen-title",
    content: block,
  });

  function syncTitle() {
    title.textContent =
      mode === "sign-in" ? t.authSignInTitle : t.authSignUpTitle;
  }

  /**
   * @param {AuthMode} next
   */
  function setMode(next) {
    mode = next;
    syncTitle();
  }

  /**
   * @param {AuthMode} [nextMode]
   */
  function open(nextMode) {
    if (nextMode) setMode(nextMode);
    else syncTitle();
    void onSuccess;
    shell.open();
  }

  syncTitle();

  return {
    root: shell.root,
    open,
    close: shell.close,
    setMode,
  };
}
