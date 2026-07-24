import { formatString, getStrings } from "../../i18n.js";
import { logoDoneMarkSvg } from "../../assets/brand/brandMarks.js";
import { mountMeshGradientWash } from "../../utils/meshGradientWash.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import {
  REVIEW_COMPLAINT_TAGS,
  listPortfolioReviewSheets,
  submitReviewComplaint,
} from "../../api/reviewComplaints.js";

const BRAND_MARK_SVG = logoDoneMarkSvg("report-screen__brand-mark");

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
 * Отчёт автору портфолио: список листов + жалоба (теги в модалке).
 *
 * @param {{
 *   onPrimary?: () => void | Promise<void>;
 * }} [opts]
 * @returns {{
 *   root: HTMLElement;
 *   open: (opts?: { portfolioId?: string | null }) => void;
 *   close: () => Promise<void>;
 *   getPortfolioId: () => string | null;
 * }}
 */
export function createReportScreen(opts = {}) {
  const onPrimary =
    typeof opts.onPrimary === "function" ? opts.onPrimary : null;

  /** @type {string | null} */
  let portfolioId = null;
  let closing = false;
  /** @type {import("../../api/reviewComplaints.js").PortfolioReviewSheet[]} */
  let sheets = [];
  /** @type {string | null} */
  let complaintReviewId = null;
  /** @type {Set<string>} */
  let selectedTags = new Set();
  let submitting = false;
  let loadToken = 0;

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

  const body = document.createElement("p");
  body.className = "report-screen__body";

  const sheetsList = document.createElement("ul");
  sheetsList.className = "report-screen__sheets";
  sheetsList.hidden = true;

  const sheetsEmpty = document.createElement("p");
  sheetsEmpty.className = "report-screen__sheets-empty";
  sheetsEmpty.hidden = true;

  const actions = document.createElement("div");
  actions.className = "report-screen__actions";

  const primaryBtn = document.createElement("button");
  primaryBtn.type = "button";
  primaryBtn.className =
    "iframe-shell__btn report-screen__btn report-screen__btn--exit";

  actions.append(primaryBtn);
  card.append(title, body, sheetsList, sheetsEmpty, actions);
  panel.append(card);

  const visual = document.createElement("div");
  visual.className = "report-screen__visual";
  visual.setAttribute("aria-hidden", "true");

  const glow = document.createElement("div");
  glow.className = "report-screen__glow";

  const noise = document.createElement("span");
  noise.className = "report-screen__noise";

  const brand = document.createElement("div");
  brand.className = "report-screen__brand";

  const brandSlot = document.createElement("div");
  brandSlot.className = "report-screen__brand-slot";
  brandSlot.innerHTML = BRAND_MARK_SVG;
  brand.append(brandSlot);

  visual.append(glow, noise, brand);
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

  function applyCopy() {
    const t = getStrings();
    title.textContent = t.reportScreenTitle ?? "";
    body.textContent = t.reportScreenBody ?? "";
    primaryBtn.textContent = t.reportScreenPrimary ?? "";
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
      return;
    }
    sheetsEmpty.hidden = true;
    sheetsList.hidden = false;
    sheets.forEach((sheet, index) => {
      sheetsList.append(buildSheetRow(sheet, index));
    });
  }

  /**
   * @param {{ portfolioId?: string | null }} [openOpts]
   */
  function open(openOpts = {}) {
    closing = false;
    closeComplaintModal();
    portfolioId =
      typeof openOpts.portfolioId === "string" && openOpts.portfolioId.trim()
        ? openOpts.portfolioId.trim()
        : null;
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

    if (!root.classList.contains("report-screen--open")) {
      meshWash.setActive(false);
      root.hidden = true;
      return Promise.resolve();
    }

    closing = true;
    meshWash.setActive(false);
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

  primaryBtn.addEventListener("click", () => {
    void onPrimary?.();
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
