/**
 * Lottie «Rotating Ray» под PNG в explainer-медиа.
 * lottie-web и JSON грузятся при первом `sync()` — не на cold start.
 * Модалки стартуют `hidden` → после `open()` нужен `sync()` (resize + play).
 *
 * Размеры / цвет (#F3F4F7) / когда нужен filter:
 * [`src/assets/home/modal/README.md`](../../assets/home/modal/README.md)
 *
 * @returns {{ root: HTMLElement, sync: () => void, destroy: () => void }}
 */
export function createExplainerMediaRay() {
  const root = document.createElement("div");
  root.className = "home-screen__explainer-media-ray";
  root.setAttribute("aria-hidden", "true");

  /** @type {import("lottie-web").AnimationItem | null} */
  let anim = null;
  /** @type {Promise<import("lottie-web").AnimationItem | null> | null} */
  let loading = null;
  let destroyed = false;

  function ensureAnim() {
    if (destroyed) return Promise.resolve(null);
    if (anim) return Promise.resolve(anim);
    if (loading) return loading;

    loading = Promise.all([
      import("lottie-web"),
      import("../../assets/home/modal/rotating-ray.json"),
    ])
      .then(([lottieMod, dataMod]) => {
        if (destroyed) return null;
        const next = lottieMod.default.loadAnimation({
          container: root,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: dataMod.default ?? dataMod,
        });
        // 1/3 от дефолтной скорости Lottie (ещё в 2 раза медленнее прежних 2/3).
        next.setSpeed(1 / 3);
        anim = next;
        return next;
      })
      .catch(() => null)
      .finally(() => {
        loading = null;
      });

    return loading;
  }

  return {
    root,
    sync() {
      void ensureAnim().then((item) => {
        if (!item || destroyed) return;
        item.resize();
        item.play();
      });
    },
    destroy() {
      destroyed = true;
      if (anim) {
        anim.destroy();
        anim = null;
      }
    },
  };
}
