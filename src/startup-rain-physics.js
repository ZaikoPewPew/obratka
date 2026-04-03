/**
 * Дождь по стартап-карточкам: Matter.js (стакание, отскоки от блоков заявки, drag мышью / тачем).
 */

import Matter from "matter-js";

const BARRIER_SELECTORS = [
  ".apply-card__title",
  ".apply-card__subtitle",
  ".apply-card__cta",
  ".apply-card__divider",
  ".email-input-shell",
];

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

/**
 * @param {DOMRect} fallRect
 * @param {number} slot
 * @param {number} cardW
 * @param {number} index
 */
function spawnCoords(fallRect, slot, cardW, index) {
  const w = fallRect.width;
  let x;
  if (slot === 0) {
    x = Math.max(4, Math.min(32, w * 0.02));
  } else if (slot === 1) {
    x = (w - cardW) / 2;
  } else {
    x = w - cardW - Math.max(4, Math.min(32, w * 0.02));
  }
  return {
    x: x + cardW / 2 + (Math.random() - 0.5) * 14,
    y: -60 - index * 90 - Math.random() * 70,
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
      friction: 0.95,
      frictionStatic: 1,
      restitution: 0.05,
      label: "barrier",
      plugin: { barrier: true },
    });
  });
}

/**
 * @param {DOMRect} fallRect
 * @param {HTMLElement} applyCard
 */
function collectBarrierRects(fallRect, applyCard) {
  return BARRIER_SELECTORS.map((sel) => applyCard.querySelector(sel))
    .filter(Boolean)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - fallRect.left,
        top: r.top - fallRect.top,
        width: r.width,
        height: r.height,
      };
    })
    .filter((b) => b.width > 0 && b.height > 0);
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
      Composite.add(world, barriers);

      /** @type {import('matter-js').Body[]} */
      const cardBodies = [];

      for (let i = 0; i < items.length; i++) {
        const itemEl = items[i];
        const slot = i % 3;
        const { x, y } = spawnCoords(fallRect0, slot, cardW, i);
        const body = Bodies.rectangle(x, y, cardW, cardH, {
          friction: 0.65,
          frictionAir: 0.018,
          restitution: 0.12,
          density: 0.0022,
          label: "startup-card",
        });
        body._itemEl = itemEl;
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
        for (let p = 0; p < pairs.length; p++) {
          const pair = pairs[p];
          const a = pair.bodyA;
          const b = pair.bodyB;
          const cardBody = a.label === "startup-card" ? a : b.label === "startup-card" ? b : null;
          const isBar = a.label === "barrier" || b.label === "barrier";
          if (cardBody && isBar && cardBody._itemEl) {
            flashSplash(cardBody._itemEl);
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
            const slot = i % 3;
            const { x, y } = spawnCoords(fr, slot, cardW, i);
            Body.setPosition(body, { x, y });
            Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.6, y: 0.2 });
            Body.setAngularVelocity(body, 0);
            Body.setAngle(body, (Math.random() - 0.5) * 0.15);
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

      let barrierComposite = barriers;

      function rebuildBarriers() {
        const fr = fallLayer.getBoundingClientRect();
        const mainEl = fallLayer.closest("main");
        const ac = mainEl?.querySelector(".apply-card");
        if (!ac) {
          return;
        }
        Composite.remove(world, barrierComposite);
        const rects = collectBarrierRects(fr, ac);
        barrierComposite = barrierBodiesFromRects(rects);
        Composite.add(world, barrierComposite);
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
