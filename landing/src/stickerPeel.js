/**
 * Peelable / draggable sticker (vanilla port of StickerPeel).
 * Bounds = parent of the returned root. GSAP Draggable + InertiaPlugin.
 */

import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";

gsap.registerPlugin(Draggable, InertiaPlugin);

let stickerUid = 0;

/**
 * @typedef {object} StickerPeelOptions
 * @property {string} imageSrc
 * @property {number} [rotate=0]
 * @property {number} [peelBackHoverPct=30]
 * @property {number} [peelBackActivePct=40]
 * @property {number} [width=200]
 * @property {number} [shadowIntensity=0.5]
 * @property {number} [lightingIntensity=0.1]
 * @property {'center' | { x: number, y: number }} [initialPosition='center']
 * @property {number} [peelDirection=0]
 * @property {string} [className='']
 * @property {string} [alt='']
 */

/**
 * @param {StickerPeelOptions} opts
 */
export function createStickerPeel(opts) {
  const {
    imageSrc,
    rotate = 0,
    peelBackHoverPct = 30,
    peelBackActivePct = 40,
    width = 200,
    shadowIntensity = 0.5,
    lightingIntensity = 0.1,
    initialPosition = "center",
    peelDirection = 0,
    className = "",
    alt = "",
  } = opts;

  const uid = ++stickerUid;
  const idPointLight = `sticker-pointLight-${uid}`;
  const idPointLightFlipped = `sticker-pointLightFlipped-${uid}`;
  const idDropShadow = `sticker-dropShadow-${uid}`;
  const idExpandAndFill = `sticker-expandAndFill-${uid}`;

  const root = document.createElement("div");
  root.className = ["landing-sticker", "draggable", className]
    .filter(Boolean)
    .join(" ");
  root.style.setProperty("--sticker-rotate", `${rotate}deg`);
  root.style.setProperty("--sticker-p", "var(--landing-sticker-padding)");
  root.style.setProperty("--sticker-peelback-hover", `${peelBackHoverPct}%`);
  root.style.setProperty("--sticker-peelback-active", `${peelBackActivePct}%`);
  root.style.setProperty("--sticker-width", `${width}px`);
  root.style.setProperty("--sticker-shadow-opacity", String(shadowIntensity));
  root.style.setProperty("--sticker-lighting-constant", String(lightingIntensity));
  root.style.setProperty("--peel-direction", `${peelDirection}deg`);

  const safeAlt = String(alt ?? "");
  root.innerHTML = `
    <svg class="landing-sticker__defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id="${idPointLight}">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feSpecularLighting
            result="spec"
            in="blur"
            specularExponent="100"
            specularConstant="${lightingIntensity}"
            lighting-color="white"
          >
            <fePointLight data-sticker-light x="100" y="100" z="300" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceGraphic" result="lit" />
          <feComposite in="lit" in2="SourceAlpha" operator="in" />
        </filter>

        <filter id="${idPointLightFlipped}">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feSpecularLighting
            result="spec"
            in="blur"
            specularExponent="100"
            specularConstant="${lightingIntensity * 7}"
            lighting-color="white"
          >
            <fePointLight data-sticker-light-flipped x="100" y="100" z="300" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceGraphic" result="lit" />
          <feComposite in="lit" in2="SourceAlpha" operator="in" />
        </filter>

        <filter id="${idDropShadow}">
          <feDropShadow
            dx="2"
            dy="4"
            stdDeviation="${3 * shadowIntensity}"
            flood-color="black"
            flood-opacity="${shadowIntensity}"
          />
        </filter>

        <filter id="${idExpandAndFill}">
          <feOffset dx="0" dy="0" in="SourceAlpha" result="shape" />
          <feFlood flood-color="var(--landing-sticker-back-flood)" result="flood" />
          <feComposite operator="in" in="flood" in2="shape" />
        </filter>
      </defs>
    </svg>

    <div class="sticker-container">
      <div class="sticker-main" style="filter: url(#${idDropShadow})">
        <div class="sticker-lighting" style="filter: url(#${idPointLight})">
          <img
            src="${imageSrc}"
            alt="${safeAlt}"
            class="sticker-image"
            draggable="false"
          />
        </div>
      </div>

      <div class="flap">
        <div class="flap-lighting" style="filter: url(#${idPointLightFlipped})">
          <img
            src="${imageSrc}"
            alt=""
            class="flap-image"
            draggable="false"
            style="filter: url(#${idExpandAndFill})"
          />
        </div>
      </div>
    </div>
  `.trim();

  const container = root.querySelector(".sticker-container");
  const pointLight = root.querySelector("[data-sticker-light]");
  const pointLightFlipped = root.querySelector("[data-sticker-light-flipped]");
  const images = root.querySelectorAll(".sticker-image, .flap-image");

  for (const img of images) {
    img.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** @type {Draggable | null} */
  let draggableInstance = null;
  /** @type {(() => void)[]} */
  const cleanups = [];

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (
    typeof initialPosition === "object" &&
    initialPosition &&
    Number.isFinite(initialPosition.x) &&
    Number.isFinite(initialPosition.y)
  ) {
    // Применяем после mount — иначе bounds / layout ещё нулевые.
    queueMicrotask(() => {
      gsap.set(root, { x: initialPosition.x, y: initialPosition.y });
    });
  }

  function bindDrag() {
    if (reduced) return;

    const boundsEl = root.parentNode;
    if (!(boundsEl instanceof Element)) return;

    draggableInstance = Draggable.create(root, {
      type: "x,y",
      bounds: boundsEl,
      inertia: true,
      onDrag() {
        const rot = gsap.utils.clamp(-24, 24, this.deltaX * 0.4);
        gsap.to(root, { rotation: rot, duration: 0.15, ease: "power1.out" });
      },
      onDragEnd() {
        gsap.to(root, { rotation: 0, duration: 0.8, ease: "power2.out" });
      },
    })[0];

    const handleResize = () => {
      if (!draggableInstance) return;
      draggableInstance.update();

      const currentX = Number(gsap.getProperty(root, "x"));
      const currentY = Number(gsap.getProperty(root, "y"));
      const boundsRect = boundsEl.getBoundingClientRect();
      const targetRect = root.getBoundingClientRect();
      const maxX = boundsRect.width - targetRect.width;
      const maxY = boundsRect.height - targetRect.height;
      const newX = Math.max(0, Math.min(currentX, maxX));
      const newY = Math.max(0, Math.min(currentY, maxY));

      if (newX !== currentX || newY !== currentY) {
        gsap.to(root, {
          x: newX,
          y: newY,
          duration: 0.3,
          ease: "power2.out",
        });
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    cleanups.push(() => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      if (draggableInstance) {
        draggableInstance.kill();
        draggableInstance = null;
      }
    });
  }

  function bindLight() {
    if (reduced || !container) return;

    const updateLight = (e) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (pointLight) gsap.set(pointLight, { attr: { x, y } });

      const normalizedAngle = Math.abs(peelDirection % 360);
      if (pointLightFlipped) {
        if (normalizedAngle !== 180) {
          gsap.set(pointLightFlipped, { attr: { x, y: rect.height - y } });
        } else {
          gsap.set(pointLightFlipped, { attr: { x: -1000, y: -1000 } });
        }
      }
    };

    container.addEventListener("mousemove", updateLight);
    cleanups.push(() => container.removeEventListener("mousemove", updateLight));
  }

  function bindTouch() {
    if (!container) return;

    const handleTouchStart = () => {
      container.classList.add("touch-active");
    };
    const handleTouchEnd = () => {
      container.classList.remove("touch-active");
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("touchcancel", handleTouchEnd);
    cleanups.push(() => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    });
  }

  // Draggable needs the node in the DOM to resolve bounds; defer one frame.
  queueMicrotask(() => {
    bindDrag();
    bindLight();
    bindTouch();
  });

  return {
    root,
    destroy() {
      for (const fn of cleanups.splice(0)) fn();
      root.remove();
    },
  };
}
