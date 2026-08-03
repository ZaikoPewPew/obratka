/**
 * PostHog facade: pageviews (SPA) + product events.
 * Без `VITE_POSTHOG_KEY` — no-op (local / CI без секрета).
 *
 * SDK грузится после первого paint / idle — не блокирует cold start.
 * Вызовы до ready кладутся в очередь и сбрасываются после init.
 *
 * Project token публичный (как anon); не класть personal API key.
 */
import { ROUTE_PATHS } from "../app/routes.js";

const KEY = String(import.meta.env.VITE_POSTHOG_KEY ?? "").trim();
const HOST = String(
  import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com",
).trim();

/** @type {boolean} */
let ready = false;
/** @type {boolean} */
let initStarted = false;
/** @type {import("posthog-js").PostHog | null} */
let posthog = null;
/** @type {Array<() => void>} */
const pending = [];

/**
 * @returns {boolean}
 */
export function isAnalyticsEnabled() {
  return ready;
}

/**
 * @param {() => void} fn
 */
function runOrQueue(fn) {
  if (ready && posthog) {
    fn();
    return;
  }
  if (!KEY) return;
  pending.push(fn);
}

function flushPending() {
  if (!ready || !posthog) return;
  const queue = pending.splice(0, pending.length);
  for (const fn of queue) {
    try {
      fn();
    } catch {
      /* ignore single event failure */
    }
  }
}

/**
 * @param {() => void} load
 */
function scheduleAfterPaint(load) {
  const run = () => {
    load();
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 2500 });
    return;
  }
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.setTimeout(run, 0);
    });
  });
}

export function initAnalytics() {
  if (initStarted || !KEY || typeof window === "undefined") return;
  initStarted = true;

  scheduleAfterPaint(() => {
    void import("posthog-js")
      .then((mod) => {
        const ph = mod.default;
        ph.init(KEY, {
          api_host: HOST,
          defaults: "2026-05-30",
          // SPA: pageview только из applyRoute / trackPage.
          capture_pageview: false,
          capture_pageleave: true,
          persistence: "localStorage+cookie",
        });
        posthog = ph;
        ready = true;
        flushPending();
      })
      .catch(() => {
        initStarted = false;
      });
  });
}

/**
 * @param {import("../app/routes.js").AppRouteId | string} routeId
 * @param {Record<string, unknown>} [props]
 */
export function trackPage(routeId, props = {}) {
  runOrQueue(() => {
    if (!posthog) return;
    const path =
      typeof routeId === "string" && routeId in ROUTE_PATHS
        ? ROUTE_PATHS[
            /** @type {import("../app/routes.js").AppRouteId} */ (routeId)
          ]
        : typeof routeId === "string"
          ? routeId
          : "/";
    posthog.capture("$pageview", {
      ...props,
      route_id: routeId,
      path,
      $current_url: window.location.href,
    });
  });
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [props]
 */
export function track(event, props = {}) {
  if (!event) return;
  runOrQueue(() => {
    posthog?.capture(event, props);
  });
}

/**
 * @param {string} userId
 * @param {Record<string, unknown>} [traits]
 */
export function identifyUser(userId, traits = {}) {
  if (!userId) return;
  runOrQueue(() => {
    posthog?.identify(userId, traits);
  });
}

export function resetAnalytics() {
  runOrQueue(() => {
    posthog?.reset();
  });
}
