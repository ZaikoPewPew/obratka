/**
 * Дождь по стартап-карточкам: Matter.js (стакание, отскоки от блоков заявки, drag мышью / тачем).
 */

import Matter from "matter-js";

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

/** Одинаковая стартовая вертикальная скорость падения (случай только по горизонтали). */
const CARD_FALL_VY = 0.32;
const CARD_FALL_VX_JITTER = 0.4;

/**
 * Спавн только слева/справа от `.apply-card`, без центральной колонки (нет падений на «крышу»).
 * @param {DOMRect} fallRect
 * @param {HTMLElement} applyCard
 * @param {0 | 2} slot — Matter: левый / правый край для отскока
 * @param {number} cardW
 * @param {number} index — индекс тела (0..perSide-1 слева, perSide.. справа)
 * @param {number} perSide
 */
function spawnCoords(fallRect, applyCard, slot, cardW, index, perSide) {
  const w = fallRect.width;
  const pad = Math.max(4, Math.min(32, w * 0.02));
  const gap = 16;
  const ac = applyCard.getBoundingClientRect();
  const acl = ac.left - fallRect.left;
  const acr = ac.right - fallRect.left;

  const colIndex = index < perSide ? index : index - perSide;
  const row = colIndex % perSide;
  const wave = Math.floor(colIndex / perSide);

  const clampCenter = (cx) => Math.max(cardW / 2 + 2, Math.min(w - cardW / 2 - 2, cx));

  let centerX;
  if (slot === 0) {
    const maxCX = acl - gap - cardW / 2;
    const minCX = cardW / 2 + pad;
    if (maxCX > minCX + 12) {
      centerX = minCX + Math.random() * (maxCX - minCX);
    } else {
      centerX = clampCenter(cardW / 2 + pad + Math.random() * Math.min(56, w * 0.08));
    }
  } else {
    const minCX = acr + gap + cardW / 2;
    const maxCX = w - cardW / 2 - pad;
    if (maxCX > minCX + 12) {
      centerX = minCX + Math.random() * (maxCX - minCX);
    } else {
      centerX = clampCenter(w - cardW / 2 - pad - Math.random() * Math.min(56, w * 0.08));
    }
  }

  return {
    x: clampCenter(centerX + (Math.random() - 0.5) * 14),
    y: -48 - row * 92 - wave * 52 - Math.random() * 76,
  };
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
      friction: 0.35,
      frictionStatic: 0.5,
      restitution: 0.38,
      label: "barrier",
      plugin: { barrier: true },
    });
  });
}

/** Боковые стенки зоны падения (локальные координаты слоя).
 * Верхнюю границу не делаем статическим телом: при спавне y≈−52 нижняя грань тела
 * всё ещё может пересекать полосу у y=0 — Matter зажимает карточки и они «замирают».
 * Верх — только барьер заголовка формы + collisionStart. */
function edgeWallBodiesFromFallRect(fr) {
  const w = fr.width;
  const h = fr.height;
  const t = 36;
  const wallOpts = {
    isStatic: true,
    friction: 0.28,
    frictionStatic: 0.45,
    restitution: 0.42,
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
  const j = (Math.random() - 0.5) * 0.5;
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

      engine.gravity.y = 0.42;
      engine.gravity.scale = 0.00062;

      const world = engine.world;

      const barrierRects = collectBarrierRects(fallRect0, applyCard);
      const barriers = barrierBodiesFromRects(barrierRects);
      const edgeWalls = edgeWallBodiesFromFallRect(fallRect0);
      /** @type {import('matter-js').Body[]} */
      let staticBodies = [...barriers, ...edgeWalls];
      Composite.add(world, staticBodies);

      /** @type {import('matter-js').Body[]} */
      const cardBodies = [];

      for (let i = 0; i < items.length; i++) {
        const itemEl = items[i];
        const slot = i < perSide ? 0 : 2;
        const { x, y } = spawnCoords(fallRect0, applyCard, slot, cardW, i, perSide);
        const body = Bodies.rectangle(x, y, cardW, cardH, {
          friction: 0.52,
          frictionAir: 0.018,
          restitution: 0.14,
          density: 0.0022,
          label: "startup-card",
        });
        body._itemEl = itemEl;
        body._slot = slot;
        const tilt = 0.24;
        Body.setAngle(body, (Math.random() - 0.5) * tilt);
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.045);
        Body.setVelocity(body, {
          x: (Math.random() - 0.5) * CARD_FALL_VX_JITTER,
          y: CARD_FALL_VY,
        });
        cardBodies.push(body);
        Composite.add(world, body);
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
              const kick = bounceKickX(cardBody, frW, 2.12);
              Body.setVelocity(cardBody, {
                x: cardBody.velocity.x * 0.35 + kick,
                y: Math.max(cardBody.velocity.y, 0.42) + Math.random() * 0.35,
              });
              Body.setAngularVelocity(
                cardBody,
                cardBody.angularVelocity + (Math.random() - 0.5) * 0.09,
              );
            }
            continue;
          }

          if (other.label === "wall-left") {
            Body.setVelocity(cardBody, {
              x: Math.max(cardBody.velocity.x, 0) * 0.25 + 1.85 + Math.random() * 0.35,
              y: cardBody.velocity.y,
            });
            continue;
          }
          if (other.label === "wall-right") {
            Body.setVelocity(cardBody, {
              x: Math.min(cardBody.velocity.x, 0) * 0.25 - 1.85 - Math.random() * 0.35,
              y: cardBody.velocity.y,
            });
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
            const { x, y } = spawnCoords(fr, ac, slot, cardW, i, perSide);
            Body.setPosition(body, { x, y });
            Body.setVelocity(body, {
              x: (Math.random() - 0.5) * CARD_FALL_VX_JITTER,
              y: CARD_FALL_VY,
            });
            const tilt = 0.22;
            Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.052);
            Body.setAngle(body, (Math.random() - 0.5) * tilt);
            Sleeping.set(body, false);
            itemEl.style.opacity = "1";
            continue;
          }

          itemEl.style.opacity = String(opacity);

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
          World.clear(engine.world, false);
          fallLayer.classList.remove("startup-fall--physics");
          for (const itemEl of items) {
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

  setup();
}
