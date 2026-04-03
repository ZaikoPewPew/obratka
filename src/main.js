import logoUrl from "../logo.svg?url";
import { getLocale, getStrings, getStartups } from "./i18n.js";
import { createLogo } from "./components/logo/Logo.js";
import { createWaitlistCounter } from "./components/waitlist-counter/WaitlistCounter.js";
import { createApplyCard } from "./components/apply-card/ApplyCard.js";
import { createStartupFallItem } from "./components/startup-card/StartupCard.js";
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
    });
    node.replaceWith(img);
  });
}

/** Слот data-mount="timer": бейдж счётчика стартапов (позже можно подключить живой таймер/счётчик). */
function mountTimerSlot(t, locale) {
  const { count } = getStartups();
  const formatted = count.toLocaleString(locale === "ru" ? "ru-RU" : "en-US");
  const text = t.timerBadge.replace("{count}", formatted);

  document.querySelectorAll('[data-mount="timer"]').forEach((node) => {
    const variant = node.dataset.timerVariant || "desktop";
    const className =
      variant === "mobile"
        ? "mobile-timer desktop-counter"
        : "desktop-timer desktop-counter";
    const el = createWaitlistCounter({ text, className });
    node.replaceWith(el);
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

function mountStartupFall() {
  const { items = [] } = getStartups();
  document.querySelectorAll('[data-mount="startup-fall"]').forEach((node) => {
    const layer = document.createElement("div");
    layer.className = "startup-fall";
    items.forEach((item, i) => {
      layer.append(createStartupFallItem(item, i));
    });
    node.replaceWith(layer);
  });
}

function mountApplyCards(t) {
  const desktopCard = createApplyCard({ t });
  const mobileCard = createApplyCard({ t, modifier: "apply-card apply-card--mobile" });

  const mounts = document.querySelectorAll('[data-mount="apply-card"]');
  mounts.forEach((node, i) => {
    const card = i === 0 ? desktopCard : mobileCard;
    node.replaceWith(card);
  });
}

function init() {
  const locale = getLocale();
  document.documentElement.lang = locale;

  const t = getStrings(locale);

  mountLogos(t.brandName);
  mountTimerSlot(t, locale);
  mountStartupFall();
  mountApplyCards(t);
  mountSiteFooter(t);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initStartupRainPhysics();
    });
  });

  document.title = t.metaTitle;
}

init();
