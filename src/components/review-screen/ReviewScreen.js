import { getStrings } from "../../i18n.js";
import {
  brandMarkSvg,
  logoDoneMarkSvg,
} from "../../assets/brand/brandMarks.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import {
  getReportLaunchMotion,
  getReviewMeshDoneMotion,
  getScreenCloseFallbackMs,
} from "../../utils/motionTokens.js";
import { buildReportSections } from "../../utils/reviewReport.js";

const BRAND_MARK_CLASS = "review-screen__brand-mark";
const BRAND_MARK_SVG = brandMarkSvg(BRAND_MARK_CLASS);
const LOGO_DONE_SVG = logoDoneMarkSvg(BRAND_MARK_CLASS);


/**
 * Полноэкранный экран опросника после сессии (layout как UrlScreen).
 * Слева — подложка с опросником, справа — brand visual.
 *
 * @param {{
 *   content: HTMLElement;
 * }} opts
 * @returns {{
 *   root: HTMLElement;
 *   open: () => void;
 *   close: () => Promise<void>;
 *   setReportReveal: (
 *     active: boolean,
 *     payload?: {
 *       answers?: import("../../utils/reviewReport.js").ReviewAnswers | null;
 *       portfolioName?: string;
 *       submitted?: boolean;
 *     },
 *   ) => void;
 * }}
 */
