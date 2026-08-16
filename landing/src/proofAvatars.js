/**
 * Стек аватаров под hero-CTA. Тот же пул, что под инпутом на `/referral`.
 */

import founderAvatars from "../../content/founder-avatars.json";

const UNAVATAR_BASE = "https://unavatar.io/";

/**
 * @param {string} source — путь после unavatar.io/, напр. github/octocat
 * @returns {string}
 */
function unavatarSrc(source) {
  const trimmed = String(source).replace(/^\/+/, "");
  const path = trimmed
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${UNAVATAR_BASE}${path}`;
}

function pickSources() {
  const list = founderAvatars.sources;
  const pool = Array.isArray(list) ? [...list] : [];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const n = founderAvatars.pickCount;
  const count = typeof n === "number" && n > 0 ? Math.floor(n) : 4;
  return pool.slice(0, Math.min(count, pool.length));
}

/**
 * @param {string} source
 * @returns {HTMLSpanElement}
 */
function createFounderAvatar(source) {
  const avatar = document.createElement("span");
  avatar.className =
    "landing-proof__avatar landing-proof__avatar--placeholder landing-proof__avatar--photo";

  const img = document.createElement("img");
  img.className = "landing-proof__avatar-img";
  img.src = unavatarSrc(source);
  img.alt = "";
  img.width = 32;
  img.height = 32;
  img.decoding = "async";
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";

  function revealPhoto() {
    avatar.classList.remove("landing-proof__avatar--placeholder");
    avatar.classList.add("landing-proof__avatar--photo-ready");
  }

  img.addEventListener("load", revealPhoto);
  if (img.complete && img.naturalWidth > 0) {
    revealPhoto();
  }
  img.addEventListener("error", () => {
    img.remove();
    avatar.classList.remove(
      "landing-proof__avatar--photo",
      "landing-proof__avatar--photo-ready",
    );
  });

  avatar.append(img);
  return avatar;
}

/**
 * @param {ParentNode | null} root
 * @returns {HTMLElement | null}
 */
export function mountLandingProof(root) {
  if (!(root instanceof HTMLElement)) return null;

  const stack = document.createElement("div");
  stack.className = "landing-proof__avatars";
  stack.setAttribute("aria-hidden", "true");
  for (const source of pickSources()) {
    stack.append(createFounderAvatar(source));
  }
  root.prepend(stack);
  return root;
}
