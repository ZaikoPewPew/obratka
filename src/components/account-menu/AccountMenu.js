import { getSession } from "../../app/session.js";
import { getStrings } from "../../i18n.js";

/**
 * Fallback закрытия меню ≈ CSS-duration + небольшой запас.
 * @returns {number}
 */
function getAccountMenuCloseFallbackMs() {
  if (typeof document === "undefined") return 260;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--account-menu-motion-duration")
    .trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 260;
  const ms = raw.endsWith("s") && !raw.endsWith("ms") ? value * 1000 : value;
  return Math.max(120, Math.round(ms + 80));
}

/**
 * Выпадающее меню аккаунта под аватаром.
 *
 * @param {{
 *   onSettings?: () => void | Promise<void>;
 *   onInvite?: () => void | Promise<void>;
 *   onContacts?: () => void | Promise<void>;
 *   onSignOut?: () => void | Promise<void>;
 *   onClose?: () => void;
 * }} [opts]
 */
export function createAccountMenu(opts = {}) {
  let closing = false;
  let openFrame = 0;

  const root = document.createElement("div");
  root.className = "account-menu";
  root.hidden = true;
  root.setAttribute("role", "menu");
  root.setAttribute("aria-hidden", "true");

  const identity = document.createElement("div");
  identity.className = "account-menu__identity";

  const displayName = document.createElement("p");
  displayName.className = "account-menu__name";

  const email = document.createElement("p");
  email.className = "account-menu__email";

  identity.append(displayName, email);

  const firstDivider = document.createElement("div");
  firstDivider.className = "account-menu__divider";
  firstDivider.setAttribute("aria-hidden", "true");

  const actions = document.createElement("div");
  actions.className = "account-menu__actions";

  const settingsBtn = document.createElement("button");
  settingsBtn.type = "button";
  settingsBtn.className = "account-menu__action";
  settingsBtn.setAttribute("role", "menuitem");

  const inviteBtn = document.createElement("button");
  inviteBtn.type = "button";
  inviteBtn.className = "account-menu__action";
  inviteBtn.setAttribute("role", "menuitem");

  const contactsBtn = document.createElement("button");
  contactsBtn.type = "button";
  contactsBtn.className = "account-menu__action";
  contactsBtn.setAttribute("role", "menuitem");

  actions.append(settingsBtn, inviteBtn, contactsBtn);

  const secondDivider = document.createElement("div");
  secondDivider.className = "account-menu__divider";
  secondDivider.setAttribute("aria-hidden", "true");

  const signOutBtn = document.createElement("button");
  signOutBtn.type = "button";
  signOutBtn.className = "account-menu__action account-menu__action--sign-out";
  signOutBtn.setAttribute("role", "menuitem");

  root.append(identity, firstDivider, actions, secondDivider, signOutBtn);

  function syncContent() {
    const t = getStrings();
    const session = getSession();
    const name =
      typeof session?.displayName === "string"
        ? session.displayName.trim()
        : "";
    const accountEmail =
      typeof session?.email === "string" ? session.email.trim() : "";

    displayName.textContent = name || t.homeAccountNameFallback || "";
    email.textContent = accountEmail || t.homeAccountEmailFallback || "";
    settingsBtn.textContent = t.homeAccountSettings ?? "";
    inviteBtn.textContent = t.homeAccountInvite ?? "";
    contactsBtn.textContent = t.homeAccountContacts ?? "";
    signOutBtn.textContent = t.homeAccountSignOut ?? "";
    signOutBtn.disabled = false;
    root.setAttribute("aria-label", t.homeAccountMenuAria ?? "");
  }

  function isOpen() {
    return !root.hidden && root.classList.contains("account-menu--open");
  }

  function open() {
    if (isOpen()) return;
    closing = false;
    syncContent();
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    root.classList.remove("account-menu--open");

    openFrame = requestAnimationFrame(() => {
      openFrame = requestAnimationFrame(() => {
        openFrame = 0;
        root.classList.add("account-menu--open");
      });
    });
  }

  function close() {
    if (root.hidden || closing) return Promise.resolve();
    closing = true;
    if (openFrame) {
      cancelAnimationFrame(openFrame);
      openFrame = 0;
    }
    root.classList.remove("account-menu--open");
    root.setAttribute("aria-hidden", "true");

    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        root.removeEventListener("transitionend", onEnd);
        window.clearTimeout(fallbackId);
        root.hidden = true;
        closing = false;
        opts.onClose?.();
        resolve();
      };
      const onEnd = (event) => {
        if (event.target === root && event.propertyName === "opacity") {
          finish();
        }
      };
      root.addEventListener("transitionend", onEnd);
      const fallbackId = window.setTimeout(finish, getAccountMenuCloseFallbackMs());
    });
  }

  function toggle() {
    if (isOpen()) return close();
    open();
    return Promise.resolve();
  }

  settingsBtn.addEventListener("click", () => {
    void close().then(() => opts.onSettings?.());
  });

  inviteBtn.addEventListener("click", () => {
    void close().then(() => opts.onInvite?.());
  });

  contactsBtn.addEventListener("click", () => {
    void close().then(() => opts.onContacts?.());
  });

  signOutBtn.addEventListener("click", () => {
    signOutBtn.disabled = true;
    void close().then(() => opts.onSignOut?.());
  });

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    void close();
  });

  return {
    root,
    open,
    close,
    toggle,
    isOpen,
    focusFirst: () => settingsBtn.focus(),
    syncContent,
  };
}
