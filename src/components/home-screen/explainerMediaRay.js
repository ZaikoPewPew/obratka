import lottie from "lottie-web";
import rotatingRayAnimation from "../../assets/home/modal/rotating-ray.json";

/**
 * Lottie «Rotating Ray» под PNG в explainer-медиа (между тёмным фоном и фото).
 *
 * @returns {{ root: HTMLElement, destroy: () => void }}
 */
export function createExplainerMediaRay() {
  const root = document.createElement("div");
  root.className = "home-screen__explainer-media-ray";
  root.setAttribute("aria-hidden", "true");

  const anim = lottie.loadAnimation({
    container: root,
    renderer: "svg",
    loop: true,
    autoplay: true,
    animationData: rotatingRayAnimation,
  });
  // 1/3 от дефолтной скорости Lottie (ещё в 2 раза медленнее прежних 2/3).
  anim.setSpeed(1 / 3);

  return {
    root,
    destroy() {
      anim.destroy();
    },
  };
}
