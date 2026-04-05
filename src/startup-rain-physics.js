/**
 * Дождь по стартап-карточкам: Matter.js (стакание, отскоки от блоков заявки, drag мышью / тачем).
 */

import Matter from "matter-js";

import { setStartupFallItemContent } from "./components/startup-card/StartupCard.js";

/** Столкновения только с «крышей» — заголовок блока заявки */
const BARRIER_SELECTORS = [".apply-card__title"];

const {
  Engine,
  Runner,
  World,
  Bodies,
  Body,
  Composite,
  Mouse,
  MouseConstraint,
  Events,
  Sleeping,
} = Matter;

/** Старт без заметного «выстрела»: разгон только за счёт гравитации. */
const CARD_FALL_VY_START = 0;
const CARD_FALL_VX_JITTER = 0.1;

/** Нижний край карточки при спавне должен быть выше y=0, иначе пересечение со стенами — резкий скачок. */
const SPAWN_TOP_CLEAR = 16;

/** Постоянно медленное падение: жёсткий потолок скорости (без «пушек» от столкновений). */
const CARD_MAX_SPEED = 2.37;
/** Индивидуальный потолок скорости задаётся на теле как `body._maxSpeed` в этом диапазоне. */
const CARD_SPEED_MIN = 1.88;
const CARD_SPEED_MAX = 2.37;

/** Случайный интервал между карточками в потоке (центр выше верхней соседней). */
const SPAWN_GAP_MIN = 64;
const SPAWN_GAP_MAX = 200;
/** Выше — иначе все карточки визуально крутятся почти одинаково (срез угловой скорости). */
const CARD_MAX_ANGULAR = 0.38;

/** Не давать повторно «выстреливать» отскоком от крыши на каждом кадре контакта. */
const BARRIER_KICK_COOLDOWN_MS = 160;

/**
 * Начальный угол (рад): широкий случайный разброс + сдвиг по индексу/слоту — не «одинаковый полёт».
 * ~±38° базово + до ~±15° от фазы.
 * @param {number} index
 * @param {0 | 2} slot
 */
function spawnCardAngleRad(index, slot) {
  const wide = (Math.random() - 0.5) * 1.32;
  const phase = index * 0.51 + slot * 0.73;
  return wide + Math.sin(phase) * 0.28 + (index % 3 - 1) * 0.12;
}

/**
 * Начальная угловая скорость: разная по карточкам, заметное вращение при падении.
 * @param {number} index
 * @param {0 | 2} slot
 */
function spawnCardAngularVel(index, slot) {
  return (
    (Math.random() - 0.5) * 0.11 +
    Math.sin(index * 0.88 + slot * 1.4) * 0.045 +
    (slot === 0 ? 0.018 : -0.018)
  );
}

/**
 * Базовая линия спавна: центр карточки так, что нижний край чуть выше верхней границы слоя.
 * @param {number} cardH
 */
function baseSpawnCenterY(cardH) {
  const maxBottom = -SPAWN_TOP_CLEAR;
  return maxBottom - cardH / 2;
}

/**
 * Горизонталь только слева/справа от `.apply-card`; полоса по `laneIndex` в колонке.
 * @param {DOMRect} fallRect
 * @param {HTMLElement} applyCard
 * @param {0 | 2} slot
 * @param {number} cardW
 * @param {number} cardH
 * @param {number} laneIndex — 0..perSide-1 внутри стороны
 * @param {number} perSide
 */
function spawnCenterX(fallRect, applyCard, slot, cardW, cardH, laneIndex, perSide) {
  const w = fallRect.width;
  const pad = Math.max(4, Math.min(32, w * 0.02));
  const gap = 16;
  const ac = applyCard.getBoundingClientRect();
  const acl = ac.left - fallRect.left;
  const acr = ac.right - fallRect.left;

  const clampCenter = (cx) => Math.max(cardW / 2 + 2, Math.min(w - cardW / 2 - 2, cx));

  let minCX;
  let maxCX;
  if (slot === 0) {
    maxCX = acl - gap - cardW / 2;
    minCX = cardW / 2 + pad;
  } else {
    minCX = acr + gap + cardW / 2;
    maxCX = w - cardW / 2 - pad;
  }

  let centerX;
  const range = maxCX - minCX;
  if (range < 12) {
    centerX = clampCenter((minCX + maxCX) / 2);
  } else if (range < cardW * 1.1) {
    const frac = (laneIndex + 0.5) / perSide - 0.5;
    centerX = clampCenter((minCX + maxCX) / 2 + frac * Math.min(range * 0.35, cardW * 0.4));
  } else {
    const lo = minCX + (laneIndex / perSide) * range;
    const hi = minCX + ((laneIndex + 1) / perSide) * range;
    const inner = Math.min(10, (hi - lo) * 0.12);
    centerX = (lo + hi) / 2 + (Math.random() - 0.5) * Math.max(0, hi - lo - 2 * inner);
  }

  return { x: clampCenter(centerX) };
}

