import logoUrl from "../logo.svg?url";
import {
  getLocale,
  getNextLocale,
  getStrings,
  getStartups,
  LOCALE_NATIVE_NAMES,
  setLocale,
} from "./i18n.js";
import { getFormattedStartupCount } from "./components/startup-count/startupCount.js";
import { createLogo } from "./components/logo/Logo.js";
import { createLocaleToggleButton } from "./components/locale-toggle/LocaleToggle.js";
import { createWaitlistCounter } from "./components/waitlist-counter/WaitlistCounter.js";
import {
  createApplyCard,
  createApplyCardForm,
  createApplyCardHero,
} from "./components/apply-card/ApplyCard.js";
import {
  createAmbientFallLayer,
  createStartupFallItem,
  PHYSICS_CARDS_PER_SIDE,
} from "./components/startup-card/StartupCard.js";
import { initStartupRainPhysics } from "./startup-rain-physics.js";
import { fetchSubscribersCount, saveSubscriber } from "./api/subscribers.js";
import { setDbSubscriberCountAndRefresh } from "./utils/foundersCountDisplay.js";
import { fireEmailSubmitConfetti } from "./utils/emailSubmitConfetti.js";
import { isValidEmail, normalizeEmail } from "./utils/emailValidation.js";

/** Минимальный интервал между запросами подписки с одной вкладки (анти-спам). */
const EMAIL_SUBMIT_MIN_GAP_MS = 4000;

/** Нормализованный email последней успешной вставки (201); повтор того же адреса — без лишнего POST. */
const WAITLIST_SUBMITTED_STORAGE_KEY = "memento.waitlistSubmitted";

let emailSubmitInFlight = false;
let emailSubmitNextAllowedAt = 0;

/** @returns {string | null} нормализованный email или null (нет / legacy «1»). */
function getWaitlistSubmittedEmail() {
  try {
    const v = window.localStorage.getItem(WAITLIST_SUBMITTED_STORAGE_KEY);
    if (!v) {
      return null;
    }
    if (v === "1") {
      window.localStorage.removeItem(WAITLIST_SUBMITTED_STORAGE_KEY);
      return null;
    }
    return normalizeEmail(v);
  } catch {
    return null;
  }
}

function markWaitlistSubmittedEmail(email) {
  try {
    window.localStorage.setItem(WAITLIST_SUBMITTED_STORAGE_KEY, normalizeEmail(email));
  } catch {
    /* ignore */
  }
}

function interpolateSeconds(template, seconds) {
  return String(template || "").replace(/\{seconds\}/g, String(seconds));
}

/** Красная подпись под полем, как при кулдауне; через `input` восстанавливается штатный текст. */
function flashEmailFieldCaptionError(input, message) {
  const block = input?.closest(".email-field-block");
  const caption = block?.querySelector(".email-avatars__caption");
  if (!caption || !message) {
    return;
  }
  caption.textContent = message;
  caption.classList.add("email-avatars__caption--error");
  window.setTimeout(() => {
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  }, 2800);
}

/** Ошибка от API (409, сеть и т.д.): подпись + рамка до следующего ввода в поле. */
function showEmailSubmitServerMessage(shell, input, message) {
  shell.classList.add("email-input-shell--server-message");
  const block = input.closest(".email-field-block");
  const caption = block?.querySelector(".email-avatars__caption");
  if (caption && message) {
    caption.textContent = message;
    caption.classList.add("email-avatars__caption--error");
  }
  input.setAttribute("aria-invalid", "true");
}

function mountLogos(brandName) {
  document.querySelectorAll('[data-mount="logo"]').forEach((node) => {
    const w = Number(node.dataset.width) || 64;
    const h = Number(node.dataset.height) || 64;
    const className = node.dataset.logoClass || "";
    const img = createLogo({
      src: logoUrl,
      alt: brandName,
      width: w,
      height: h,
      className,
      useMaskHover: className === "desktop-logo",
    });
    node.replaceWith(img);
  });
}

/** Слот data-mount="header-actions": бейдж счётчика + кнопка языка (8px между ними; кнопка справа). */
function mountHeaderActions(t, locale) {
  const formatted = getFormattedStartupCount(locale);
  const nextLocale = getNextLocale(locale);
  const nextNative = LOCALE_NATIVE_NAMES[nextLocale] || nextLocale;
  const langAria = String(t.langSwitchAria || "").replace(/\{next\}/g, nextNative);

  document.querySelectorAll('[data-mount="header-actions"]').forEach((node) => {
    const variant = node.dataset.headerVariant || "desktop";
    const isMobile = variant === "mobile";
    const actions = document.createElement("div");
    actions.className = isMobile
      ? "header-actions header-actions--mobile"
      : "header-actions header-actions--desktop";

    const langBtn = createLocaleToggleButton({
      ariaLabel: langAria,
      onClick: () => setLocale(nextLocale),
      variant: isMobile ? "mobile" : "desktop",
    });

    const timerClass = isMobile
      ? "mobile-timer desktop-counter"
      : "desktop-timer desktop-counter";
    const timer = createWaitlistCounter({
      template: t.timerBadge,
      countFormatted: formatted,
      className: timerClass,
    });

    actions.append(timer, langBtn);
    node.replaceWith(actions);
  });
}

