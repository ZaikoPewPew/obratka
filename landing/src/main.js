/**
 * Entry лендоса. Без api / session / Supabase.
 * Mesh — createBrandScreenVisual; CTA → /referral (+ ?ref=).
 */

import { createBrandScreenVisual } from "../../src/components/brand-screen-visual/BrandScreenVisual.js";
import { fixHangingPrepositions } from "../../src/utils/hangingPrepositions.js";

function referralHref(search = "") {
  const base = String(import.meta.env.BASE_URL || "/");
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  const path = `${prefix}/referral`;
  const q = String(search || "");
  if (!q) return path;
  return `${path}${q.startsWith("?") ? q : `?${q}`}`;
}

function initCtas() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  const href = referralHref(ref ? `?ref=${encodeURIComponent(ref)}` : "");

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

function init() {
  initHanging();
  initCtas();
  initVisual();
  document.body.classList.add("landing-page--ready");
}

init();
