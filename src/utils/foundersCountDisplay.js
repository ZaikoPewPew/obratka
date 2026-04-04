/** Минимум в тексте «N+ фаундеров…» до учёта строк из `subscribers`. */
export const FOUNDERS_BASE = 4;

const PLACEHOLDER = "{foundersCount}";
const ANIM_MS = 680;

let dbSubscriberCount = 0;
let animRaf = null;
/** После первой анимации на загрузке — можно сразу показывать итог новым блокам (модалка). */
let foundersCountAnimationDone = false;

export function getDbSubscriberCount() {
  return dbSubscriberCount;
}

export function getFoundersDisplayNumber() {
  return FOUNDERS_BASE + dbSubscriberCount;
}

export function isFoundersCountAnimationDone() {
  return foundersCountAnimationDone;
}

/**
 * Собирает подпись с выделяемым числом (для анимации и без скачков вёрстки).
 * @param {HTMLElement} el
 * @param {string} template — из locales, с `{foundersCount}`
 * @param {number} num
 */
export function fillFoundersCaption(el, template, num) {
  const t = String(template);
  const idx = t.indexOf(PLACEHOLDER);
  if (idx === -1) {
    el.replaceChildren(document.createTextNode(t));
    return;
  }
  const before = t.slice(0, idx);
  const after = t.slice(idx + PLACEHOLDER.length);
  const span = document.createElement("span");
  span.className = "email-avatars__founders-num";
  span.textContent = String(Math.max(0, Math.round(num)));
  el.replaceChildren(
    document.createTextNode(before),
    span,
    document.createTextNode(after),
  );
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function forEachFoundersNumSpan(fn) {
  document
    .querySelectorAll(
      ".email-avatars__caption:not(.email-avatars__caption--error) .email-avatars__founders-num",
    )
    .forEach(fn);
}

function syncAllCaptionNumbers(value) {
  forEachFoundersNumSpan((span) => {
    span.textContent = String(Math.round(value));
  });
}

function ensureNormalCaptionsStructuredAtZero() {
  document
    .querySelectorAll(".email-avatars__caption:not(.email-avatars__caption--error)")
    .forEach((el) => {
      const tpl = el.dataset.foundersTemplate;
      if (tpl) {
        fillFoundersCaption(el, tpl, 0);
      }
    });
}

function runFoundersDisplayAnimation(target) {
  if (animRaf !== null) {
    cancelAnimationFrame(animRaf);
    animRaf = null;
  }

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  foundersCountAnimationDone = false;
  ensureNormalCaptionsStructuredAtZero();

  if (reduce) {
    syncAllCaptionNumbers(target);
    foundersCountAnimationDone = true;
    return;
  }

  const from = 0;
  const start = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - start) / ANIM_MS);
    const val = Math.round(from + (target - from) * easeOutQuad(t));
    syncAllCaptionNumbers(val);
    if (t < 1) {
      animRaf = requestAnimationFrame(tick);
    } else {
      animRaf = null;
      syncAllCaptionNumbers(target);
      foundersCountAnimationDone = true;
    }
  }

  animRaf = requestAnimationFrame(tick);
}

/**
 * @param {number | null | undefined} count — строк в `subscribers`, null/undefined = только база
 */
export function setDbSubscriberCountAndRefresh(count) {
  if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
    dbSubscriberCount = count;
  }
  runFoundersDisplayAnimation(getFoundersDisplayNumber());
}
