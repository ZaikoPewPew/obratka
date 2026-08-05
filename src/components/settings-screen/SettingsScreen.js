import { formatString, getLocale, getStrings } from "../../i18n.js";
import "../../../styles/settings-screen.css";
import { fixHangingPrepositions } from "../../utils/hangingPrepositions.js";
import {
  fetchMyProfile,
  getCachedMyProfile,
} from "../../api/profiles.js";
import { getSession } from "../../app/session.js";
import { PROFILE_ROLE_VALUES } from "../../api/profileSettings.js";
import { formatPortfolioGrade } from "../../api/portfolios.js";
import { DEFAULT_ONBOARDING_ROLE } from "../../api/onboarding.js";
import onboardingContent from "../../../content/onboarding.json";
import { createSidePanel } from "../side-panel/SidePanel.js";

/**
 * @returns {{ value: string; labelKey: string }[]}
 */
function getRoleOptions() {
  const roleStep = (
    Array.isArray(onboardingContent?.steps) ? onboardingContent.steps : []
  ).find((step) => step?.id === "role");
  const options = Array.isArray(roleStep?.options) ? roleStep.options : [];
  return options
    .map((option) => ({
      value: String(option?.value ?? ""),
      labelKey: String(option?.labelKey ?? ""),
    }))
    .filter((option) => option.value && PROFILE_ROLE_VALUES.has(option.value));
}

/**
 * @param {string} role
 * @param {ReturnType<typeof getStrings>} t
 * @returns {string}
 */
function formatRoleLabel(role, t) {
  const option = getRoleOptions().find((item) => item.value === role);
  if (option?.labelKey && t[option.labelKey]) return t[option.labelKey];
  return role;
}

/**
 * @param {string | null | undefined} iso
 * @param {string} locale
 * @returns {string}
 */