/**
 * Вертикальные позиции при старте: «лестница» со случайными интервалами, порядок по дорожкам перемешан.
 * @param {number} count
 * @param {number} baseCenterY
 * @param {number} sideStagger — сдвиг правой колонки (полшага потока)
 */
function distributeInitialStreamYs(count, baseCenterY, sideStagger) {
  const ys = [];
  let cursor = baseCenterY + sideStagger;
  for (let i = 0; i < count; i++) {
    const g = SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
    cursor -= g;
    ys.push(cursor);
  }
  for (let i = ys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = ys[i];
    ys[i] = ys[j];
    ys[j] = t;
  }
  return ys;
}

/**
 * Следующая позиция по потоку: выше верхней точки всех соседей по стороне (кроме себя).
 * @param {number} cardH
 * @param {import('matter-js').Body[]} peerBodies
 * @param {import('matter-js').Body | null} selfBody
 * @param {number} baseCenterY
 */
function nextStreamCenterY(cardH, peerBodies, selfBody, baseCenterY) {
  let minTop = Infinity;
  let n = 0;
  for (let p = 0; p < peerBodies.length; p++) {
    const b = peerBodies[p];
    if (b === selfBody) {
      continue;
    }
    const top = b.position.y - cardH / 2;
    minTop = Math.min(minTop, top);
    n++;
  }
  const gap = SPAWN_GAP_MIN + Math.random() * (SPAWN_GAP_MAX - SPAWN_GAP_MIN);
  if (n === 0 || !Number.isFinite(minTop)) {
    return baseCenterY - Math.random() * (cardH + 100);
  }
  return minTop - gap - cardH / 2;
}

/**
 * @param {import('matter-js').Engine} engine
 * @param {ReturnType<typeof collectBarrierRects>} rects
 */
function barrierBodiesFromRects(rects) {
  return rects.map((r) => {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return Bodies.rectangle(cx, cy, r.width, r.height, {
      isStatic: true,
      friction: 0.42,
      frictionStatic: 0.55,
      restitution: 0.22,
      label: "barrier",
      plugin: { barrier: true },
    });
  });
}

/** Боковые стенки зоны падения (локальные координаты слоя).
 * Верхнюю границу не делаем статическим телом. Спавн задаётся так, чтобы нижний край карточки был выше y=0. */
function edgeWallBodiesFromFallRect(fr) {
  const w = fr.width;
  const h = fr.height;
  const t = 36;
  const wallOpts = {
    isStatic: true,
    friction: 0.32,
    frictionStatic: 0.5,
    restitution: 0.24,
  };
  return [
    Bodies.rectangle(-t / 2, h / 2, t, h + t * 3, { ...wallOpts, label: "wall-left" }),
    Bodies.rectangle(w + t / 2, h / 2, t, h + t * 3, { ...wallOpts, label: "wall-right" }),
  ];
}

/**
 * «Крыша» формы: по вертикали — только заголовок, по горизонтали — вся карточка заявки.
 * Узкий h1 даёт rect уже карточки стартапа — боковые колонки дождя не пересекали барьер.
 *
 * @param {DOMRect} fallRect
 * @param {HTMLElement} applyCard
 */
function collectBarrierRects(fallRect, applyCard) {
  const title = applyCard.querySelector(BARRIER_SELECTORS[0]);
  if (!title) {
    return [];
  }
  const tr = title.getBoundingClientRect();
  const cr = applyCard.getBoundingClientRect();
  if (tr.width <= 0 || tr.height <= 0) {
    return [];
  }
  return [
    {
      left: cr.left - fallRect.left,
      top: tr.top - fallRect.top,
      width: cr.width,
      height: tr.height,
    },
  ];
}

