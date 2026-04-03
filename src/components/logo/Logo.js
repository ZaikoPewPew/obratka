/**
 * Логотип стартапа (img).
 * @param {{ src: string; alt: string; width?: number; height?: number; className?: string }} opts
 * @returns {HTMLImageElement}
 */
export function createLogo({ src, alt, width = 64, height = 64, className = "" }) {
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
