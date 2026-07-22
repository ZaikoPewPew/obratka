import { getStrings } from "../../i18n.js";
import { createBrandScreenShell } from "../brand-screen-shell/BrandScreenShell.js";

/**
 * Онбординг: вопросы слева, brand visual справа.
 * Stub: каркас; шаги из content/onboarding.json — при реализации.
 *
 * @param {{
 *   onComplete: (answers: Record<string, unknown>) => void | Promise<void>;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: () => void;
 *   close: () => Promise<void>;
 * }}
 */
export function createOnboardingScreen({ onComplete }) {
  const t = getStrings();

  const block = document.createElement("div");
  block.className = "brand-screen__block onboarding-screen__block";

  const title = document.createElement("h1");
  title.className = "brand-screen__title";
  title.id = "onboarding-screen-title";
  title.textContent = t.onboardingTitle;

  const hint = document.createElement("p");
  hint.className = "onboarding-screen__stub-hint";
  hint.textContent = t.onboardingStubHint;

  const nav = document.createElement("div");
  nav.className = "onboarding-screen__nav";
  nav.dataset.role = "nav-stub";

  block.append(title, hint, nav);

  const shell = createBrandScreenShell({
    labelledById: "onboarding-screen-title",
    content: block,
  });

  function open() {
    void onComplete;
    shell.open();
  }

  return {
    root: shell.root,
    open,
    close: shell.close,
  };
}