/**
 * Отскок в сторону от края: левая колонка — вправо, правая — влево (центрального слота нет).
 * @param {import('matter-js').Body} body
 * @param {number} fallWidth
 * @param {number} strength
 */
function bounceKickX(body, fallWidth, strength) {
  const slot = body._slot;
  const j = (Math.random() - 0.5) * 0.12;
  if (slot === 0) {
    return strength + j;
  }
  if (slot === 2) {
    return -strength + j;
  }
  const cx = fallWidth / 2;
  return (body.position.x < cx ? strength : -strength) * 0.85 + j;
}

/**
 * Сглаживает редкие всплески скорости от солвера / карта о карту.
 * @param {import('matter-js').Body} body
 */
function clampCardVelocity(body) {
  let vx = body.velocity.x;
  let vy = body.velocity.y;
  const cap = typeof body._maxSpeed === "number" ? body._maxSpeed : CARD_MAX_SPEED;
  const sp = Math.hypot(vx, vy);
  if (sp > cap && sp > 1e-6) {
    const k = cap / sp;
    vx *= k;
    vy *= k;
    Body.setVelocity(body, { x: vx, y: vy });
  }
  const av = body.angularVelocity;
  if (Math.abs(av) > CARD_MAX_ANGULAR) {
    Body.setAngularVelocity(body, Math.sign(av) * CARD_MAX_ANGULAR);
  }
}

/** Длительность CSS «пузырь + карточка» (см. startup-card.css). */
const SPAWN_POP_DURATION_MS = 500;

/**
 * Пузырёк «лопнул» — карточка выезжает (класс снимается после анимации).
 * @param {HTMLElement} itemEl `.startup-fall__item`
 */