function mountSiteFooter(t) {
  document.querySelectorAll('[data-mount="site-footer"]').forEach((node) => {
    if (node.closest(".layout-mobile")) {
      node.remove();
      return;
    }
    const footer = document.createElement("footer");
    footer.className = "site-footer";

    const copy = document.createElement("span");
    copy.className = "site-footer__copy";
    copy.textContent = t.footerCopyright;

    const contacts = document.createElement("a");
    contacts.className = "site-footer__contacts";
    contacts.href = "#";
    contacts.textContent = t.footerContacts;

    footer.append(copy, contacts);
    node.replaceWith(footer);
  });
}

function mountStartupFallBack() {
  const { items = [] } = getStartups();
  document.querySelectorAll('[data-mount="startup-fall-back"]').forEach((node) => {
    const layer = document.createElement("div");
    layer.className = "startup-fall-back";
    layer.append(createAmbientFallLayer(items));
    node.replaceWith(layer);
  });
}

function mountStartupFall() {
  const { items = [] } = getStartups();
  const pool = items.length ? items : [];
  const total = PHYSICS_CARDS_PER_SIDE * 2;
  const list =
    pool.length > 0
      ? Array.from({ length: total }, (_, i) => pool[i % pool.length])
      : [];
  document.querySelectorAll('[data-mount="startup-fall"]').forEach((node) => {
    const layer = document.createElement("div");
    layer.className = "startup-fall";
    layer.dataset.physicsPerSide = String(PHYSICS_CARDS_PER_SIDE);
    list.forEach((item, i) => {
      layer.append(createStartupFallItem(item, i, { perSide: PHYSICS_CARDS_PER_SIDE }));
    });
    node.replaceWith(layer);
  });
}

function mountApplyCards(t, locale) {
  const desktopMount = document.querySelector('.layout-desktop [data-mount="apply-card"]');
  if (desktopMount) {
    desktopMount.replaceWith(createApplyCard({ t, locale }));
  }

  const heroMount = document.querySelector('.layout-mobile [data-mount="apply-hero"]');
  const formMount = document.querySelector('.layout-mobile [data-mount="apply-form"]');
  if (heroMount) {
    heroMount.replaceWith(createApplyCardHero({ t, locale }));
  }
  if (formMount) {
    formMount.replaceWith(createApplyCardForm({ t, locale }));
  }
}

function init() {
  const locale = getLocale();
  document.documentElement.lang = locale;

  const t = getStrings(locale);

  mountLogos(t.brandName);
  mountHeaderActions(t, locale);
  mountStartupFallBack();
  mountStartupFall();
  mountApplyCards(t, locale);
  mountSiteFooter(t);

  fetchSubscribersCount().then((count) => {
    setDbSubscriberCountAndRefresh(
      count !== null && Number.isFinite(count) && count >= 0 ? count : undefined,
    );
  });

  document.addEventListener("email-submit", async (e) => {
    const email = e.detail?.value;
    if (!email || !(e.target instanceof Element)) {
      return;
    }
    const source = e.target.closest(".access-modal") ? "buy_intent" : "email_form";
    const shell = e.target.closest(".email-input-shell");
    const input = e.target.closest("input.email-input");

    if (!isValidEmail(email)) {
      if (shell) {
        shell.classList.add("email-input-shell--invalid");
      }
      if (input) {
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }

    const now = Date.now();
    if (emailSubmitInFlight) {
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const lockedEmail = getWaitlistSubmittedEmail();
    if (lockedEmail && normalizedEmail === lockedEmail) {
      flashEmailFieldCaptionError(input, t.emailAlreadySubmitted);
      return;
    }

    if (now < emailSubmitNextAllowedAt) {
      const waitSec = Math.max(1, Math.ceil((emailSubmitNextAllowedAt - now) / 1000));
      flashEmailFieldCaptionError(
        input,
        interpolateSeconds(t.emailSubmitCooldown, waitSec),
      );
      return;
    }

    emailSubmitInFlight = true;
    /** @type {{ ok: boolean; newSubscriber?: boolean }} */
    let saveResult = { ok: false };
    try {
      saveResult = await saveSubscriber(email, source);
    } finally {
      emailSubmitInFlight = false;
      emailSubmitNextAllowedAt = Date.now() + EMAIL_SUBMIT_MIN_GAP_MS;
    }

    if (saveResult.ok) {
      if (saveResult.newSubscriber) {
        markWaitlistSubmittedEmail(email);
      }
      fireEmailSubmitConfetti(shell);
      if (input) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } else if (shell && input) {
      showEmailSubmitServerMessage(shell, input, t.emailSubmitFailed);
    }
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initStartupRainPhysics();
    });
  });

  document.title = t.metaTitle;
}

init();