export function createReviewScreen({ content }) {
  const t = getStrings();

  const root = document.createElement("section");
  root.className = "review-screen";
  root.setAttribute("aria-labelledby", "review-panel-title");
  root.setAttribute("aria-label", t.reviewPanelAria);
  root.hidden = true;

  const layout = document.createElement("div");
  layout.className = "review-screen__layout";

  const panel = document.createElement("div");
  panel.className = "review-screen__panel";
  panel.append(content);

  const visual = document.createElement("div");
  visual.className = "review-screen__visual";
  visual.setAttribute("aria-hidden", "true");

  const glow = document.createElement("div");
  glow.className = "review-screen__glow";

  const report = document.createElement("div");
  report.className = "review-screen__report";

  const reportSheet = document.createElement("div");
  reportSheet.className = "review-screen__report-sheet";

  const reportEyebrow = document.createElement("p");
  reportEyebrow.className = "review-screen__report-eyebrow";
  reportEyebrow.textContent = t.brandName;

  const reportTitle = document.createElement("p");
  reportTitle.className = "review-screen__report-title";
  reportTitle.textContent = t.reportDocumentTitle;

  const reportSubtitle = document.createElement("p");
  reportSubtitle.className = "review-screen__report-subtitle";

  const reportBody = document.createElement("div");
  reportBody.className = "review-screen__report-body";

  reportSheet.append(reportEyebrow, reportTitle, reportSubtitle, reportBody);
  report.append(reportSheet);

  const noise = document.createElement("span");
  noise.className = "review-screen__noise";

  const brand = document.createElement("div");
  brand.className = "review-screen__brand";

  const brandSlot = document.createElement("div");
  brandSlot.className = "review-screen__brand-slot";
  brandSlot.innerHTML = BRAND_MARK_SVG;
  brand.append(brandSlot);

  visual.append(glow, noise, report, brand);
  const meshWash = mountMeshGradientWash(glow);
  meshWash.setActive(false);

  layout.append(panel, visual);
  root.append(layout);

  let closing = false;
  /** @type {Animation | null} */
  let reportLaunchAnim = null;
  /** После submit: зелёный mesh, когда лого начинает спуск. */
  let pendingDoneMesh = false;

  /**
   * @param {import("../../utils/reviewReport.js").ReviewAnswers | null | undefined} answers
   * @param {string} [portfolioName]
   */
  function fillReportSheet(answers, portfolioName) {
    const strings = getStrings();
    reportEyebrow.textContent = strings.brandName;
    reportTitle.textContent = strings.reportDocumentTitle;
    reportSubtitle.textContent =
      portfolioName?.trim() || strings.brandName;

    reportBody.replaceChildren();
    if (!answers) return;

    const sections = buildReportSections(answers, strings);
    for (const section of sections) {
      const block = document.createElement("section");
      block.className = "review-screen__report-section";

      const heading = document.createElement("h3");
      heading.className = "review-screen__report-section-title";
      heading.textContent = section.title;

      const body = document.createElement("p");
      body.className = "review-screen__report-section-body";
      body.textContent = section.body;

      block.append(heading, body);
      reportBody.append(block);
    }
  }

  function clearReportSheet() {
    reportBody.replaceChildren();
    reportSubtitle.textContent = "";
  }

  function setDefaultBrandMark() {
    brandSlot.innerHTML = BRAND_MARK_SVG;
  }

  function setLogoDoneMark() {
    brandSlot.innerHTML = LOGO_DONE_SVG;
  }

  function clearDoneMesh() {
    pendingDoneMesh = false;
    root.classList.remove("review-screen--done");
    setDefaultBrandMark();
    meshWash.refresh();
  }

  /** Зелёный mesh + logo-done: старт вместе со спуском лого. */
  function activateDoneMesh() {
    if (root.classList.contains("review-screen--done")) return;
    setLogoDoneMark();
    root.classList.add("review-screen--done");
    const { durationMs, easing } = getReviewMeshDoneMotion();
    meshWash.transitionToCssColors({ durationMs, easing });
  }

  function releaseReportBrand() {
    root.classList.remove("review-screen--report");
    if (pendingDoneMesh) {
      pendingDoneMesh = false;
      activateDoneMesh();
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function cancelReportLaunch() {
    if (!reportLaunchAnim) return;
    reportLaunchAnim.cancel();
    reportLaunchAnim = null;
    report.style.transition = "";
    report.style.opacity = "";
    report.style.transform = "";
  }

  /**
   * Уход листа: лёгкий подъём (разгон) → бросок вниз, opacity всегда 1.
   * После анимации снимается `--report` — тогда лого спускается в центр.
   * @returns {Promise<void>}
   */
  function launchReportAway() {
    cancelReportLaunch();

    if (!root.classList.contains("review-screen--report")) {
      clearReportSheet();
      if (pendingDoneMesh) {
        pendingDoneMesh = false;
        activateDoneMesh();
      }
      return Promise.resolve();
    }

    if (prefersReducedMotion()) {
      releaseReportBrand();
      clearReportSheet();
      return Promise.resolve();
    }

    const { durationMs, liftPx, peak, easeLift, easeDive } =
      getReportLaunchMotion();
    const styles = getComputedStyle(root);
    const shown =
      styles.getPropertyValue("--shell-review-report-shift-shown").trim() ||
      "22%";
    const hidden =
      styles.getPropertyValue("--shell-review-report-shift-hidden").trim() ||
      "100%";

    report.style.transition = "none";
    report.style.opacity = "1";

    const anim = report.animate(
      [
        {
          transform: `translate(-50%, ${shown})`,
          opacity: 1,
          offset: 0,
          easing: easeLift,
        },
        {
          transform: `translate(-50%, calc(${shown} - ${liftPx}px))`,
          opacity: 1,
          offset: peak,
          easing: easeDive,
        },
        {
          transform: `translate(-50%, ${hidden})`,
          opacity: 1,
          offset: 1,
        },
      ],
      {
        duration: durationMs,
        fill: /** @type {FillMode} */ ("forwards"),
      },
    );
    reportLaunchAnim = anim;

    return anim.finished
      .catch(() => {
        /* cancelled */
      })
      .then(() => {
        if (reportLaunchAnim !== anim) return;
        reportLaunchAnim = null;
        if (typeof anim.commitStyles === "function") {
          anim.commitStyles();
        }
        anim.cancel();
        releaseReportBrand();
        clearReportSheet();
        report.style.transition = "none";
        report.style.opacity = "";
        report.style.transform = "";
        void report.offsetWidth;
        report.style.transition = "";
      });
  }

  /**
   * @param {boolean} active
   * @param {{
   *   answers?: import("../../utils/reviewReport.js").ReviewAnswers | null;
   *   portfolioName?: string;
   *   submitted?: boolean;
   * }} [payload]
   */
  function setReportReveal(active, payload = {}) {
    if (active) {
      pendingDoneMesh = false;
      cancelReportLaunch();
      fillReportSheet(payload.answers, payload.portfolioName);
      root.classList.add("review-screen--report");
      return;
    }

    if (payload.submitted) {
      pendingDoneMesh = true;
    }

    void launchReportAway();
  }

  function open() {
    closing = false;
    cancelReportLaunch();
    root.classList.remove("review-screen--report");
    clearDoneMesh();
    clearReportSheet();
    root.hidden = false;
    root.classList.remove("review-screen--open");
    meshWash.refresh();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("review-screen--open");
        meshWash.setActive(true);
      });
    });
  }

  /**
   * @returns {Promise<void>}
   */
  function close() {
    if (root.hidden || closing) {
      return Promise.resolve();
    }

    if (!root.classList.contains("review-screen--open")) {
      meshWash.setActive(false);
      cancelReportLaunch();
      root.classList.remove("review-screen--report");
      clearDoneMesh();
      clearReportSheet();
      root.hidden = true;
      return Promise.resolve();
    }

    closing = true;
    meshWash.setActive(false);
    cancelReportLaunch();
    root.classList.remove("review-screen--report");
    clearDoneMesh();
    clearReportSheet();
    root.classList.remove("review-screen--open");

    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        root.removeEventListener("transitionend", onTransitionEnd);
        window.clearTimeout(fallbackId);
        root.hidden = true;
        closing = false;
        resolve();
      };

      /** @param {TransitionEvent} event */
      const onTransitionEnd = (event) => {
        if (event.target === root && event.propertyName === "opacity") {
          finish();
        }
      };

      root.addEventListener("transitionend", onTransitionEnd);
      const fallbackId = window.setTimeout(finish, getScreenCloseFallbackMs());
    });
  }

  return { root, open, close, setReportReveal };
}
