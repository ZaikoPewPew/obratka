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
    const a = document.createElement("a");
    if (className) {
      a.className = className;
    }
    a.setAttribute("aria-label", alt);
    if (typeof window !== "undefined") {
      a.href = `${window.location.pathname}${window.location.search}` || "/";
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        e.preventDefault();
        window.location.reload();
      });
    } else {
      a.href = "/";
    }
    a.style.setProperty("--logo-mask-url", `url(${JSON.stringify(src)})`);

    const fill = document.createElement("span");
    fill.className = "desktop-logo__fill";
    fill.setAttribute("aria-hidden", "true");

    a.append(fill);
    return a;
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
