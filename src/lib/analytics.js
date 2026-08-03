/**
 * PostHog facade: pageviews (SPA) + product events.
 * Без `VITE_POSTHOG_KEY` — no-op (local / CI без секрета).
 *
 * Project token публичный (как anon); не класть personal API key.
 */
import posthog from "posthog-js";
import { ROUTE_PATHS } from "../app/routes.js";

const KEY = String(import.meta.env.VITE_POSTHOG_KEY ?? "").trim();
const HOST = String(
  import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com",
).trim();

/** @type {boolean} */
let ready = false;

/**
 * @returns {boolean}
 */
export function isAnalyticsEnabled() {
  return ready;
}

export function initAnalytics() {
  if (ready || !KEY || typeof window === "undefined") return;
  posthog.init(KEY, {
    api_host: HOST,
    defaults: "2026-05-30",
    // SPA: pageview только из applyRoute / trackPage.
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
  ready = true;
}

/**
 * @param {import("../app/routes.js").AppRouteId | string} routeId
 * @param {Record<string, unknown>} [props]
 */
export function trackPage(routeId, props = {}) {
  if (!ready) return;
  const path =
    typeof routeId === "string" && routeId in ROUTE_PATHS
      ? ROUTE_PATHS[/** @type {import("../app/routes.js").AppRouteId} */ (routeId)]
      : typeof routeId === "string"
        ? routeId
        : "/";
  posthog.capture("$pageview", {
    ...props,
    route_id: routeId,
    path,
    $current_url: window.location.href,
  });
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [props]
 */
export function track(event, props = {}) {
  if (!ready || !event) return;
  posthog.capture(event, props);
}

/**
 * @param {string} userId
 * @param {Record<string, unknown>} [traits]
 */
export function identifyUser(userId, traits = {}) {
  if (!ready || !userId) return;
  posthog.identify(userId, traits);
}

export function resetAnalytics() {
  if (!ready) return;
  posthog.reset();
}
