/**
 * Entry лендоса. Без api / session / Supabase.
 * Snap-панели; CTA → /referral|/registration; scroll-reveal по панели;
 * падающие уточки (far = фон; mid = collide + grab/throw).
 */

import { createVideoPlayerCard } from "../../src/components/video-player-card/VideoPlayerCard.js";
import { fixHangingPrepositions } from "../../src/utils/hangingPrepositions.js";
import { getInviteGatePassed } from "../../src/utils/inviteGate.js";
import primerVideo from "../../src/assets/video/primer.mp4";
import logoDefault from "../../src/assets/brand/logo-default.svg";
import logoAngel from "../../src/assets/brand/logo-angel.svg";
import logoDevil from "../../src/assets/brand/logo-devil.svg";

const DUCK_VARIANTS = [logoDefault, logoAngel, logoDevil];

/** far = только фон; mid = collide + grab. */
const DUCK_LAYERS = [
  { depth: "far", layer: "back", count: 9, interactive: false },
  { depth: "mid", layer: "front", count: 6, interactive: true },
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
 * Первая панель — сразу при load.
 */
function initPanelReveal() {
  const panels = [...document.querySelectorAll("[data-landing-panel]")];
  if (!panels.length) return null;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    panels.forEach((el) => el.classList.add("landing-reveal--in"));
    return null;
  }

  const first = panels[0];
  if (first) first.classList.add("landing-reveal--in");

  const rest = panels.slice(1);
  if (!rest.length) return null;

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

  rest.forEach((el) => observer.observe(el));
  return observer;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function readTokenNumber(styles, name, fallback = 0) {
  const n = Number.parseFloat(styles.getPropertyValue(name));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Мягкая «невесомость»:
 * far — только фон (без collide / grab);
 * mid — отскок от блоков и друг от друга + grab/throw.
 */
function initDucksRain() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

  const layers = {
    back: document.querySelector('[data-landing-ducks="back"]'),
    front: document.querySelector('[data-landing-ducks="front"]'),
  };
  if (!layers.back || !layers.front) return null;

  const styles = getComputedStyle(document.documentElement);
  const drag = readTokenNumber(styles, "--landing-duck-drag", 0.16);
  const spinMin = readTokenNumber(styles, "--landing-duck-spin-min", 28);
  const spinMax = readTokenNumber(styles, "--landing-duck-spin-max", 95);
  const vxMax = readTokenNumber(styles, "--landing-duck-vx-max", 48);
  const vy0Max = readTokenNumber(styles, "--landing-duck-vy0-max", 28);
  const restitution = readTokenNumber(styles, "--landing-duck-restitution", 1.08);
  const bounceBoost = readTokenNumber(styles, "--landing-duck-bounce-boost", 1.4);
  const bounceSpin = readTokenNumber(styles, "--landing-duck-bounce-spin", 220);
  const collidePad = readTokenNumber(styles, "--landing-duck-collide-pad", 8);
  const pairRestitution = readTokenNumber(
    styles,
    "--landing-duck-pair-restitution",
    0.88,
  );
  const throwGain = readTokenNumber(styles, "--landing-duck-throw-gain", 1.15);
  const throwMax = readTokenNumber(styles, "--landing-duck-throw-max", 1600);
  const gravity = {
    far: readTokenNumber(styles, "--landing-duck-far-gravity", 32),
    mid: readTokenNumber(styles, "--landing-duck-mid-gravity", 52),
  };

  const collideEls = [
    ...document.querySelectorAll("[data-landing-duck-collide]"),
  ];

  /** @type {{ el: HTMLElement, depth: string, interactive: boolean, x: number, y: number, vx: number, vy: number, rot: number, omega: number, w: number, h: number, r: number, mass: number, coolUntil: number, held: boolean }[]} */
  const ducks = [];
  /** @type {(typeof ducks)[number][]} */
  const interactiveDucks = [];
  const frag = {
    back: document.createDocumentFragment(),
    front: document.createDocumentFragment(),
  };

  /** @type {null | (typeof ducks)[number]} */
  let held = null;
  let grabOffX = 0;
  let grabOffY = 0;
  /** @type {{ x: number, y: number, t: number }[]} */
  let trail = [];

  function viewport() {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  function paintDuck(duck) {
    duck.el.style.setProperty("--duck-x", `${duck.x.toFixed(1)}px`);
    duck.el.style.setProperty("--duck-y", `${duck.y.toFixed(1)}px`);
    duck.el.style.setProperty("--duck-rot", `${duck.rot.toFixed(1)}deg`);
  }

  function syncSize(duck) {
    const rect = duck.el.getBoundingClientRect();
    if (rect.width > 0) {
      duck.w = rect.width;
      duck.h = rect.height || rect.width * 1.12;
    }
    duck.r = Math.max(duck.w, duck.h) * 0.42;
    duck.mass = Math.max(duck.w * duck.h, 1);
  }

  function resetDuck(duck, { scatter = false } = {}) {
    if (duck.held) return;
    const { w, h } = viewport();
    const margin = duck.w * 1.2;
    duck.x = rand(-margin, w - duck.w + margin);
    duck.y = scatter
      ? rand(-h * 0.2, h * 0.7)
      : rand(-margin * 3, -margin);
    duck.vx = rand(-vxMax, vxMax);
    duck.vy = rand(8, vy0Max);
    duck.rot = rand(0, 360);
    const spinDir = duck.vx >= 0 ? 1 : -1;
    duck.omega = spinDir * rand(spinMin, spinMax);
    duck.coolUntil = 0;
    paintDuck(duck);
  }

  function collectObstacles(viewH) {
    /** @type {{ left: number, top: number, right: number, bottom: number }[]} */
    const boxes = [];
    for (const el of collideEls) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.bottom < -48 || r.top > viewH + 48) continue;
      boxes.push({
        left: r.left - collidePad,
        top: r.top - collidePad,
        right: r.right + collidePad,
        bottom: r.bottom + collidePad,
      });
    }
    return boxes;
  }

  function bounceOff(duck, box, now) {
    const duckRight = duck.x + duck.w;
    const duckBottom = duck.y + duck.h;

    if (
      duckRight <= box.left ||
      duck.x >= box.right ||
      duckBottom <= box.top ||
      duck.y >= box.bottom
    ) {
      return false;
    }

    const overlapL = duckRight - box.left;
    const overlapR = box.right - duck.x;
    const overlapT = duckBottom - box.top;
    const overlapB = box.bottom - duck.y;
    const minX = Math.min(overlapL, overlapR);
    const minY = Math.min(overlapT, overlapB);

    const speed = Math.hypot(duck.vx, duck.vy);
    const kick = Math.max(speed, 90) * bounceBoost;

    if (minX < minY) {
      if (overlapL < overlapR) {
        duck.x -= overlapL;
        duck.vx = -Math.abs(kick) * restitution;
      } else {
        duck.x += overlapR;
        duck.vx = Math.abs(kick) * restitution;
      }
      duck.vy += rand(-0.35, 0.35) * kick;
    } else {
      if (overlapT < overlapB) {
        duck.y -= overlapT;
        duck.vy = -Math.abs(kick) * restitution;
      } else {
        duck.y += overlapB;
        duck.vy = Math.abs(kick) * restitution;
      }
      duck.vx += rand(-0.35, 0.35) * kick;
    }

    duck.omega += (duck.vx >= 0 ? 1 : -1) * bounceSpin * rand(0.7, 1.3);
    duck.coolUntil = now + 140;
    return true;
  }

  function collidePair(a, b) {
    const ax = a.x + a.w * 0.5;
    const ay = a.y + a.h * 0.5;
    const bx = b.x + b.w * 0.5;
    const by = b.y + b.h * 0.5;
    let dx = bx - ax;
    let dy = by - ay;
    let dist = Math.hypot(dx, dy);
    const minDist = a.r + b.r;
    if (dist >= minDist) return;

    if (dist < 0.0001) {
      dx = rand(-1, 1) || 1;
      dy = rand(-1, 1);
      dist = Math.hypot(dx, dy);
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    const invMassA = a.held ? 0 : 1 / a.mass;
    const invMassB = b.held ? 0 : 1 / b.mass;
    const invSum = invMassA + invMassB;
    if (invSum <= 0) return;

    const sepA = (overlap * invMassA) / invSum;
    const sepB = (overlap * invMassB) / invSum;
    if (!a.held) {
      a.x -= nx * sepA;
      a.y -= ny * sepA;
    }
    if (!b.held) {
      b.x += nx * sepB;
      b.y += ny * sepB;
    }

    const rvx = a.vx - b.vx;
    const rvy = a.vy - b.vy;
    const velN = rvx * nx + rvy * ny;
    if (velN > 0) return;

    const j = (-(1 + pairRestitution) * velN) / invSum;
    const ix = j * nx;
    const iy = j * ny;
    if (!a.held) {
      a.vx += ix * invMassA;
      a.vy += iy * invMassA;
      a.omega += (nx * rvy - ny * rvx) * 0.02;
    }
    if (!b.held) {
      b.vx -= ix * invMassB;
      b.vy -= iy * invMassB;
      b.omega -= (nx * rvy - ny * rvx) * 0.02;
    }
  }

  function releaseHeld(now) {
    if (!held) return;
    const duck = held;
    let vx = 0;
    let vy = 0;

    if (trail.length >= 2) {
      const newest = trail[trail.length - 1];
      let oldest = trail[0];
      for (let i = trail.length - 2; i >= 0; i -= 1) {
        if (newest.t - trail[i].t >= 40) {
          oldest = trail[i];
          break;
        }
      }
      const dtMs = Math.max(newest.t - oldest.t, 16);
      vx = ((newest.x - oldest.x) / dtMs) * 1000 * throwGain;
      vy = ((newest.y - oldest.y) / dtMs) * 1000 * throwGain;
    }

    const speed = Math.hypot(vx, vy);
    if (speed > throwMax) {
      const s = throwMax / speed;
      vx *= s;
      vy *= s;
    }

    duck.vx = vx;
    duck.vy = vy;
    duck.omega += (vx >= 0 ? 1 : -1) * rand(spinMin, spinMax) * 0.6;
    duck.held = false;
    duck.coolUntil = now + 80;
    duck.el.classList.remove("landing-duck--held");
    held = null;
    trail = [];
  }

  function onPointerDown(e, duck) {
    if (!duck.interactive) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    if (held && held !== duck) releaseHeld(performance.now());

    held = duck;
    duck.held = true;
    duck.vx = 0;
    duck.vy = 0;
    duck.omega *= 0.2;
    grabOffX = e.clientX - duck.x;
    grabOffY = e.clientY - duck.y;
    trail = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    duck.el.classList.add("landing-duck--held");
    duck.el.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!held) return;
    e.preventDefault();
    held.x = e.clientX - grabOffX;
    held.y = e.clientY - grabOffY;
    const t = performance.now();
    trail.push({ x: e.clientX, y: e.clientY, t });
    while (trail.length > 8 || (trail.length > 2 && t - trail[0].t > 120)) {
      trail.shift();
    }
    paintDuck(held);
  }

  function onPointerUp(e) {
    if (!held) return;
    try {
      held.el.releasePointerCapture?.(e.pointerId);
    } catch {
      /* already released */
    }
    releaseHeld(performance.now());
  }

  for (const { depth, layer, count, interactive } of DUCK_LAYERS) {
    for (let i = 0; i < count; i += 1) {
      const el = document.createElement("div");
      el.className = `landing-duck landing-duck--${depth}`;

      const img = document.createElement("img");
      img.src = pick(DUCK_VARIANTS);
      img.alt = "";
      img.decoding = "async";
      img.draggable = false;
      el.append(img);

      const sizeScale = depth === "far" ? rand(0.8, 1.15) : rand(0.88, 1.18);
      el.style.setProperty(
        "--duck-size",
        `calc(var(--landing-duck-${depth}-size) * ${sizeScale.toFixed(3)})`,
      );

      const sizeGuess = depth === "far" ? 34 * sizeScale : 58 * sizeScale;
      const duck = {
        el,
        depth,
        interactive,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rot: 0,
        omega: 0,
        w: sizeGuess,
        h: sizeGuess * 1.12,
        r: sizeGuess * 0.42,
        mass: sizeGuess * sizeGuess,
        coolUntil: 0,
        held: false,
      };

      if (interactive) {
        el.addEventListener("pointerdown", (e) => onPointerDown(e, duck));
        interactiveDucks.push(duck);
      }

      ducks.push(duck);
      resetDuck(duck, { scatter: true });
      frag[layer].append(el);
    }
  }

  layers.back.append(frag.back);
  layers.front.append(frag.front);

  for (const duck of ducks) syncSize(duck);

  let raf = 0;
  let last = performance.now();
  let running = true;
  let obstacleCache = [];
  let obstacleAge = 0;

  function tick(now) {
    if (!running) return;
    const rawDt = (now - last) / 1000;
    last = now;
    const dt = Math.min(rawDt, 0.048);
    const { w, h } = viewport();

    obstacleAge += dt;
    if (obstacleAge > 0.08 || obstacleCache.length === 0) {
      obstacleCache = collectObstacles(h);
      obstacleAge = 0;
    }

    for (const duck of ducks) {
      if (duck.held) {
        paintDuck(duck);
        continue;
      }

      const g = gravity[duck.depth] ?? gravity.mid;
      duck.vy += g * dt;
      duck.vy *= Math.max(0, 1 - drag * dt);
      duck.vx *= Math.max(0, 1 - drag * 0.25 * dt);

      duck.x += duck.vx * dt;
      duck.y += duck.vy * dt;
      duck.rot += duck.omega * dt;
      duck.omega *= Math.max(0, 1 - drag * 0.08 * dt);

      if (duck.interactive && now >= duck.coolUntil) {
        for (const box of obstacleCache) {
          if (bounceOff(duck, box, now)) break;
        }
      }
    }

    for (let i = 0; i < interactiveDucks.length; i += 1) {
      for (let j = i + 1; j < interactiveDucks.length; j += 1) {
        collidePair(interactiveDucks[i], interactiveDucks[j]);
      }
    }

    for (const duck of ducks) {
      if (duck.held) continue;
      paintDuck(duck);

      const gone =
        duck.y > h + duck.h * 1.8 ||
        duck.y < -duck.h * 3.5 ||
        duck.x < -duck.w * 2.8 ||
        duck.x > w + duck.w * 2.8;
      if (gone) resetDuck(duck);
    }

    raf = requestAnimationFrame(tick);
  }

  const onVisibility = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
      if (held) releaseHeld(performance.now());
      return;
    }
    if (!running) {
      running = true;
      last = performance.now();
      obstacleCache = [];
      raf = requestAnimationFrame(tick);
    }
  };

  const onScroll = () => {
    obstacleCache = [];
    obstacleAge = 1;
  };

  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("scroll", onScroll, { passive: true });
  raf = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("scroll", onScroll);
  };
}

function init() {
  initHanging();
  initCtas();
  initDemoVideo();
  initPanelReveal();
  initDucksRain();
  document.body.classList.add("landing-page--ready");
}

init();
