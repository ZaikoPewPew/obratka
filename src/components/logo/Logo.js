/**
 * Логотип стартапа (img или маска + заливка для hover-акцента на десктопе).
 * @param {{ src: string; alt: string; width?: number; height?: number; className?: string; useMaskHover?: boolean }} opts
 * @returns {HTMLElement}
 */
export function createLogo({
  src,
  alt,
  width = 64,
  height = 64,
  className = "",
  useMaskHover = false,
}) {
  if (useMaskHover) {
    const wrap = document.createElement("span");
    if (className) {
      wrap.className = className;
    }
    wrap.setAttribute("role", "img");
    wrap.setAttribute("aria-label", alt);
    wrap.style.setProperty("--logo-mask-url", `url(${JSON.stringify(src)})`);

    const fill = document.createElement("span");
    fill.className = "desktop-logo__fill";
    fill.setAttribute("aria-hidden", "true");

    wrap.append(fill);
    return wrap;
  }

  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  img.width = width;
  img.height = height;
  if (className) {
    img.className = className;
  }
  img.decoding = "async";
  return img;
}
