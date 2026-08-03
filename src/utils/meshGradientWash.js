const COLOR_VARS = [
  "--url-screen-mesh-1",
  "--url-screen-mesh-2",
  "--url-screen-mesh-3",
  "--url-screen-mesh-4",
];

/**
 * @param {HTMLElement} el
 * @param {string} name
 * @param {string} fallback
 */
function readCssVar(el, name, fallback) {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * @param {HTMLElement} el
 * @param {string} name
 * @param {number} fallback
 */
function readCssNumber(el, name, fallback) {
  const raw = readCssVar(el, name, "");
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {HTMLElement} el
 */
function readMeshParams(el) {
  const root = document.documentElement;
  const colors = COLOR_VARS.map((name) =>
    readCssVar(el, name, readCssVar(root, name, "")),
  );

  return {
    colors,
    distortion: readCssNumber(el, "--url-screen-mesh-distortion", 0.8),
    swirl: readCssNumber(el, "--url-screen-mesh-swirl", 0.2),
    grainMixer: readCssNumber(el, "--url-screen-mesh-grain-mixer", 0.15),
    grainOverlay: readCssNumber(el, "--url-screen-mesh-grain-overlay", 0.08),
    speed: readCssNumber(el, "--url-screen-mesh-speed", 0.25),
  };
}

/**
 * @param {[number, number, number, number]} a
 * @param {[number, number, number, number]} b
 * @param {number} t
 * @returns {[number, number, number, number]}
 */
function lerpRgba(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** @type {Promise<{
 *   ShaderMount: typeof import("@paper-design/shaders").ShaderMount;
 *   meshGradientFragmentShader: string;
 *   ShaderFitOptions: typeof import("@paper-design/shaders").ShaderFitOptions;
 *   defaultObjectSizing: typeof import("@paper-design/shaders").defaultObjectSizing;
 *   getShaderColorFromString: typeof import("@paper-design/shaders").getShaderColorFromString;
 * }> | null} */
let shaderLibsPromise = null;

function loadShaderLibs() {
  if (!shaderLibsPromise) {
    // Пакет экспортирует только "."; deep paths ломают Vite resolve.
    shaderLibsPromise = import("@paper-design/shaders").then((mod) => ({
      ShaderMount: mod.ShaderMount,
      meshGradientFragmentShader: mod.meshGradientFragmentShader,
      ShaderFitOptions: mod.ShaderFitOptions,
      defaultObjectSizing: mod.defaultObjectSizing,
      getShaderColorFromString: mod.getShaderColorFromString,
    }));
  }
  return shaderLibsPromise;
}

/**
 * Mesh-градиент (Paper Shaders) с палитрой и параметрами из CSS-токенов.
 * ShaderMount и пакет шейдеров поднимаются только при первом refresh / setActive(true).
 * @param {HTMLElement} container
 * @returns {{
 *   refresh: () => void;
 *   setActive: (active: boolean) => void;
 *   transitionToCssColors: (opts?: { durationMs?: number; easing?: string }) => void;
 *   dispose: () => void;
 * }}
 */
export function mountMeshGradientWash(container) {
  const reduced = prefersReducedMotion();
  let active = false;
  let disposed = false;
  /** @type {string[]} */
  let currentColors = readMeshParams(container).colors.slice();
  /** @type {number | null} */
  let colorRafId = null;
  /** @type {HTMLElement | null} */
  let easeProbe = null;
  let colorAnimGen = 0;
  /** @type {InstanceType<typeof import("@paper-design/shaders").ShaderMount> | null} */
  let mount = null;
  /** @type {Awaited<ReturnType<typeof loadShaderLibs>> | null} */
  let libs = null;
  /** @type {Promise<void> | null} */
  let ensuring = null;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMotionChange = () => {
    if (!disposed && mount) mount.setSpeed(resolveSpeed());
  };
  motionQuery.addEventListener("change", onMotionChange);

  function resolveSpeed() {
    if (disposed || !active || prefersReducedMotion()) return 0;
    return readMeshParams(container).speed;
  }

  function cancelColorTransition() {
    colorAnimGen += 1;
    if (colorRafId != null) {
      window.cancelAnimationFrame(colorRafId);
      colorRafId = null;
    }
    if (easeProbe) {
      easeProbe.remove();
      easeProbe = null;
    }
  }

  /**
   * @param {ReturnType<typeof readMeshParams>} params
   */
  function toUniforms(params) {
    if (!libs) return null;
    return {
      u_colors: params.colors.map(libs.getShaderColorFromString),
      u_colorsCount: params.colors.length,
      u_distortion: params.distortion,
      u_swirl: params.swirl,
      u_grainMixer: params.grainMixer,
      u_grainOverlay: params.grainOverlay,
      u_fit: libs.ShaderFitOptions[libs.defaultObjectSizing.fit],
      u_scale: libs.defaultObjectSizing.scale,
      u_rotation: libs.defaultObjectSizing.rotation,
      u_offsetX: libs.defaultObjectSizing.offsetX,
      u_offsetY: libs.defaultObjectSizing.offsetY,
      u_originX: libs.defaultObjectSizing.originX,
      u_originY: libs.defaultObjectSizing.originY,
      u_worldWidth: libs.defaultObjectSizing.worldWidth,
      u_worldHeight: libs.defaultObjectSizing.worldHeight,
    };
  }

  /**
   * @param {ReturnType<typeof readMeshParams>} next
   */
  function applyParams(next) {
    if (!mount) return;
    const uniforms = toUniforms(next);
    if (!uniforms) return;
    currentColors = next.colors.slice();
    mount.setUniforms(uniforms);
    mount.setSpeed(resolveSpeed());
  }

  function ensureMount() {
    if (disposed) return Promise.resolve();
    if (mount) return Promise.resolve();
    if (ensuring) return ensuring;

    ensuring = loadShaderLibs()
      .then((loaded) => {
        if (disposed || mount) return;
        libs = loaded;
        const params = readMeshParams(container);
        const uniforms = toUniforms(params);
        if (!uniforms) return;
        currentColors = params.colors.slice();
        mount = new libs.ShaderMount(
          container,
          libs.meshGradientFragmentShader,
          uniforms,
          undefined,
          reduced || !active ? 0 : params.speed,
          0,
          1,
          1_500_000,
        );
        mount.setSpeed(resolveSpeed());
      })
      .catch(() => {
        /* shader load failed — leave glow empty */
      })
      .finally(() => {
        ensuring = null;
      });

    return ensuring;
  }

  function refresh() {
    if (disposed) return;
    cancelColorTransition();
    void ensureMount().then(() => {
      if (disposed || !mount) return;
      applyParams(readMeshParams(container));
    });
  }

  /**
   * Плавно перейти к палитре из текущих CSS-токенов контейнера.
   * Easing берётся из CSS transition на probe (opacity), чтобы совпадать с токенами.
   * @param {{ durationMs?: number; easing?: string }} [opts]
   */
  function transitionToCssColors(opts = {}) {
    if (disposed) return;

    void ensureMount().then(() => {
      if (disposed || !mount || !libs) return;

      const next = readMeshParams(container);
      const durationMs =
        typeof opts.durationMs === "number" && opts.durationMs >= 0
          ? opts.durationMs
          : 800;
      const easing = opts.easing || "ease";

      if (prefersReducedMotion() || durationMs === 0) {
        cancelColorTransition();
        applyParams(next);
        return;
      }

      const fromColors = currentColors.map(libs.getShaderColorFromString);
      const toColors = next.colors.map(libs.getShaderColorFromString);
      const count = Math.min(fromColors.length, toColors.length);

      cancelColorTransition();
      const gen = colorAnimGen;

      const probe = document.createElement("span");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = [
        "position:absolute",
        "width:0",
        "height:0",
        "overflow:hidden",
        "pointer-events:none",
        "opacity:0",
        `transition:opacity ${durationMs}ms ${easing}`,
      ].join(";");
      container.append(probe);
      easeProbe = probe;
      void probe.offsetWidth;
      probe.style.opacity = "1";

      const startedAt = performance.now();

      const tick = () => {
        if (disposed || !mount || gen !== colorAnimGen) return;

        const eased = Number.parseFloat(getComputedStyle(probe).opacity);
        const t = Number.isFinite(eased) ? Math.min(1, Math.max(0, eased)) : 1;
        /** @type {[number, number, number, number][]} */
        const mixed = [];
        for (let i = 0; i < count; i += 1) {
          mixed.push(lerpRgba(fromColors[i], toColors[i], t));
        }
        mount.setUniforms({
          u_colors: mixed,
          u_colorsCount: mixed.length,
        });

        const elapsed = performance.now() - startedAt;
        if (t < 0.995 && elapsed < durationMs + 120) {
          colorRafId = window.requestAnimationFrame(tick);
          return;
        }

        colorRafId = null;
        applyParams(next);
        if (easeProbe === probe) {
          probe.remove();
          easeProbe = null;
        }
      };

      colorRafId = window.requestAnimationFrame(tick);
    });
  }

  function setActive(nextActive) {
    if (disposed) return;
    active = Boolean(nextActive);
    if (active) {
      void ensureMount().then(() => {
        if (!disposed && mount) mount.setSpeed(resolveSpeed());
      });
      return;
    }
    if (mount) mount.setSpeed(0);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelColorTransition();
    motionQuery.removeEventListener("change", onMotionChange);
    if (mount) {
      mount.dispose();
      mount = null;
    }
  }

  return {
    refresh,
    setActive,
    transitionToCssColors,
    dispose,
  };
}
