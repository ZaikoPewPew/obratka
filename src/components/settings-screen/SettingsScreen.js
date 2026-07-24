import { getStrings } from "../../i18n.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import { brandMarkSvg } from "../../assets/brand/brandMarks.js";

/**
 * Отдельный экран настроек. Пока содержит продуктовую заглушку.
 *
 * @param {{ onBack?: () => void | Promise<void> }} [opts]
 */
export function createSettingsScreen(opts = {}) {
  let closing = false;

  const root = document.createElement("section");
  root.className = "settings-screen";
  root.setAttribute("aria-labelledby", "settings-screen-title");
  root.hidden = true;

  const topbar = document.createElement("header");
  topbar.className = "settings-screen__topbar";

  const mark = document.createElement("div");
  mark.className = "settings-screen__mark";
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML = brandMarkSvg("settings-screen__mark-img");

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "settings-screen__back";

  topbar.append(mark, backBtn);

  const body = document.createElement("div");
  body.className = "settings-screen__body";

  const card = document.createElement("div");
  card.className = "settings-screen__card";

  const title = document.createElement("h1");
  title.className = "settings-screen__title";
  title.id = "settings-screen-title";

  const description = document.createElement("p");
  description.className = "settings-screen__description";

  card.append(title, description);
  body.append(card);
  root.append(topbar, body);

  function syncCopy() {
    const t = getStrings();
    title.textContent = t.settingsTitle ?? "";
    description.textContent = t.settingsNotReady ?? "";
    backBtn.textContent = t.settingsBack ?? "";
    backBtn.setAttribute("aria-label", t.settingsBackAria ?? t.settingsBack ?? "");
  }

  function open() {
    closing = false;
    syncCopy();
    root.hidden = false;
    root.classList.remove("settings-screen--open");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("settings-screen--open");
      });
    });
  }

  function close() {
    if (root.hidden || closing) return Promise.resolve();
    if (!root.classList.contains("settings-screen--open")) {
      root.hidden = true;
      return Promise.resolve();
    }

    closing = true;
    root.classList.remove("settings-screen--open");
    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        root.removeEventListener("transitionend", onEnd);
        window.clearTimeout(fallbackId);
        root.hidden = true;
        closing = false;
        resolve();
      };
      const onEnd = (event) => {
        if (event.target === root && event.propertyName === "opacity") {
          finish();
        }
      };
      root.addEventListener("transitionend", onEnd);
      const fallbackId = window.setTimeout(finish, getScreenCloseFallbackMs());
    });
  }

  backBtn.addEventListener("click", () => {
    void opts.onBack?.();
  });

  return { root, open, close };
}
