import { inject, track } from "@vercel/analytics";
import logoUrl from "../logo.svg?url";
import {
  getLocale,
  getStrings,
  getStartups,
  getSupportedLocales,
  LOCALE_NATIVE_NAMES,
  setLocale,
} from "./i18n.js";
import { attachPrivacyPolicyPanel } from "./components/privacy-policy/PrivacyPolicyPanel.js";
import { getFormattedStartupCount } from "./components/startup-count/startupCount.js";
import { createLogo } from "./components/logo/Logo.js";
import {
  createDesktopLocaleDropdown,
  createMobileHeaderMenu,
  createMobileLocaleSheet,
} from "./components/locale-toggle/LocaleToggle.js";
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
import { showNotification } from "./components/notification/Notification.js";

inject();

/** Минимальный интервал между запросами подписки с одной вкладки (анти-спам). */
const EMAIL_SUBMIT_MIN_GAP_MS = 4000;

/** Нормализованный email последней успешной вставки (201); повтор того же адреса — без лишнего POST. */
const WAITLIST_SUBMITTED_STORAGE_KEY = "memento.waitlistSubmitted";
const HOVER_SOUND_SRC = "/sounds/hover.wav";
const CLICK_SOUND_SRC = "/sounds/click.wav";
const POP_SOUND_SRC = "/sounds/pop.wav";
const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";
const CONTACT_EMAIL = "vlad.kveasy@gmail.com";
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`;

let emailSubmitInFlight = false;
let emailSubmitNextAllowedAt = 0;
let hasTrackedEmailInputFocus = false;
let hoverAudio = null;
let hoverAudioReady = false;
let clickAudio = null;
let clickAudioReady = false;
let popAudio = null;

function isDesktopViewport() {
  try {
    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
  } catch {
    return window.innerWidth >= 768;
  }
}

function ensureHoverAudio() {
  if (!hoverAudio) {
    hoverAudio = new Audio(HOVER_SOUND_SRC);
    hoverAudio.preload = "auto";
    hoverAudio.volume = 0.02;
  }
  return hoverAudio;
}

function playHoverSound() {
  if (!isDesktopViewport()) {
    return;
  }
  const audio = ensureHoverAudio();
  try {
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {});
    }
    hoverAudioReady = true;
  } catch {
    /* ignore */
  }
}

function ensureClickAudio() {
  if (!clickAudio) {
    clickAudio = new Audio(CLICK_SOUND_SRC);
    clickAudio.preload = "auto";
    clickAudio.volume = 0.1;
  }
  return clickAudio;
}

function playClickSound() {
  if (!isDesktopViewport()) {
    return;
  }
  const audio = ensureClickAudio();
  try {
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {});
    }
    clickAudioReady = true;
  } catch {
    /* ignore */
  }
}

function ensurePopAudio() {
  if (!popAudio) {
    popAudio = new Audio(POP_SOUND_SRC);
    popAudio.preload = "auto";
    popAudio.volume = 0.1;
  }
  return popAudio;
}

function playPopSound() {
  const audio = ensurePopAudio();
  try {
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/**
 * Десктоп hover-звук для интерактивных элементов шапки/карточки/футера.
 * Делегирование нужно, чтобы покрывать динамически созданные узлы (например, пункты языков).
 */
function initDesktopHoverSound() {
  const selectors = [
    ".layout-desktop .desktop-logo",
    ".layout-desktop .apply-card__cta",
    ".layout-desktop .site-footer__contacts",
    ".layout-desktop .site-footer__privacy",
    ".layout-desktop .locale-dropdown .locale-toggle",
    ".locale-dropdown__option",
    ".access-modal .access-modal__close",
    ".privacy-panel .access-modal__close",
  ];
  const interactiveSelector = selectors.join(", ");

  const onFirstPointerDown = () => {
    if (!isDesktopViewport()) {
      return;
    }
    const audio = ensureHoverAudio();
    if (hoverAudioReady) {
      return;
    }
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        audio.pause();
        audio.currentTime = 0;
        hoverAudioReady = true;
      }).catch(() => {});
    }
  };

  document.addEventListener("pointerdown", onFirstPointerDown, { once: true, passive: true });
  document.addEventListener("mouseover", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const target = event.target.closest(interactiveSelector);
    if (!target) {
      return;
    }
    const previous = event.relatedTarget;
    if (previous instanceof Node && target.contains(previous)) {
      return;
    }
    playHoverSound();
  });
}

/**
 * Десктоп click-звук для CTA/футера/языка и пунктов выбора языка.
 * capture=true нужен, чтобы поймать клики по пунктам, где есть stopPropagation().
 */
function initDesktopClickSound() {
  const selectors = [
    ".layout-desktop .desktop-logo",
    ".layout-desktop .desktop-logo__fill",
    ".layout-desktop .apply-card__cta",
    ".layout-desktop .site-footer__contacts",
    ".layout-desktop .site-footer__privacy",
    ".layout-desktop .email-input-shell",
    ".access-modal .email-input-shell",
    ".layout-desktop .locale-dropdown .locale-toggle",
    ".locale-dropdown__option",
    ".access-modal .access-modal__close",
    ".privacy-panel .access-modal__close",
  ];
  const interactiveSelector = selectors.join(", ");

  const onFirstPointerDown = () => {
    if (!isDesktopViewport()) {
      return;
    }
    const audio = ensureClickAudio();
    if (clickAudioReady) {
      return;
    }
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        audio.pause();
        audio.currentTime = 0;
        clickAudioReady = true;
      }).catch(() => {});
    }
  };

  document.addEventListener("pointerdown", onFirstPointerDown, { once: true, passive: true });
  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const target = event.target.closest(interactiveSelector);
      if (!target) {
        return;
      }
      playClickSound();
    },
    true,
  );
}

/**
 * Безопасный вызов кастомных событий Vercel Analytics (не ломает UX, если события недоступны по тарифу).
 * @param {string} name
 * @param {Record<string, string | number | boolean>} [properties]
 */
function safeTrack(name, properties = {}) {
  try {
    track(name, properties);
  } catch {
    /* ignore */
  }
}

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

/**
 * Волна снизу вверх: сначала нижняя часть экрана, затем выше; внутри карточки — от email к заголовку.
 * Визуально — «выплывание» из лёгкого размытия (см. styles/entrance.css).
 */
function initEntranceAnimations() {
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  const baseMs = 48;
  const stepMs = 78;
  let index = 0;

  /** @param {Element | null | undefined} el */
  function reveal(el) {
    if (!el || !(el instanceof Element)) {
      return;
    }
    el.classList.add("reveal-on-load");
    el.style.setProperty("--reveal-delay", `${baseMs + index * stepMs}ms`);
    index += 1;
  }

  if (!isMobile) {
    const layout = document.querySelector(".layout-desktop");
    if (!layout || getComputedStyle(layout).display === "none") {
      return;
    }

    const top = layout.querySelector(".desktop-top");
    const footer = layout.querySelector(".site-footer");
    const card = layout.querySelector(".apply-card:not(.apply-card--mobile)");

    if (footer) {
      for (const child of footer.children) {
        reveal(child);
      }
    }
    if (card) {
      for (const child of [...card.children].reverse()) {
        reveal(child);
      }
    }
    reveal(top?.querySelector(".header-actions--desktop .desktop-timer"));
    reveal(top?.querySelector(".header-actions--desktop .locale-dropdown"));
    reveal(top?.querySelector(".desktop-logo"));
    return;
  }

  const layout = document.querySelector(".layout-mobile");
  if (!layout || getComputedStyle(layout).display === "none") {
    return;
  }

  const header = layout.querySelector(".header-actions--mobile");
  const hero = layout.querySelector(".mobile-hero");
  const heroCard = hero?.querySelector(".apply-card--hero");
  const form = layout.querySelector(".mobile-apply-form");

  if (form) {
    for (const child of [...form.children].reverse()) {
      reveal(child);
    }
  }
  reveal(layout.querySelector(".mobile-stage__logos"));
  if (heroCard) {
    for (const child of [...heroCard.children].reverse()) {
      reveal(child);
    }
  }
  reveal(hero?.querySelector(".mobile-logo"));
  reveal(header?.querySelector(".mobile-timer"));
  reveal(header?.querySelector(".mobile-header-menu"));
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
  const langMenuAria = String(t.langMenuButtonAria || "Language");
  const closeSheetAria = String(t.accessModalCloseAria || "Close");
  const hiddenPrivacyTrigger = document.createElement("button");
  hiddenPrivacyTrigger.type = "button";
  hiddenPrivacyTrigger.style.display = "none";
  attachPrivacyPolicyPanel(hiddenPrivacyTrigger, t, locale);
  document.body.appendChild(hiddenPrivacyTrigger);
  const hiddenLocaleSheet = createMobileLocaleSheet({
    currentLocale: locale,
    supportedLocales: getSupportedLocales(),
    nativeNames: LOCALE_NATIVE_NAMES,
    buttonAriaLabel: langMenuAria,
    closeSheetAria,
    onSelect: (code) => {
      if (code !== locale) {
        safeTrack("locale_change", {
          from: locale,
          to: code,
          control: "mobile_sheet",
          path: window.location.pathname,
        });
        setLocale(code);
      }
    },
  });
  hiddenLocaleSheet.style.display = "none";
  document.body.appendChild(hiddenLocaleSheet);

  document.querySelectorAll('[data-mount="header-actions"]').forEach((node) => {
    const variant = node.dataset.headerVariant || "desktop";
    const isMobile = variant === "mobile";
    const actions = document.createElement("div");
    actions.className = isMobile
      ? "header-actions header-actions--mobile"
      : "header-actions header-actions--desktop";

    const langControl = isMobile
      ? createMobileHeaderMenu({
          buttonAriaLabel: langMenuAria,
          closeAriaLabel: String(t.mobileMenuCloseAria || t.accessModalCloseAria || "Close"),
          title: String(t.mobileMenuTitle || t.privacyPolicyTitle || "Menu"),
          languageLabel: String(t.mobileMenuLanguage || "Сменить язык"),
          contactsLabel: String(t.mobileMenuContacts || t.footerContacts || "Контакты"),
          termsLabel: String(t.mobileMenuTerms || "Термзы"),
          onLanguageClick: () => {
            const localeSheetBtn = hiddenLocaleSheet.querySelector("button.locale-toggle--mobile");
            if (localeSheetBtn instanceof HTMLButtonElement) {
              localeSheetBtn.click();
            }
          },
          onContactsClick: () => {
            safeTrack("contacts_menu_click", {
              locale,
              placement: "mobile_header_menu",
              path: window.location.pathname,
            });
            window.location.href = CONTACT_MAILTO;
          },
          onTermsClick: () => {
            safeTrack("terms_menu_click", {
              locale,
              placement: "mobile_header_menu",
              path: window.location.pathname,
            });
            hiddenPrivacyTrigger.click();
          },
        })
      : createDesktopLocaleDropdown({
          currentLocale: locale,
          supportedLocales: getSupportedLocales(),
          nativeNames: LOCALE_NATIVE_NAMES,
          buttonAriaLabel: langMenuAria,
          onSelect: (code) => {
            if (code !== locale) {
              safeTrack("locale_change", {
                from: locale,
                to: code,
                control: "desktop_dropdown",
                path: window.location.pathname,
              });
              setLocale(code);
            }
          },
        });

    const timerClass = isMobile
      ? "mobile-timer desktop-counter"
      : "desktop-timer desktop-counter";
    const timer = createWaitlistCounter({
      template: t.timerBadge,
      countFormatted: formatted,
      className: timerClass,
    });

    actions.append(timer, langControl);
    node.replaceWith(actions);
  });
}

function mountSiteFooter(t, locale) {
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

    const links = document.createElement("div");
    links.className = "site-footer__links";

    const privacy = document.createElement("a");
    privacy.className = "site-footer__privacy";
    privacy.href = "#";
    privacy.textContent = t.footerPrivacyPolicy;

    const contacts = document.createElement("a");
    contacts.className = "site-footer__contacts";
    contacts.href = CONTACT_MAILTO;
    contacts.textContent = t.footerContacts;

    links.append(contacts, privacy);
    footer.append(copy, links);
    node.replaceWith(footer);

    attachPrivacyPolicyPanel(privacy, t, locale);
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
    if (pool.length > 0) {
      layer._startupPool = pool;
    }
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
  mountSiteFooter(t, locale);
  initDesktopHoverSound();
  initDesktopClickSound();

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

    safeTrack("email_submit_attempt", {
      source,
      locale,
      path: window.location.pathname,
    });

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
      safeTrack("email_submit_success", {
        source,
        locale,
        is_new: Boolean(saveResult.newSubscriber),
        path: window.location.pathname,
      });
      if (saveResult.newSubscriber) {
        markWaitlistSubmittedEmail(email);
      }
      fireEmailSubmitConfetti(shell);
      playPopSound();
      showNotification({
        message: String(t.notificationEmailSubmitted || "Email submitted successfully"),
      });
      if (input) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } else if (shell && input) {
      safeTrack("email_submit_failed", {
        source,
        locale,
        path: window.location.pathname,
      });
      showEmailSubmitServerMessage(shell, input, t.emailSubmitFailed);
    }
  });

  document.addEventListener("click", (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) {
      return;
    }
    const cta = target.closest("button.apply-card__cta");
    if (cta) {
      safeTrack("cta_click", {
        placement: cta.closest(".mobile-apply-form") ? "mobile_form" : "desktop_card",
        locale,
        path: window.location.pathname,
      });
      return;
    }
    const submit = target.closest("button.email-input__submit");
    if (submit) {
      safeTrack("email_submit_button_click", {
        source: submit.closest(".access-modal") ? "buy_intent" : "email_form",
        locale,
        path: window.location.pathname,
      });
    }
  });

  document.addEventListener(
    "focusin",
    (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target || hasTrackedEmailInputFocus) {
        return;
      }
      if (target.matches("input.email-input")) {
        hasTrackedEmailInputFocus = true;
        safeTrack("email_input_focus", {
          source: target.closest(".access-modal") ? "buy_intent" : "email_form",
          locale,
          path: window.location.pathname,
        });
      }
    },
    true,
  );

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initEntranceAnimations();
      initStartupRainPhysics();
    });
  });

  document.title = t.metaTitle;
}

init();
