/**
 * Entry лендоса. Без api / session / Supabase.
 * Mesh — createBrandScreenVisual; CTA → /referral или /registration по invite gate.
 * Showcase media — ряд VideoPlayerCard.
 */

import { createBrandScreenVisual } from "../../src/components/brand-screen-visual/BrandScreenVisual.js";
import { createVideoPlayerCard } from "../../src/components/video-player-card/VideoPlayerCard.js";
import { fixHangingPrepositions } from "../../src/utils/hangingPrepositions.js";
import { getInviteGatePassed } from "../../src/utils/inviteGate.js";
import welcomeVideo from "../../src/assets/video/welcome.mp4";
import primerVideo from "../../src/assets/video/primer.mp4";
import primerExternalVideo from "../../src/assets/video/primer_not_iframe.mp4";

/** @type {{ src: string; ariaLabel: string }[]} */
const LANDING_CAROUSEL_VIDEOS = [
  { src: welcomeVideo, ariaLabel: "Демо: онбординг" },
  { src: primerVideo, ariaLabel: "Демо: ревью в iframe" },
  { src: primerExternalVideo, ariaLabel: "Демо: внешнее портфолио" },
];

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
  let href;
  if (ref) {
    href = referralHref(`?ref=${encodeURIComponent(ref)}`);
  } else if (getInviteGatePassed()) {
    href = registrationHref();
  } else {
    href = referralHref();
  }

  document.querySelectorAll("[data-landing-cta]").forEach((el) => {
    el.setAttribute("href", href);
  });
}

function initHanging() {
  document.querySelectorAll("[data-fix-hanging]").forEach((el) => {
    el.textContent = fixHangingPrepositions(el.textContent ?? "");
  });
}

function initVisual() {
  const slot = document.querySelector("[data-landing-visual]");
  if (!slot) return null;

  const visual = createBrandScreenVisual({ classPrefix: "landing" });
  visual.bindScreenRoot(document.body);
  visual.setVariant("default");
  visual.setActive(true);
  slot.append(visual.root);
  return visual;
}

/**
 * Ряд из трёх VideoPlayerCard.
 * Одновременно играет только одна карточка.
 */
function initMediaCarousel() {
  const slot = document.querySelector("[data-landing-media-carousel]");
  if (!slot) return null;

  const track = document.createElement("div");
  track.className = "landing-showcase__carousel";
  track.setAttribute("role", "list");

  /** @type {ReturnType<typeof createVideoPlayerCard>[]} */
  const players = [];

  for (const item of LANDING_CAROUSEL_VIDEOS) {
    const slide = document.createElement("div");
    slide.className = "landing-showcase__slide";
    slide.setAttribute("role", "listitem");

    const player = createVideoPlayerCard({
      src: item.src,
      ariaLabel: item.ariaLabel,
    });
    players.push(player);

    const video = player.root.querySelector("video");
    if (video) {
      video.addEventListener("play", () => {
        for (const other of players) {
          if (other !== player) other.pause();
        }
      });
    }

    slide.append(player.root);
    track.append(slide);
  }

  slot.append(track);
  return { root: track, players };
}

function init() {
  initHanging();
  initCtas();
  initVisual();
  initMediaCarousel();
  document.body.classList.add("landing-page--ready");
}

init();
