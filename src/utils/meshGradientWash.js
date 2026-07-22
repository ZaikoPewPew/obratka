import {
  ShaderMount,
  ShaderFitOptions,
  defaultObjectSizing,
  getShaderColorFromString,
  meshGradientFragmentShader,
} from "@paper-design/shaders";

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
  const colors = COLOR_VARS.map((name, index) =>
    readCssVar(el, name, ["#fdeeee", "#f0ebff", "#d7ebff", "#8bb5ff"][index]),
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
 * @param {ReturnType<typeof readMeshParams>} params
 */
function toUniforms(params) {
  return {
    u_colors: params.colors.map(getShaderColorFromString),
    u_colorsCount: params.colors.length,
    u_distortion: params.distortion,
    u_swirl: params.swirl,
    u_grainMixer: params.grainMixer,
    u_grainOverlay: params.grainOverlay,
    u_fit: ShaderFitOptions[defaultObjectSizing.fit],
    u_scale: defaultObjectSizing.scale,
    u_rotation: defaultObjectSizing.rotation,
    u_offsetX: defaultObjectSizing.offsetX,
    u_offsetY: defaultObjectSizing.offsetY,
    u_originX: defaultObjectSizing.originX,
    u_originY: defaultObjectSizing.originY,
    u_worldWidth: defaultObjectSizing.worldWidth,
    u_worldHeight: defaultObjectSizing.worldHeight,
  };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Mesh-градиент (Paper Shaders) с палитрой и параметрами из CSS-токенов.
 * @param {HTMLElement} container
 * @returns {{ refresh: () => void; setActive: (active: boolean) => void; dispose: () => void }}
 */
export function mountMeshGradientWash(container) {
  const params = readMeshParams(container);
  const reduced = prefersReducedMotion();
  let active = true;
  let disposed = false;

  const mount = new ShaderMount(
    container,
    meshGradientFragmentShader,
    toUniforms(params),
    undefined,
    reduced ? 0 : params.speed,
    0,
    1,
    1_500_000,
  );

  function resolveSpeed() {
    if (disposed || !active || prefersReducedMotion()) return 0;
    return readMeshParams(container).speed;
  }

  function refresh() {
    if (disposed) return;
    const next = readMeshParams(container);
    mount.setUniforms(toUniforms(next));
    mount.setSpeed(resolveSpeed());
  }

  function setActive(nextActive) {
    if (disposed) return;
    active = Boolean(nextActive);
    mount.setSpeed(resolveSpeed());
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    mount.dispose();
  }

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMotionChange = () => {
    if (!disposed) mount.setSpeed(resolveSpeed());
  };
  motionQuery.addEventListener("change", onMotionChange);

  const originalDispose = dispose;
  return {
    refresh,
    setActive,
    dispose() {
      motionQuery.removeEventListener("change", onMotionChange);
      originalDispose();
    },
  };
}
