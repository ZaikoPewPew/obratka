/**
 * Entry лендоса. Без api / session / Supabase.
 * Snap-панели; CTA → Telegram (код) /referral|/registration; panel reveal + word scroll-reveal.
 */

import { createVideoPlayerCard } from "../../src/components/video-player-card/VideoPlayerCard.js";
import { createSidePanel } from "../../src/components/side-panel/SidePanel.js";
import { fixHangingPrepositions } from "../../src/utils/hangingPrepositions.js";
import { getCommunityRules } from "../../src/utils/communityRules.js";
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

function initRulesPanel() {
  const triggers = [
    ...document.querySelectorAll("[data-landing-rules]"),
  ];
  if (!triggers.length) return null;

  const rulesPanel = createSidePanel({
    closeAriaLabel: "Закрыть правила",
  });
  document.body.append(rulesPanel.root);

  /**
   * @param {string} text
   * @param {string} className
   * @param {string} [tagName="p"]
   */
  function createRulesText(text, className, tagName = "p") {
    const el = document.createElement(tagName);
    el.className = className;
    el.textContent = fixHangingPrepositions(text ?? "");
    return el;
  }

  /**
   * @param {string} body
   */
  function createRulesList(body) {
    const items = String(body ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (items.length === 0) return null;
    if (items.length === 1) {
      return createRulesText(items[0], "side-panel__section-body");
    }
    const list = document.createElement("ul");
    list.className = "side-panel__section-list";
    for (const item of items) {
      const li = document.createElement("li");
      li.className = "side-panel__section-item";
      li.textContent = fixHangingPrepositions(item);
      list.append(li);
    }
    return list;
  }

  function syncRulesPanelContent() {
    const rules = getCommunityRules("ru");
    rulesPanel.setTitle(rules.title);
    rulesPanel.setDescription(fixHangingPrepositions(rules.updated));

    /** @type {HTMLElement[]} */
    const nodes = [];
    if (rules.intro) {
      nodes.push(createRulesText(rules.intro, "side-panel__intro"));
    }
    for (const section of rules.sections) {
      const wrap = document.createElement("section");
      wrap.className = "side-panel__section";
      if (section.title) {
        wrap.append(
          createRulesText(section.title, "side-panel__section-title", "h3"),
        );
      }
      if (section.body) {
        const bodyNode = createRulesList(section.body);
        if (bodyNode) wrap.append(bodyNode);
      }
      nodes.push(wrap);
    }
    rulesPanel.content.replaceChildren(...nodes);
  }

  function openRulesPanel() {
    syncRulesPanelContent();
    rulesPanel.open();
  }

  for (const trigger of triggers) {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openRulesPanel();
    });
  }

  return rulesPanel;
}

function init() {
  initHanging();
  initCtas();
  initDemoVideo();
  initPanelReveal();
  initFaqAccordion();
  initRulesPanel();
  // После hanging: NBSP уже в тексте, split не рвёт предлоги.
  initLandingScrollReveal();
  document.body.classList.add("landing-page--ready");
}

init();