function formatAccountCreatedAt(iso, locale) {
  if (typeof iso !== "string" || !iso.trim()) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return iso;
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Профиль в side-panel (`/settings` поверх home): sticky header, все поля read-only.
 *
 * @param {{
 *   onClose?: () => void | Promise<void>;
 * }} [opts]
 */
export function createSettingsScreen(opts = {}) {
  let loadEpoch = 0;
  /** @type {string | null} */
  let createdAtIso = null;
  /** @type {string | null} */
  let roleValue = null;
  let closingFromRoute = false;

  const panel = createSidePanel({
    closeOnBackdrop: true,
    closeOnEscape: true,
    onClose: () => {
      loadEpoch += 1;
      if (closingFromRoute) return;
      void opts.onClose?.();
    },
  });

  const loadingBox = document.createElement("div");
  loadingBox.className = "settings-screen__loading";
  loadingBox.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 5; i += 1) {
    const skeleton = document.createElement("div");
    skeleton.className = "settings-screen__skeleton";
    loadingBox.append(skeleton);
  }

  const loadError = document.createElement("p");
  loadError.className = "settings-screen__load-error";
  loadError.hidden = true;

  const form = document.createElement("div");
  form.className = "settings-screen__form";
  form.hidden = true;

  /**
   * @param {{ id: string; select?: boolean }} cfg
   */
  function createField(cfg) {
    const field = document.createElement("div");
    field.className = "settings-screen__field";

    const label = document.createElement("label");
    label.className = "settings-screen__label";
    label.htmlFor = cfg.id;

    const control = document.createElement("div");
    control.className = cfg.select
      ? "settings-screen__readonly settings-screen__readonly--select"
      : "settings-screen__readonly";
    control.id = cfg.id;

    /** @type {HTMLElement} */
    let valueEl = control;
    if (cfg.select) {
      valueEl = document.createElement("span");
      valueEl.className = "settings-screen__readonly-value";

      const icon = document.createElement("span");
      icon.className = "settings-screen__select-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 8L12 16L20 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      control.append(valueEl, icon);
    }

    field.append(label, control);
    return { field, label, control, valueEl };
  }

  /**
   * @returns {HTMLDivElement}
   */
  function createRow() {
    const row = document.createElement("div");
    row.className = "settings-screen__row";
    return row;
  }

  const displayNameField = createField({ id: "settings-display-name" });
  const telegramField = createField({ id: "settings-telegram" });
  const emailField = createField({ id: "settings-email" });
  const roleField = createField({ id: "settings-role", select: true });
  const gradeField = createField({ id: "settings-grade" });
  const workplaceField = createField({ id: "settings-workplace" });

  const identityRow = createRow();
  identityRow.append(displayNameField.field, telegramField.field);

  const gradeWorkplaceRow = createRow();
  gradeWorkplaceRow.append(gradeField.field, workplaceField.field);

  form.append(
    identityRow,
    emailField.field,
    roleField.field,
    gradeWorkplaceRow,
  );

  panel.content.replaceChildren(loadingBox, loadError, form);

  function syncDescription() {
    const t = getStrings();
    const locale = getLocale();
    const date =
      formatAccountCreatedAt(createdAtIso, locale) ||
      (t.settingsCreatedAtEmpty ?? "");
    panel.setDescription(
      fixHangingPrepositions(
        formatString(t.settingsDescription ?? "", { date }),
      ),
    );
  }

  function syncCopy() {
    const t = getStrings();
    panel.setTitle(t.settingsTitle ?? "");
    syncDescription();
    panel.setCloseAriaLabel(t.settingsBackAria ?? t.modalCloseAria ?? "");

    displayNameField.label.textContent = t.settingsDisplayNameLabel ?? "";
    telegramField.label.textContent = t.settingsTelegramLabel ?? "";
    emailField.label.textContent = t.settingsEmailLabel ?? "";
    roleField.label.textContent = t.settingsRoleLabel ?? "";
    if (roleValue) {
      roleField.valueEl.textContent = formatRoleLabel(roleValue, t);
    }
    gradeField.label.textContent = t.settingsGradeLabel ?? "";
    workplaceField.label.textContent = t.settingsWorkplaceLabel ?? "";
    loadError.textContent = t.settingsLoadFailed ?? "";
  }

  /**
   * @param {import("../../api/profiles.js").Profile} profile
   */
  function fillForm(profile) {
    const t = getStrings();
    const displayName = asText(profile.display_name);
    const telegramUsername = asText(profile.telegram_username);
    const workplace = asText(profile.workplace);
    let role = asText(profile.role) || DEFAULT_ONBOARDING_ROLE;
    if (!PROFILE_ROLE_VALUES.has(role)) role = DEFAULT_ONBOARDING_ROLE;
    roleValue = role;

    createdAtIso =
      typeof profile.created_at === "string" && profile.created_at.trim()
        ? profile.created_at
        : null;

    const empty = t.settingsEmailEmpty ?? "";
    displayNameField.control.textContent = displayName || empty;
    emailField.control.textContent = asText(profile.email) || empty;
    telegramField.control.textContent = telegramUsername
      ? `@${telegramUsername}`
      : empty;
    gradeField.control.textContent = formatPortfolioGrade(profile.grade);
    roleField.valueEl.textContent = formatRoleLabel(role, t);
    workplaceField.control.textContent = workplace || empty;

    syncDescription();
  }

  /**
   * @param {"loading" | "ready" | "error"} mode
   */
  function setViewMode(mode) {
    loadingBox.hidden = mode !== "loading";
    loadError.hidden = mode !== "error";
    form.hidden = mode !== "ready";
  }

  async function loadProfile() {
    const epoch = ++loadEpoch;

    const cached = getCachedMyProfile(getSession()?.userId);
    if (cached) {
      fillForm(cached);
      setViewMode("ready");
    } else {
      setViewMode("loading");
    }

    const profile = await fetchMyProfile();
    if (epoch !== loadEpoch) return;
    if (!profile) {
      if (cached) return;
      createdAtIso = null;
      roleValue = null;
      setViewMode("error");
      return;
    }
    fillForm(profile);
    setViewMode("ready");
  }

  function open() {
    closingFromRoute = false;
    syncCopy();
    panel.open();
    void loadProfile();
  }

  /**
   * @returns {Promise<void>}
   */
  function close() {
    loadEpoch += 1;
    if (!panel.isOpen()) return Promise.resolve();
    closingFromRoute = true;
    return panel.close().finally(() => {
      closingFromRoute = false;
    });
  }

  return { root: panel.root, open, close, isOpen: panel.isOpen };
}
