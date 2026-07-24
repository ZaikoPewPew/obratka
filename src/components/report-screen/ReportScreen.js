import { formatString, getStrings } from "../../i18n.js";
import {
  brandMarkSvg,
  morphBrandMarkToDone,
  resetBrandMarkToDefault,
} from "../../assets/brand/brandMarks.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import {
  getBrandMarkMorphMotion,
  getReportLaunchMotion,
  getReviewMeshDoneMotion,
  getScreenCloseFallbackMs,
} from "../../utils/motionTokens.js";
import { buildReportSections } from "../../utils/reviewReport.js";
import { shareReviewPdf } from "../../utils/shareReviewPdf.js";
import {
  REVIEW_COMPLAINT_TAGS,
  listPortfolioReviewSheets,
  submitReviewComplaint,
} from "../../api/reviewComplaints.js";

const BRAND_MARK_CLASS = "report-screen__brand-mark";
const BRAND_MARK_SVG = brandMarkSvg(BRAND_MARK_CLASS);

const DOWNLOAD_ICON_SVG = `<svg class="report-screen__btn-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M7 19L5.78311 18.9954C3.12231 18.8818 1 16.6888 1 14C1 11.3501 3.06139 9.18169 5.66806 9.01084C6.78942 6.64027 9.20316 5 12 5C15.5268 5 18.4445 7.60822 18.9293 11.001L19 11C21.2091 11 23 12.7909 23 15C23 17.1422 21.316 18.8911 19.1996 18.9951L17 19M12 10V18M9 15L12 18L15 15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/** @type {Record<(typeof REVIEW_COMPLAINT_TAGS)[number], { label: string; hint: string }>} */
const TAG_I18N_KEYS = {
  low_effort: {
    label: "complaintTagLowEffort",
    hint: "complaintTagLowEffortHint",
  },
  spam: { label: "complaintTagSpam", hint: "complaintTagSpamHint" },
  harassment: {
    label: "complaintTagHarassment",
    hint: "complaintTagHarassmentHint",
  },
  offensive: {
    label: "complaintTagOffensive",
    hint: "complaintTagOffensiveHint",
  },
  irrelevant: {
    label: "complaintTagIrrelevant",
    hint: "complaintTagIrrelevantHint",
  },
};

/**
 * Отчёт автору портфолио: список листов + жалоба + PDF.
 *
 * @param {{
 *   onPrimary?: () => void | Promise<void>;
 * }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   open: (opts?: { portfolioId?: string | null; portfolioName?: string | null }) => void;
 *   close: () => Promise<void>;
 *   getPortfolioId: () => string | null;
 * }}
 */
export function createReportScreen(opts = {}) {
  const onPrimary =
    typeof opts.onPrimary === "function" ? opts.onPrimary : null;

  /** @type {string | null} */
  let portfolioId = null;
  /** @type {string} */
  let portfolioName = "";
  let closing = false;
  /** @type {import("../../api/reviewComplaints.js").PortfolioReviewSheet[]} */
  let sheets = [];
  /** @type {string | null} */
  let complaintReviewId = null;
  /** @type {Set<string>} */
  let selectedTags = new Set();
  let submitting = false;
  let loadToken = 0;
  let pdfDone = false;
  /** @type {Animation | null} */
  let reportLaunchAnim = null;
  let pendingDoneMesh = false;

  const root = document.createElement("section");
  root.className = "report-screen";
  root.setAttribute("aria-labelledby", "report-screen-title");
  root.hidden = true;

  const layout = document.createElement("div");
  layout.className = "report-screen__layout";

  const panel = document.createElement("div");
  panel.className = "report-screen__panel";

  const card = document.createElement("div");
  card.className = "report-screen__card";

  const title = document.createElement("h1");
  title.className = "report-screen__title";
  title.id = "report-screen-title";

  const sheetsList = document.createElement("ul");
  sheetsList.className = "report-screen__sheets";
  sheetsList.hidden = true;

  const sheetsEmpty = document.createElement("p");
  sheetsEmpty.className = "report-screen__sheets-empty";
  sheetsEmpty.hidden = true;

  const actions = document.createElement("div");
  actions.className = "report-screen__actions";

  const homeBtn = document.createElement("button");
  homeBtn.type = "button";
  homeBtn.className =
    "iframe-shell__btn report-screen__btn report-screen__btn--exit";

  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.className =
    "iframe-shell__btn report-screen__btn report-screen__btn--download";

  const downloadLabel = document.createElement("span");
  downloadLabel.className = "report-screen__btn-label";

  downloadBtn.insertAdjacentHTML("afterbegin", DOWNLOAD_ICON_SVG);
  downloadBtn.append(downloadLabel);

  actions.append(homeBtn, downloadBtn);
  card.append(title, sheetsList, sheetsEmpty, actions);
  panel.append(card);

  const visual = document.createElement("div");
  visual.className = "report-screen__visual";
  visual.setAttribute("aria-hidden", "true");

  const glow = document.createElement("div");
  glow.className = "report-screen__glow";

  const report = document.createElement("div");
  report.className = "report-screen__report";

  const reportSheet = document.createElement("div");
  reportSheet.className = "report-screen__report-sheet";

  const reportEyebrow = document.createElement("p");
  reportEyebrow.className = "report-screen__report-eyebrow";

  const reportTitle = document.createElement("p");
  reportTitle.className = "report-screen__report-title";

  const reportSubtitle = document.createElement("p");
  reportSubtitle.className = "report-screen__report-subtitle";

  const reportBody = document.createElement("div");
  reportBody.className = "report-screen__report-body";

  reportSheet.append(reportEyebrow, reportTitle, reportSubtitle, reportBody);
  report.append(reportSheet);

  const noise = document.createElement("span");
  noise.className = "report-screen__noise";

  const brand = document.createElement("div");
  brand.className = "report-screen__brand";

  const brandSlot = document.createElement("div");
  brandSlot.className = "report-screen__brand-slot";
  brandSlot.innerHTML = BRAND_MARK_SVG;
  brand.append(brandSlot);

  visual.append(glow, noise, report, brand);
  const meshWash = mountMeshGradientWash(glow);
  meshWash.setActive(false);

  layout.append(panel, visual);
  root.append(layout);

  const modalBackdrop = document.createElement("div");
  modalBackdrop.className = "report-screen__modal-backdrop";
  modalBackdrop.hidden = true;
  modalBackdrop.setAttribute("aria-hidden", "true");

  const modal = document.createElement("div");
  modal.className = "report-screen__modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "report-complaint-title");

  const modalTitle = document.createElement("h2");
  modalTitle.className = "report-screen__modal-title";
  modalTitle.id = "report-complaint-title";

  const modalBody = document.createElement("p");
  modalBody.className = "report-screen__modal-body";

  const tagsList = document.createElement("div");
  tagsList.className = "report-screen__tags";
  tagsList.setAttribute("role", "group");

  /** @type {Map<string, HTMLButtonElement>} */
  const tagButtons = new Map();

  for (const tag of REVIEW_COMPLAINT_TAGS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "report-screen__tag";
    btn.dataset.tag = tag;

    const tagLabel = document.createElement("span");
    tagLabel.className = "report-screen__tag-label";

    const tagHint = document.createElement("span");
    tagHint.className = "report-screen__tag-hint";

    btn.append(tagLabel, tagHint);
    tagsList.append(btn);
    tagButtons.set(tag, btn);

    btn.addEventListener("click", () => {
      if (submitting) return;
      if (selectedTags.has(tag)) {
        selectedTags.delete(tag);
      } else {
        selectedTags.add(tag);
      }
      syncTagSelection();
      syncModalActions();
    });
  }

  const modalError = document.createElement("p");
  modalError.className = "report-screen__modal-error";
  modalError.hidden = true;
  modalError.setAttribute("role", "alert");

  const modalActions = document.createElement("div");
  modalActions.className = "report-screen__modal-actions";

  const modalSubmit = document.createElement("button");
  modalSubmit.type = "button";
  modalSubmit.className =
    "report-screen__modal-btn report-screen__modal-btn--primary";

  const modalCancel = document.createElement("button");
  modalCancel.type = "button";
  modalCancel.className =
    "report-screen__modal-btn report-screen__modal-btn--ghost";

  modalActions.append(modalSubmit, modalCancel);
  modal.append(modalTitle, modalBody, tagsList, modalError, modalActions);
  modalBackdrop.append(modal);
  root.append(modalBackdrop);

  function brandMarkEl() {
    return /** @type {SVGElement | null} */ (brandSlot.querySelector("svg"));
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function setDefaultBrandMark() {
    const svg = brandMarkEl();
    if (svg) {
      resetBrandMarkToDefault(svg);
      return;
    }
    brandSlot.innerHTML = BRAND_MARK_SVG;
  }

  function setLogoDoneMark() {
    let svg = brandMarkEl();
    if (!svg) {
      brandSlot.innerHTML = BRAND_MARK_SVG;
      svg = brandMarkEl();
    }
    const { durationMs, easing } = getBrandMarkMorphMotion();
    morphBrandMarkToDone(svg, {
      durationMs,
      easing,
      reducedMotion: prefersReducedMotion(),
    });
  }

  function clearDoneMesh() {
    pendingDoneMesh = false;
    pdfDone = false;
    root.classList.remove("report-screen--done");
    setDefaultBrandMark();
    meshWash.refresh();
  }

  function activateDoneMesh() {
    if (root.classList.contains("report-screen--done")) return;
    root.classList.add("report-screen--done");
    setLogoDoneMark();
    const { durationMs, easing } = getReviewMeshDoneMotion();
    meshWash.transitionToCssColors({ durationMs, easing });
  }

  function releaseReportBrand() {
    root.classList.remove("report-screen--report");
    if (pendingDoneMesh) {
      pendingDoneMesh = false;
      activateDoneMesh();
    }
  }

  function clearReportSheet() {
    reportBody.replaceChildren();
    reportSubtitle.textContent = "";
  }

  /**
   * @param {import("../../utils/reviewReport.js").ReviewAnswers | null | undefined} answers
   * @param {string} [subtitle]
   */
  function fillReportSheet(answers, subtitle) {
    const strings = getStrings();
    reportEyebrow.textContent = strings.brandName;
    reportTitle.textContent = strings.reportDocumentTitle;
    reportSubtitle.textContent =
      subtitle?.trim() || portfolioName.trim() || strings.brandName;

    reportBody.replaceChildren();
    if (!answers) return;

    const sections = buildReportSections(answers, strings);
    for (const section of sections) {
      const block = document.createElement("section");
      block.className = "report-screen__report-section";

      const heading = document.createElement("h3");
      heading.className = "report-screen__report-section-title";
      heading.textContent = section.title;

      const bodyEl = document.createElement("p");
      bodyEl.className = "report-screen__report-section-body";
      bodyEl.textContent = section.body;

      block.append(heading, bodyEl);
      reportBody.append(block);
    }
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
   * @returns {Promise<void>}
   */
  function launchReportAway() {
    cancelReportLaunch();

    if (!root.classList.contains("report-screen--report")) {
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

  function showReportMockup() {
    const firstWithAnswers = sheets.find((sheet) => sheet.answers);
    const t = getStrings();
    if (!firstWithAnswers?.answers) {
      root.classList.remove("report-screen--report");
      clearReportSheet();
      return;
    }
    const name =
      (firstWithAnswers.reviewerDisplayName &&
        firstWithAnswers.reviewerDisplayName.trim()) ||
      t.reportSheetReviewerFallback ||
      "";
    const index = sheets.indexOf(firstWithAnswers);
    const sheetLabel = formatString(t.reportSheetLabel, { n: index + 1 });
    fillReportSheet(
      firstWithAnswers.answers,
      [sheetLabel, name].filter(Boolean).join(" · "),
    );
    root.classList.add("report-screen--report");
  }

  function markPdfDownloaded() {
    if (pdfDone) return;
    pdfDone = true;
    pendingDoneMesh = true;
    void launchReportAway();
    syncDownloadButton();
  }

  function syncDownloadButton() {
    const hasAnswers = sheets.some((sheet) => sheet.answers);
    downloadBtn.disabled = pdfDone || !hasAnswers;
    downloadBtn.hidden = false;
  }

  function applyCopy() {
    const t = getStrings();
    title.textContent = t.reportScreenTitle ?? "";
    homeBtn.textContent = t.reportScreenPrimary ?? "";
    downloadLabel.textContent = t.reportScreenDownloadPdf ?? "";
    downloadBtn.setAttribute(
      "aria-label",
      t.reportScreenDownloadPdfAria ?? t.reportScreenDownloadPdf ?? "",
    );
    sheetsEmpty.textContent = t.reportSheetsEmpty ?? "";
    modalTitle.textContent = t.reportComplaintModalTitle ?? "";
    modalBody.textContent = t.reportComplaintModalBody ?? "";
    modalSubmit.textContent = t.reportComplaintSubmit ?? "";
    modalCancel.textContent = t.reportComplaintCancel ?? "";
    tagsList.setAttribute(
      "aria-label",
      t.reportComplaintTagsAria ?? t.reportComplaintModalTitle ?? "",
    );

    for (const tag of REVIEW_COMPLAINT_TAGS) {
      const btn = tagButtons.get(tag);
      if (!btn) continue;
      const keys = TAG_I18N_KEYS[tag];
      const labelEl = btn.querySelector(".report-screen__tag-label");
      const hintEl = btn.querySelector(".report-screen__tag-hint");
      if (labelEl) labelEl.textContent = t[keys.label] ?? tag;
      if (hintEl) hintEl.textContent = t[keys.hint] ?? "";
    }
  }

  function syncTagSelection() {
    for (const tag of REVIEW_COMPLAINT_TAGS) {
      const btn = tagButtons.get(tag);
      if (!btn) continue;
      const on = selectedTags.has(tag);
      btn.classList.toggle("report-screen__tag--selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function syncModalActions() {
    modalSubmit.disabled = submitting || selectedTags.size === 0;
  }

  function setModalError(message) {
    if (!message) {
      modalError.hidden = true;
      modalError.textContent = "";
      return;
    }
    modalError.hidden = false;
    modalError.textContent = message;
  }

  function closeComplaintModal() {
    complaintReviewId = null;
    selectedTags = new Set();
    submitting = false;
    syncTagSelection();
    syncModalActions();
    setModalError("");
    modalBackdrop.classList.remove("report-screen__modal-backdrop--open");
    modalBackdrop.hidden = true;
    modalBackdrop.setAttribute("aria-hidden", "true");
  }

  /**
   * @param {string} reviewId
   */
  function openComplaintModal(reviewId) {
    const t = getStrings();
    complaintReviewId = reviewId;
    selectedTags = new Set();
    submitting = false;
    syncTagSelection();
    syncModalActions();
    setModalError("");
    modalTitle.textContent = t.reportComplaintModalTitle ?? "";
    modalBody.textContent = t.reportComplaintModalBody ?? "";
    modalBackdrop.hidden = false;
    modalBackdrop.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      modalBackdrop.classList.add("report-screen__modal-backdrop--open");
    });
  }

  /**
   * @param {import("../../api/reviewComplaints.js").PortfolioReviewSheet} sheet
   * @param {number} index
   * @returns {HTMLLIElement}
   */
  function buildSheetRow(sheet, index) {
    const t = getStrings();
    const li = document.createElement("li");
    li.className = "report-screen__sheet";
    li.dataset.reviewId = sheet.id;

    const meta = document.createElement("div");
    meta.className = "report-screen__sheet-meta";

    const avatar = document.createElement("div");
    avatar.className = "report-screen__sheet-avatar";
    avatar.setAttribute("aria-hidden", "true");

    const name =
      (sheet.reviewerDisplayName && sheet.reviewerDisplayName.trim()) ||
      t.reportSheetReviewerFallback ||
      "";

    if (sheet.reviewerAvatarUrl) {
      const img = document.createElement("img");
      img.className = "report-screen__sheet-avatar-img";
      img.src = sheet.reviewerAvatarUrl;
      img.alt = "";
      img.width = 40;
      img.height = 40;
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      avatar.append(img);
    } else {
      const letter = document.createElement("span");
      letter.className = "report-screen__sheet-avatar-letter";
      letter.textContent = (name.charAt(0) || "?").toUpperCase();
      avatar.append(letter);
    }

    const textCol = document.createElement("div");
    textCol.className = "report-screen__sheet-text";

    const nameEl = document.createElement("p");
    nameEl.className = "report-screen__sheet-name";
    nameEl.textContent = name;

    const labelEl = document.createElement("p");
    labelEl.className = "report-screen__sheet-label";
    labelEl.textContent = formatString(t.reportSheetLabel, { n: index + 1 });

    textCol.append(nameEl, labelEl);
    meta.append(avatar, textCol);

    const complainBtn = document.createElement("button");
    complainBtn.type = "button";
    complainBtn.className = "report-screen__complain";

    if (sheet.complained) {
      complainBtn.disabled = true;
      complainBtn.textContent = t.reportComplaintSubmitted ?? "";
      complainBtn.classList.add("report-screen__complain--done");
    } else {
      complainBtn.textContent = t.reportComplaintButton ?? "";
      complainBtn.addEventListener("click", () => {
        openComplaintModal(sheet.id);
      });
    }

    li.append(meta, complainBtn);
    return li;
  }

  function renderSheets() {
    sheetsList.replaceChildren();
    if (sheets.length === 0) {
      sheetsList.hidden = true;
      sheetsEmpty.hidden = false;
      syncDownloadButton();
      if (!pdfDone) showReportMockup();
      return;
    }
    sheetsEmpty.hidden = true;
    sheetsList.hidden = false;
    sheets.forEach((sheet, index) => {
      sheetsList.append(buildSheetRow(sheet, index));
    });
    syncDownloadButton();
    if (!pdfDone) showReportMockup();
  }

  /**
   * @param {{ portfolioId?: string | null; portfolioName?: string | null }} [openOpts]
   */
  function open(openOpts = {}) {
    closing = false;
    closeComplaintModal();
    cancelReportLaunch();
    clearDoneMesh();
    clearReportSheet();
    root.classList.remove("report-screen--report");
    portfolioId =
      typeof openOpts.portfolioId === "string" && openOpts.portfolioId.trim()
        ? openOpts.portfolioId.trim()
        : null;
    portfolioName =
      typeof openOpts.portfolioName === "string"
        ? openOpts.portfolioName.trim()
        : "";
    sheets = [];
    applyCopy();
    renderSheets();
    root.hidden = false;
    root.classList.remove("report-screen--open");
    meshWash.refresh();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("report-screen--open");
        meshWash.setActive(true);
      });
    });

    const token = ++loadToken;
    if (!portfolioId) {
      sheetsEmpty.hidden = false;
      syncDownloadButton();
      return;
    }

    void listPortfolioReviewSheets(portfolioId).then((rows) => {
      if (token !== loadToken) return;
      sheets = rows;
      renderSheets();
    });
  }

  /**
   * @returns {Promise<void>}
   */
  function close() {
    if (root.hidden || closing) {
      return Promise.resolve();
    }

    closeComplaintModal();
    loadToken += 1;
    cancelReportLaunch();

    if (!root.classList.contains("report-screen--open")) {
      meshWash.setActive(false);
      root.classList.remove("report-screen--report");
      clearDoneMesh();
      clearReportSheet();
      root.hidden = true;
      return Promise.resolve();
    }

    closing = true;
    meshWash.setActive(false);
    root.classList.remove("report-screen--report");
    clearDoneMesh();
    clearReportSheet();
    root.classList.remove("report-screen--open");

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

  homeBtn.addEventListener("click", () => {
    void onPrimary?.();
  });

  downloadBtn.addEventListener("click", () => {
    if (downloadBtn.disabled || pdfDone) return;
    const t = getStrings();
    const pages = sheets
      .map((sheet, index) => {
        if (!sheet.answers) return null;
        const reviewerName =
          (sheet.reviewerDisplayName && sheet.reviewerDisplayName.trim()) ||
          t.reportSheetReviewerFallback ||
          "";
        return {
          answers: sheet.answers,
          reviewerName,
          sheetLabel: formatString(t.reportSheetLabel, { n: index + 1 }),
        };
      })
      .filter(Boolean);

    if (pages.length === 0) return;

    shareReviewPdf(pages, {
      portfolioName: portfolioName || t.brandName,
      onComplete: () => {
        markPdfDownloaded();
      },
    });
  });

  modalCancel.addEventListener("click", () => {
    if (submitting) return;
    closeComplaintModal();
  });

  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop && !submitting) {
      closeComplaintModal();
    }
  });

  modalSubmit.addEventListener("click", () => {
    if (submitting || !complaintReviewId || selectedTags.size === 0) return;
    const t = getStrings();
    submitting = true;
    syncModalActions();
    setModalError("");

    void submitReviewComplaint(complaintReviewId, [...selectedTags])
      .then(() => {
        const id = complaintReviewId;
        sheets = sheets.map((sheet) =>
          sheet.id === id ? { ...sheet, complained: true } : sheet,
        );
        closeComplaintModal();
        renderSheets();
      })
      .catch((err) => {
        submitting = false;
        syncModalActions();
        const code = err instanceof Error ? err.message : "complaint_failed";
        const keyMap = {
          complaint_already_exists: "reportComplaintAlready",
          tags_required: "reportComplaintNeedTags",
          not_portfolio_owner: "reportComplaintError",
          not_authenticated: "reportComplaintError",
        };
        const key = keyMap[code] || "reportComplaintError";
        setModalError(t[key] ?? t.reportComplaintError ?? "");
      });
  });

  return {
    root,
    open,
    close,
    getPortfolioId: () => portfolioId,
  };
}