function triggerStartupCardSpawnPop(itemEl) {
  if (!itemEl) {
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  const prev = itemEl._spawnPopTimerId;
  if (prev != null) {
    window.clearTimeout(prev);
  }
  itemEl.classList.remove("startup-fall__item--spawn-pop");
  requestAnimationFrame(() => {
    itemEl.classList.add("startup-fall__item--spawn-pop");
    itemEl._spawnPopTimerId = window.setTimeout(() => {
      itemEl.classList.remove("startup-fall__item--spawn-pop");
      itemEl._spawnPopTimerId = undefined;
    }, SPAWN_POP_DURATION_MS);
  });
}

/**
 * @param {HTMLElement} fallLayer
 */
export function initStartupRainPhysics() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  /** @type {{ cleanup: () => void } | null} */
  let active = null;

  function setup() {
    if (active) {
      active.cleanup();
      active = null;
    }

    const layers = Array.from(document.querySelectorAll(".startup-fall")).filter(
      (el) => el.offsetParent !== null && el.getBoundingClientRect().height > 8,
    );
    if (layers.length === 0) {
      return;
    }

    for (const fallLayer of layers) {
      const main = fallLayer.closest("main");
      const applyCard = main?.querySelector(".apply-card");
      if (!applyCard) {
        continue;
      }

      fallLayer.classList.add("startup-fall--physics");

      const perSide = Number(fallLayer.dataset.physicsPerSide) || 4;

      function blockTextDrag(e) {
        e.preventDefault();
      }
      fallLayer.addEventListener("selectstart", blockTextDrag);
      fallLayer.addEventListener("dragstart", blockTextDrag);

      const items = Array.from(fallLayer.querySelectorAll(".startup-fall__item"));
      const fallRect0 = fallLayer.getBoundingClientRect();
      const first = items[0];
      const cardW = first ? first.offsetWidth : 300;
      const cardH = first ? first.offsetHeight : 80;

      items.forEach((el) => {
        el.classList.remove(
          "startup-fall__item--tilt-a",
          "startup-fall__item--tilt-b",
          "startup-fall__item--tilt-c",
          "startup-fall__item--d0",
          "startup-fall__item--d1",
          "startup-fall__item--d2",
        );
      });

      const engine = Engine.create({
        enableSleeping: true,
        positionIterations: 8,
        velocityIterations: 8,
      });

      engine.gravity.y = 0.396;
      engine.gravity.scale = 0.000484;

      const world = engine.world;

      const barrierRects = collectBarrierRects(fallRect0, applyCard);
      const barriers = barrierBodiesFromRects(barrierRects);
      const edgeWalls = edgeWallBodiesFromFallRect(fallRect0);
      /** @type {import('matter-js').Body[]} */
      let staticBodies = [...barriers, ...edgeWalls];
      Composite.add(world, staticBodies);

      /** @type {import('matter-js').Body[]} */
      const cardBodies = [];

      const baseY0 = baseSpawnCenterY(cardH);
      const vertStep = Math.max(132, cardH + 40);
      const leftYs = distributeInitialStreamYs(perSide, baseY0, 0);
      const rightYs = distributeInitialStreamYs(perSide, baseY0, vertStep * 0.5);
      /** @type {Array<{ avatar: string; title: string; description: string }> | undefined} */
      const startupPool = fallLayer._startupPool;

      for (let i = 0; i < items.length; i++) {
        const itemEl = items[i];
        const slot = i < perSide ? 0 : 2;
        const laneIndex = i < perSide ? i : i - perSide;
        const y = slot === 0 ? leftYs[laneIndex] : rightYs[laneIndex];
        const { x } = spawnCenterX(fallRect0, applyCard, slot, cardW, cardH, laneIndex, perSide);
        const body = Bodies.rectangle(x, y, cardW, cardH, {
          friction: 0.58,
          frictionAir: 0.038 + Math.random() * 0.022,
          restitution: 0.06,
          density: 0.0022,
          /** Иначе Matter усыпляет карточку на «полке» / у стены — потом рывок при пробуждении. */
          sleepThreshold: 0,
          label: "startup-card",
        });
        body._itemEl = itemEl;
        body._slot = slot;
        body._maxSpeed = CARD_SPEED_MIN + Math.random() * (CARD_SPEED_MAX - CARD_SPEED_MIN);
        body._poolIndex =
          startupPool && startupPool.length > 0 ? i % startupPool.length : 0;
        Body.setAngle(body, spawnCardAngleRad(i, slot));
        Body.setAngularVelocity(body, spawnCardAngularVel(i, slot));
        Body.setVelocity(body, {
          x: (Math.random() - 0.5) * CARD_FALL_VX_JITTER,
          y: CARD_FALL_VY_START,
        });
        cardBodies.push(body);
        Composite.add(world, body);
      }

      if (startupPool && startupPool.length > 0) {
        /** Следующий индекс в `items` после начальных 0…N−1 карточек (глобальный порядок без дублей подряд). */
        fallLayer._startupSeq = cardBodies.length;
      }

      const mouse = Mouse.create(fallLayer);
      const mouseConstraint = MouseConstraint.create(engine, {
        mouse,
        constraint: {
          stiffness: 0.32,
          damping: 0.1,
          render: { visible: false },
        },
      });
      Composite.add(world, mouseConstraint);

      let lastClientX = fallRect0.left + fallRect0.width / 2;
      let lastClientY = fallRect0.top + fallRect0.height / 2;

      function onClientPointer(e) {
        const t = "touches" in e && e.touches.length ? e.touches[0] : e;
        lastClientX = t.clientX;
        lastClientY = t.clientY;
      }

      document.addEventListener("mousemove", onClientPointer, { passive: true });
      document.addEventListener("touchmove", onClientPointer, { passive: true });
      document.addEventListener("touchstart", onClientPointer, { passive: true });

      Events.on(engine, "beforeUpdate", () => {
        const fr = fallLayer.getBoundingClientRect();
        mouse.position.x = lastClientX - fr.left;
        mouse.position.y = lastClientY - fr.top;
      });

      function flashSplash(itemEl) {
        const splash = itemEl.querySelector(".startup-fall__splash");
        if (!splash) {
          return;
        }
        splash.classList.add("startup-fall__splash--hit");
        const prev = splash.dataset.hitT;
        if (prev) {
          window.clearTimeout(Number(prev));
        }
        const tid = window.setTimeout(() => {
          splash.classList.remove("startup-fall__splash--hit");
          delete splash.dataset.hitT;
        }, 200);
        splash.dataset.hitT = String(tid);
      }

      Events.on(engine, "collisionStart", ({ pairs }) => {
        const frW = fallLayer.getBoundingClientRect().width;
        for (let p = 0; p < pairs.length; p++) {
          const pair = pairs[p];
          const a = pair.bodyA;
          const b = pair.bodyB;
          const cardBody = a.label === "startup-card" ? a : b.label === "startup-card" ? b : null;
          const other = cardBody === a ? b : a;
          if (!cardBody || !cardBody._itemEl || !other) {
            continue;
          }

          if (other.label === "barrier") {
            flashSplash(cardBody._itemEl);
            Sleeping.set(cardBody, false);
            const n = pair.collision?.normal;
            const barrierTop = other.bounds.min.y;
            const cardBottom = cardBody.position.y + cardH / 2;
            /** Нормаль коллизии: при ударе сверху по «крыше» ось направлена вверх (отрицательный y). */
            const normalSaysTopHit = n && n.y < -0.06;
            const geomSaysTopHit =
              cardBottom <= barrierTop + 18 || cardBody.position.y + cardH * 0.28 < other.position.y;
            if (normalSaysTopHit || geomSaysTopHit) {
              const now = performance.now();
              if (
                cardBody._barrierKickAt != null &&
                now - cardBody._barrierKickAt < BARRIER_KICK_COOLDOWN_MS
              ) {
                continue;
              }
              cardBody._barrierKickAt = now;
              /** Раньше ~2.1 по x — визуально в ~7 раз быстрее падения, отсюда «рывок». */
              const kick = bounceKickX(cardBody, frW, 0.32);
              const vx0 = cardBody.velocity.x;
              const vy0 = cardBody.velocity.y;
              Body.setVelocity(cardBody, {
                x: vx0 * 0.72 + kick * 0.42,
                y: Math.max(vy0, 0.06) * 0.55 + 0.08 + Math.random() * 0.06,
              });
              Body.setAngularVelocity(
                cardBody,
                cardBody.angularVelocity * 0.55 + (Math.random() - 0.5) * 0.08,
              );
              clampCardVelocity(cardBody);
            }
            continue;
          }

          if (other.label === "wall-left") {
            Body.setVelocity(cardBody, {
              x: Math.max(cardBody.velocity.x, 0) * 0.45 + 0.32 + Math.random() * 0.12,
              y: cardBody.velocity.y,
            });
            clampCardVelocity(cardBody);
            continue;
          }
          if (other.label === "wall-right") {
            Body.setVelocity(cardBody, {
              x: Math.min(cardBody.velocity.x, 0) * 0.45 - 0.32 - Math.random() * 0.12,
              y: cardBody.velocity.y,
            });
            clampCardVelocity(cardBody);
          }
        }
      });

      const sinkMargin = 120;

      Events.on(engine, "afterUpdate", () => {
        const fr = fallLayer.getBoundingClientRect();
        if (fr.height < 4) {
          return;
        }

        for (let i = 0; i < cardBodies.length; i++) {
          const body = cardBodies[i];
          const itemEl = body._itemEl;
          if (!itemEl) {
            continue;
          }

          const top = body.position.y - cardH / 2;
          const sinkY = fr.height - sinkMargin;
          let opacity = 1;
          if (top > sinkY) {
            const t = (top - sinkY) / (fr.height * 0.42 + 1);
            opacity = Math.max(0, 1 - t);
          }

          if (top > fr.height + cardH + 24 || opacity <= 0.03) {
            const mainEl = fallLayer.closest("main");
            const ac = mainEl?.querySelector(".apply-card");
            if (!ac) {
              continue;
            }
            const slot = i < perSide ? 0 : 2;
            const laneIndex = i < perSide ? i : i - perSide;
            const baseY = baseSpawnCenterY(cardH);
            const peers = cardBodies.filter((_, j) => (j < perSide ? 0 : 2) === slot);
            const centerY = nextStreamCenterY(cardH, peers, body, baseY);
            const { x } = spawnCenterX(fr, ac, slot, cardW, cardH, laneIndex, perSide);
            Body.setPosition(body, { x, y: centerY });
            Body.setVelocity(body, {
              x: (Math.random() - 0.5) * CARD_FALL_VX_JITTER,
              y: CARD_FALL_VY_START,
            });
            Body.setAngle(body, spawnCardAngleRad(i, slot));
            Body.setAngularVelocity(body, spawnCardAngularVel(i, slot));
            Sleeping.set(body, false);
            itemEl.style.opacity = "1";
            const pool = fallLayer._startupPool;
            if (pool && pool.length > 0 && itemEl) {
              const seq =
                typeof fallLayer._startupSeq === "number"
                  ? fallLayer._startupSeq
                  : cardBodies.length;
              fallLayer._startupSeq = seq + 1;
              const idx = seq % pool.length;
              body._poolIndex = idx;
              setStartupFallItemContent(itemEl, pool[idx]);
            }
            triggerStartupCardSpawnPop(itemEl);
            continue;
          }

          itemEl.style.opacity = String(opacity);

          clampCardVelocity(body);

          const deg = body.angle * (180 / Math.PI);
          const x = body.position.x - cardW / 2;
          const y = body.position.y - cardH / 2;
          itemEl.style.left = `${x}px`;
          itemEl.style.top = `${y}px`;
          itemEl.style.transform = `rotate(${deg}deg)`;
        }
      });

      function rebuildBarriers() {
        const fr = fallLayer.getBoundingClientRect();
        const mainEl = fallLayer.closest("main");
        const ac = mainEl?.querySelector(".apply-card");
        if (!ac) {
          return;
        }
        Composite.remove(world, staticBodies);
        const rects = collectBarrierRects(fr, ac);
        const nextBarriers = barrierBodiesFromRects(rects);
        const nextWalls = edgeWallBodiesFromFallRect(fr);
        staticBodies = [...nextBarriers, ...nextWalls];
        Composite.add(world, staticBodies);
      }

      let resizeT = 0;
      const onResize = () => {
        window.clearTimeout(resizeT);
        resizeT = window.setTimeout(rebuildBarriers, 80);
      };
      window.addEventListener("resize", onResize);

      const runner = Runner.create();
      Runner.run(runner, engine);

      /** @type {ReturnType<typeof setTimeout>[]} */
      const initialSpawnPopTimers = [];
      items.forEach((el, idx) => {
        initialSpawnPopTimers.push(
          window.setTimeout(() => triggerStartupCardSpawnPop(el), 48 + idx * 62),
        );
      });

      active = {
        cleanup: () => {
          Runner.stop(runner);
          fallLayer.removeEventListener("selectstart", blockTextDrag);
          fallLayer.removeEventListener("dragstart", blockTextDrag);
          document.removeEventListener("mousemove", onClientPointer);
          document.removeEventListener("touchmove", onClientPointer);
          document.removeEventListener("touchstart", onClientPointer);
          window.removeEventListener("resize", onResize);
          window.clearTimeout(resizeT);
          for (const tid of initialSpawnPopTimers) {
            window.clearTimeout(tid);
          }
          World.clear(engine.world, false);
          fallLayer.classList.remove("startup-fall--physics");
          for (const itemEl of items) {
            if (itemEl._spawnPopTimerId != null) {
              window.clearTimeout(itemEl._spawnPopTimerId);
              itemEl._spawnPopTimerId = undefined;
            }
            itemEl.classList.remove("startup-fall__item--spawn-pop");
            itemEl.style.left = "";
            itemEl.style.top = "";
            itemEl.style.transform = "";
            itemEl.style.opacity = "";
          }
        },
      };

      return;
    }
  }

  const desktopMq = window.matchMedia("(min-width: 768px)");

  function syncPhysicsToViewport() {
    if (!desktopMq.matches) {
      if (active) {
        active.cleanup();
        active = null;
      }
      return;
    }
    setup();
  }

  let syncMqT = 0;
  function onDesktopMqChange() {
    window.clearTimeout(syncMqT);
    if (!desktopMq.matches) {
      syncPhysicsToViewport();
      return;
    }
    syncMqT = window.setTimeout(syncPhysicsToViewport, 100);
  }

  syncPhysicsToViewport();
  desktopMq.addEventListener("change", onDesktopMqChange);
}
