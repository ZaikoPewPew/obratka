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
  readSheetTranslateY,
} from "../../utils/motionTokens.js";
import { fixHangingPrepositions } from "../../utils/hangingPrepositions.js";
import { buildReportSections } from "../../utils/reviewReport.js";
import { shareReviewPdf } from "../../utils/shareReviewPdf.js";
import { DEFAULT_TARGET_REVIEWS } from "../../api/portfolios.js";
import {
  REVIEW_COMPLAINT_TAGS,
  formatReviewerTitle,
  listPortfolioReviewSheets,
  submitReviewComplaint,
} from "../../api/reviewComplaints.js";
import { createAppModal } from "../app-modal/AppModal.js";
import { createSidePanel } from "../side-panel/SidePanel.js";

const BRAND_MARK_CLASS = "report-screen__brand-mark";
const BRAND_MARK_SVG = brandMarkSvg(BRAND_MARK_CLASS);

/** Сколько skeleton-строк показывать, пока грузятся листы. */
const SKELETON_SHEET_COUNT = DEFAULT_TARGET_REVIEWS;

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
  ai_slop: {
    label: "complaintTagAiSlop",
    hint: "complaintTagAiSlopHint",
  },
};

/**
 * Отчёт автору портфолио: список листов → просмотр в side-panel → жалоба + PDF.
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
  let viewingSheetId = null;
  /** @type {string | null} */
  let complaintReviewId = null;
  /** @type {string | null} */
  let selectedTag = null;
  let submitting = false;
  let loading = false;
  let loadToken = 0;
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
  card.append(title, sheetsList, actions);
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

  const complaintBody = document.createElement("div");
  complaintBody.className = "report-screen__complaint";

  const tipEl = document.createElement("p");
  tipEl.className = "report-screen__complaint-tip";

  const tagsList = document.createElement("div");
  tagsList.className = "report-screen__tags";
  tagsList.setAttribute("role", "radiogroup");

  /** @type {Map<string, HTMLButtonElement>} */
  const tagButtons = new Map();

  for (const tag of REVIEW_COMPLAINT_TAGS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "report-screen__tag";
    btn.dataset.tag = tag;
    btn.setAttribute("role", "radio");

    const tagLabel = document.createElement("span");
    tagLabel.className = "report-screen__tag-label";

    const tagHint = document.createElement("span");
    tagHint.className = "report-screen__tag-hint";

    btn.append(tagLabel, tagHint);
    tagsList.append(btn);
    tagButtons.set(tag, btn);

    btn.addEventListener("click", () => {
      if (submitting) return;
      selectedTag = selectedTag === tag ? null : tag;
      syncTagSelection();
      syncModalActions();
    });
  }

  const modalError = document.createElement("p");
  modalError.className = "report-screen__complaint-error";
  modalError.hidden = true;
  modalError.setAttribute("role", "alert");

  complaintBody.append(tipEl, tagsList, modalError);

  const complaintModal = createAppModal({
    size: "md",
    closeOnBackdrop: true,
    closeOnEscape: true,
    onPrimary: () => {
      void submitComplaint();
    },
    onSecondary: () => {
      if (submitting) return;
      void complaintModal.close();
    },
    onClose: () => {
      complaintReviewId = null;
      selectedTag = null;
      submitting = false;
      syncTagSelection();
      syncModalActions();
      setModalError("");
    },
  });
  complaintModal.content.append(complaintBody);

  const sheetPanel = createSidePanel({
    onClose: () => {
      viewingSheetId = null;
    },
  });
  root.append(sheetPanel.root, complaintModal.root);

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
   * @param {string} [seed] Стабильный seed (review_id) для разнообразия между листами.
   */
  function fillReportSheet(answers, subtitle, seed) {
    const strings = getStrings();
    reportEyebrow.textContent = strings.brandName;
    reportTitle.textContent = strings.reportDocumentTitle;
    reportSubtitle.textContent =
      subtitle?.trim() || portfolioName.trim() || strings.brandName;

    reportBody.replaceChildren();
    if (!answers) return;

    const sections = buildReportSections(answers, strings, { seed });
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
    const shown = readSheetTranslateY(report);
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
    const gradeLabel = formatReviewerTitle(
      firstWithAnswers.reviewerGrade,
      firstWithAnswers.reviewerRole,
    );
    fillReportSheet(
      firstWithAnswers.answers,
      [gradeLabel, name].filter(Boolean).join(" · "),
      firstWithAnswers.id,
    );
    root.classList.add("report-screen--report");
  }

  /**
   * Перед повторным скачиванием: снять done и снова вытащить мокап.
   */
  function prepareSheetForDownload() {
    cancelReportLaunch();
    pendingDoneMesh = false;
    if (root.classList.contains("report-screen--done")) {
      clearDoneMesh();
    }
    showReportMockup();
  }

  function markPdfDownloaded() {
    pendingDoneMesh = true;
    void launchReportAway();
  }

  function syncDownloadButton() {
    const hasAnswers = sheets.some((sheet) => sheet.answers);
    downloadBtn.disabled = !hasAnswers;
    downloadBtn.hidden = false;
  }

  /**
   * @param {import("../../api/reviewComplaints.js").PortfolioReviewSheet} sheet
   * @param {number} index
   * @returns {string}
   */
  function sheetGradeLabel(sheet, index) {
    const t = getStrings();
    const title = formatReviewerTitle(sheet.reviewerGrade, sheet.reviewerRole);
    if (title) return title;
    return formatString(t.reportSheetLabel, { n: index + 1 });
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
    complaintModal.setTitle(t.reportComplaintModalTitle ?? "");
    complaintModal.setPrimaryLabel(t.reportComplaintSubmit ?? "");
    complaintModal.setSecondaryLabel(t.reportComplaintCancel ?? "");
    complaintModal.setActionsVisible({ primary: true, secondary: true });
    tipEl.textContent = fixHangingPrepositions(t.reportComplaintTip ?? "");
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
      if (hintEl) {
        hintEl.textContent = fixHangingPrepositions(t[keys.hint] ?? "");
      }
    }
  }

  function syncTagSelection() {
    for (const tag of REVIEW_COMPLAINT_TAGS) {
      const btn = tagButtons.get(tag);
      if (!btn) continue;
      const on = selectedTag === tag;
      btn.classList.toggle("report-screen__tag--selected", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    }
  }

  function syncModalActions() {
    complaintModal.setPrimaryDisabled(submitting || !selectedTag);
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
    if (!complaintModal.isOpen()) {
      complaintReviewId = null;
      selectedTag = null;
      submitting = false;
      syncTagSelection();
      syncModalActions();
      setModalError("");
      return;
    }
    void complaintModal.close();
  }

  function closeSheetPanel() {
    viewingSheetId = null;
    if (!sheetPanel.isOpen()) return;
    void sheetPanel.close();
  }

  /**
   * @param {import("../../api/reviewComplaints.js").PortfolioReviewSheet} sheet
   * @param {number} index
   */
  function syncSheetPanelContent(sheet, index) {
    const t = getStrings();
    const name =
      (sheet.reviewerDisplayName && sheet.reviewerDisplayName.trim()) ||
      t.reportSheetReviewerFallback ||
      "";
    const gradeLabel = sheetGradeLabel(sheet, index);

    sheetPanel.setTitle(name);
    sheetPanel.setDescription(gradeLabel);
    sheetPanel.setCloseAriaLabel(t.reportSheetPanelCloseAria ?? "");

    /** @type {HTMLElement[]} */
    const nodes = [];

    if (sheet.answers) {
      const sections = buildReportSections(sheet.answers, t, {
        seed: sheet.id,
      });
      for (const section of sections) {
        const wrap = document.createElement("section");
        wrap.className = "side-panel__section";

        const heading = document.createElement("h3");
        heading.className = "side-panel__section-title";
        heading.textContent = section.title;

        const bodyEl = document.createElement("p");
        bodyEl.className = "side-panel__section-body";
        bodyEl.textContent = fixHangingPrepositions(section.body);

        wrap.append(heading, bodyEl);
        nodes.push(wrap);
      }
    }

    if (sheet.complained || sheet.canComplain) {
      const actions = document.createElement("div");
      actions.className = "report-screen__sheet-panel-actions";

      const complainBtn = document.createElement("button");
      complainBtn.type = "button";
      complainBtn.className = "report-screen__sheet-action";

      if (sheet.complained) {
        complainBtn.classList.add("report-screen__sheet-action--done");
        complainBtn.disabled = true;
        complainBtn.textContent = t.reportComplaintSubmitted ?? "";
      } else {
        complainBtn.textContent = t.reportComplaintButton ?? "";
        complainBtn.addEventListener("click", () => {
          openComplaintModal(sheet.id, name);
        });
      }

      actions.append(complainBtn);
      nodes.push(actions);
    }

    sheetPanel.content.replaceChildren(...nodes);
  }

  /**
   * @param {import("../../api/reviewComplaints.js").PortfolioReviewSheet} sheet
   * @param {number} index
   */
  function openSheetPanel(sheet, index) {
    viewingSheetId = sheet.id;
    syncSheetPanelContent(sheet, index);
    sheetPanel.open();
  }

  /**
   * @param {string} reviewId
   * @param {string} reviewerName
   */
  function openComplaintModal(reviewId, reviewerName) {
    const t = getStrings();
    complaintReviewId = reviewId;
    selectedTag = null;
    submitting = false;
    syncTagSelection();
    syncModalActions();
    setModalError("");
    applyCopy();
    const name =
      (typeof reviewerName === "string" && reviewerName.trim()) ||
      t.reportSheetReviewerFallback ||
      "";
    complaintModal.setDescription(
      fixHangingPrepositions(
        formatString(t.reportComplaintFrom ?? "", { name }),
      ),
    );
    complaintModal.open();
  }

  /**
   * @returns {void}
   */
  function submitComplaint() {
    if (submitting || !complaintReviewId || !selectedTag) return;
    const t = getStrings();
    submitting = true;
    syncModalActions();
    setModalError("");

    void submitReviewComplaint(complaintReviewId, [selectedTag])
      .then(() => {
        const id = complaintReviewId;
        sheets = sheets.map((sheet) =>
          sheet.id === id
            ? { ...sheet, complained: true, canComplain: false }
            : sheet,
        );
        void complaintModal.close().then(() => {
          renderSheets();
          if (!viewingSheetId) return;
          const index = sheets.findIndex((row) => row.id === viewingSheetId);
          const sheet = index >= 0 ? sheets[index] : null;
          if (!sheet) {
            closeSheetPanel();
            return;
          }
          syncSheetPanelContent(sheet, index);
        });
      })
      .catch((err) => {
        submitting = false;
        syncModalActions();
        const code = err instanceof Error ? err.message : "complaint_failed";
        const keyMap = {
          complaint_already_exists: "reportComplaintAlready",
          tags_required: "reportComplaintNeedTags",
          too_many_tags: "reportComplaintNeedTags",
          complaint_window_closed: "reportComplaintWindowClosed",
          not_portfolio_owner: "reportComplaintError",
          not_authenticated: "reportComplaintError",
        };
        const key = keyMap[code] || "reportComplaintError";
        setModalError(t[key] ?? t.reportComplaintError ?? "");
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
    labelEl.textContent = sheetGradeLabel(sheet, index);

    textCol.append(nameEl, labelEl);
    meta.append(avatar, textCol);
    li.append(meta);

    if (sheet.answers) {
      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "report-screen__sheet-action";
      viewBtn.textContent = t.reportSheetViewButton ?? "";
      viewBtn.setAttribute(
        "aria-label",
        formatString(t.reportSheetViewAria ?? "", { name }) ||
          t.reportSheetViewButton ||
          "",
      );
      viewBtn.addEventListener("click", () => {
        openSheetPanel(sheet, index);
      });
      li.append(viewBtn);
    }

    return li;
  }

  /**
   * @returns {HTMLLIElement}
   */
  function buildSheetSkeleton() {
    const li = document.createElement("li");
    li.className = "report-screen__sheet report-screen__sheet--skeleton";
    li.setAttribute("aria-hidden", "true");

    const meta = document.createElement("div");
    meta.className = "report-screen__sheet-meta";

    const avatar = document.createElement("div");
    avatar.className =
      "report-screen__sheet-avatar report-screen__sheet-avatar--skeleton";

    const textCol = document.createElement("div");
    textCol.className = "report-screen__sheet-text";

    const nameBone = document.createElement("div");
    nameBone.className = "report-screen__sheet-bone report-screen__sheet-bone--name";

    const labelBone = document.createElement("div");
    labelBone.className =
      "report-screen__sheet-bone report-screen__sheet-bone--label";

    textCol.append(nameBone, labelBone);
    meta.append(avatar, textCol);

    const actionBone = document.createElement("div");
    actionBone.className =
      "report-screen__sheet-bone report-screen__sheet-bone--action";

    li.append(meta, actionBone);
    return li;
  }

  function renderSheets() {
    sheetsList.replaceChildren();
    if (loading) {
      sheetsList.hidden = false;
      for (let i = 0; i < SKELETON_SHEET_COUNT; i += 1) {
        sheetsList.append(buildSheetSkeleton());
      }
      syncDownloadButton();
      return;
    }
    if (sheets.length === 0) {
      sheetsList.hidden = true;
      syncDownloadButton();
      showReportMockup();
      return;
    }
    sheetsList.hidden = false;
    sheets.forEach((sheet, index) => {
      sheetsList.append(buildSheetRow(sheet, index));
    });
    syncDownloadButton();
    showReportMockup();
  }

  /**
   * @param {{ portfolioId?: string | null; portfolioName?: string | null }} [openOpts]
   */
  function open(openOpts = {}) {
    closing = false;
    closeComplaintModal();
    closeSheetPanel();
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
    loading = Boolean(portfolioId);
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
      syncDownloadButton();
      return;
    }

    void listPortfolioReviewSheets(portfolioId)
      .catch(() => [])
      .then((rows) => {
        if (token !== loadToken) return;
        loading = false;
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
    closeSheetPanel();
    loadToken += 1;
    loading = false;
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
    if (downloadBtn.disabled) return;
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
          sheetLabel: sheetGradeLabel(sheet, index),
          seed: sheet.id,
        };
      })
      .filter(Boolean);

    if (pages.length === 0) return;

    prepareSheetForDownload();

    shareReviewPdf(pages, {
      portfolioName: portfolioName || t.brandName,
      onComplete: () => {
        markPdfDownloaded();
      },
    });
  });

  return {
    root,
    open,
    close,
    getPortfolioId: () => portfolioId,
  };
}
