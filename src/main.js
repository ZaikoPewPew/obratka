import logoUrl from "../logo.svg?url";
import { getLocale, getStrings, getStartups, setLocale } from "./i18n.js";
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
} from "./components/startup-card/StartupCard.js";
import { initStartupRainPhysics } from "./startup-rain-physics.js";

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

/** Слот data-mount="header-actions": кнопка языка + бейдж счётчика (8px между ними). */
function mountHeaderActions(t, locale) {
  const formatted = getFormattedStartupCount(locale);
  const nextLocale = locale === "ru" ? "en" : "ru";

  document.querySelectorAll('[data-mount="header-actions"]').forEach((node) => {
    const variant = node.dataset.headerVariant || "desktop";
    const isMobile = variant === "mobile";
    const actions = document.createElement("div");
    actions.className = isMobile
      ? "header-actions header-actions--mobile"
      : "header-actions header-actions--desktop";

    const langBtn = createLocaleToggleButton({
      ariaLabel: t.langSwitchAria,
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

    if (isMobile) {
      actions.append(timer, langBtn);
    } else {
      actions.append(langBtn, timer);
    }
    node.replaceWith(actions);
  });
}

function mountSiteFooter(t) {
  document.querySelectorAll('[data-mount="site-footer"]').forEach((node) => {
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
  const doubled = items.length ? [...items, ...items] : [];
  document.querySelectorAll('[data-mount="startup-fall"]').forEach((node) => {
    const layer = document.createElement("div");
    layer.className = "startup-fall";
    doubled.forEach((item, i) => {
      layer.append(createStartupFallItem(item, i));
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
    formMount.replaceWith(createApplyCardForm({ t }));
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

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initStartupRainPhysics();
    });
  });

  document.title = t.metaTitle;
}

init();
