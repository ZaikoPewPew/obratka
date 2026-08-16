/**
 * Entry лендоса. Без api / session / Supabase.
 * Snap-панели; CTA → Telegram (код) /referral|/registration; panel reveal + word scroll-reveal.
 */

import { createVideoPlayerCard } from "../../src/components/video-player-card/VideoPlayerCard.js";
import { createSidePanel } from "../../src/components/side-panel/SidePanel.js";
import { fixHangingPrepositions } from "../../src/utils/hangingPrepositions.js";
import { fillSidePanelDoc, getLegalDoc } from "../../src/utils/legalDoc.js";
import { getInviteGatePassed } from "../../src/utils/inviteGate.js";
import primerVideo from "../../src/assets/video/primer.mp4";
import { initLandingScrollReveal } from "./scrollReveal.js";

const TELEGRAM_COMMUNITY_URL = "https://t.me/obratka_dsgn";

function appPath(segment, search = "") {
  const base = String(import.meta.env.BASE_URL || "/");
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  const path = `${prefix}/${segment}`;
  const q = String(search || "");
  if (!q) return path;
  return `${path}${q.startsWith("?") ? q : `?${q}`}`;
}

function referralHref(search = "") {
  return appPath("referral", search);
}

function registrationHref() {
  return appPath("registration");
}

function initCtas() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  /** @type {{ href: string, external: boolean }} */
  let target;
  if (ref) {
    target = {
      href: referralHref(`?ref=${encodeURIComponent(ref)}`),
      external: false,
    };
  } else if (getInviteGatePassed()) {
    target = { href: registrationHref(), external: false };
  } else {
    target = { href: TELEGRAM_COMMUNITY_URL, external: true };
  }

  document.querySelectorAll("[data-landing-cta]").forEach((el) => {
    el.setAttribute("href", target.href);
    if (target.external) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    } else {
      el.removeAttribute("target");
      el.removeAttribute("rel");
    }
  });
}

function initHanging() {
  document.querySelectorAll("[data-fix-hanging]").forEach((el) => {
    // Не затираем <br> принудительных переносов — правим только текстовые узлы.
    if (el.querySelector("br")) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      /** @type {Text[]} */
      const nodes = [];
      let node = walker.nextNode();
      while (node) {
        nodes.push(/** @type {Text} */ (node));
        node = walker.nextNode();
      }
      for (const textNode of nodes) {
        textNode.textContent = fixHangingPrepositions(textNode.textContent ?? "");
      }
      return;
    }
    el.textContent = fixHangingPrepositions(el.textContent ?? "");
  });
}

/**
 * Одно landscape VideoPlayerCard в рамке 833×478.
 */
function initDemoVideo() {
  const slot = document.querySelector("[data-landing-media]");
  if (!slot) return null;

  const wrap = document.createElement("div");
  wrap.className = "landing-showcase__player";

  const player = createVideoPlayerCard({
    src: primerVideo,
    ariaLabel: "Демо: ревью портфолио",
  });

  wrap.append(player.root);
  slot.append(wrap);
  return { root: wrap, player };
}

/**
 * Reveal панели, когда она в центре viewport (scroll-snap).
 * Сейчас — demo (`data-landing-reveal`); copy / FAQ — GSAP word reveal.
 */
function initPanelReveal() {
  const panels = [...document.querySelectorAll("[data-landing-reveal]")];
  if (!panels.length) return null;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    panels.forEach((el) => el.classList.add("landing-reveal--in"));
    return null;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("landing-reveal--in");
        observer.unobserve(entry.target);
      }
    },
    {
      root: null,
      rootMargin: "-20% 0px -20% 0px",
      threshold: 0.35,
    },
  );

  panels.forEach((el) => observer.observe(el));
  return observer;
}

const FAQ_CHEVRON_ICON = `
<span class="landing-faq__icon" aria-hidden="true">
  <svg class="landing-faq__chevron landing-faq__chevron--down" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 9L11.2929 14.2929C11.6834 14.6834 12.3166 14.6834 12.7071 14.2929L18 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  <svg class="landing-faq__chevron landing-faq__chevron--up" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 15L11.2929 9.70711C11.6834 9.31658 12.3166 9.31658 12.7071 9.70711L18 15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</span>
`.trim();

/**
 * FAQ на button + CSS grid (0fr → 1fr). Без <details> — иначе закрытие рвёт анимацию.
 */
function initFaqAccordion() {
  const root = document.querySelector("[data-landing-faq]");
  if (!root) return null;

  /** @type {HTMLElement[]} */
  const items = [...root.querySelectorAll(".landing-faq__item")];

  /**
   * @param {HTMLElement} item
   * @param {boolean} open
   */
  function setItemOpen(item, open) {
    const btn = item.querySelector(".landing-faq__q");
    item.classList.toggle("is-open", open);
    if (btn instanceof HTMLButtonElement) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  for (const item of items) {
    const btn = item.querySelector(".landing-faq__q");
    if (!(btn instanceof HTMLButtonElement)) continue;

    if (!btn.querySelector(".landing-faq__icon")) {
      btn.insertAdjacentHTML("beforeend", FAQ_CHEVRON_ICON);
    }

    btn.addEventListener("click", () => {
      const willOpen = !item.classList.contains("is-open");
      for (const other of items) {
        if (other === item) continue;
        setItemOpen(other, false);
      }
      setItemOpen(item, willOpen);
    });
  }

  return root;
}

function initLegalPanel() {
  /** @type {Array<{ selector: string, id: import("../../src/utils/legalDoc.js").LegalDocId, closeAria: string }>} */
  const bindings = [
    {
      selector: "[data-landing-rules]",
      id: "rules",
      closeAria: "Закрыть правила",
    },
    {
      selector: "[data-landing-privacy]",
      id: "privacy",
      closeAria: "Закрыть политику",
    },
    {
      selector: "[data-landing-terms]",
      id: "terms",
      closeAria: "Закрыть соглашение",
    },
  ];
  const hasTrigger = bindings.some(
    (binding) => document.querySelectorAll(binding.selector).length > 0,
  );
  if (!hasTrigger) return null;

  const legalPanel = createSidePanel({
    closeAriaLabel: "Закрыть правила",
  });
  document.body.append(legalPanel.root);

  /**
   * @param {import("../../src/utils/legalDoc.js").LegalDocId} id
   * @param {string} closeAria
   */
  function openDoc(id, closeAria) {
    fillSidePanelDoc(legalPanel, getLegalDoc(id, "ru"), closeAria);
    legalPanel.open();
  }

  for (const binding of bindings) {
    document.querySelectorAll(binding.selector).forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        openDoc(binding.id, binding.closeAria);
      });
    });
  }

  return legalPanel;
}

function init() {
  initHanging();
  initCtas();
  initDemoVideo();
  initPanelReveal();
  initFaqAccordion();
  initLegalPanel();
  // После hanging: NBSP уже в тексте, split не рвёт предлоги.
  initLandingScrollReveal();
  document.body.classList.add("landing-page--ready");
}

init();
