import { getLocale, getStrings } from "../../i18n.js";
import { getScreenCloseFallbackMs } from "../../utils/motionTokens.js";
import { brandMarkSvg } from "../../assets/brand/brandMarks.js";
import { fixHangingPrepositions } from "../../utils/hangingPrepositions.js";
import { fetchMyProfile, updateMySettings } from "../../api/profiles.js";
import {
  PROFILE_DISPLAY_NAME_MAX,
  PROFILE_ROLE_VALUES,
  PROFILE_WORKPLACE_MAX,
  normalizeProfileSettings,
} from "../../api/profileSettings.js";
import { formatPortfolioGrade } from "../../api/portfolios.js";
import { DEFAULT_ONBOARDING_ROLE } from "../../api/onboarding.js";
import onboardingContent from "../../../content/onboarding.json";

/**
 * @typedef {{
 *   displayName: string;
 *   telegramUsername: string;
 *   role: string;
 *   workplace: string;
 * }} SettingsFormValues
 */

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
 * Профиль в `/settings`: имя, Telegram, профессия, место работы + read-only email/grade/дата.
 *
 * @param {{
 *   onBack?: () => void | Promise<void>;
 *   onGoFeed?: () => void | Promise<void>;
 *   onSaved?: () => void | Promise<void>;
 * }} [opts]
 */
export function createSettingsScreen(opts = {}) {
  let closing = false;
  let loading = false;
  let saving = false;
  let loadEpoch = 0;
  /** @type {SettingsFormValues | null} */
  let baseline = null;

  const root = document.createElement("section");
  root.className = "settings-screen";
  root.setAttribute("aria-labelledby", "settings-screen-title");
  root.hidden = true;

  const topbar = document.createElement("header");
  topbar.className = "settings-screen__topbar";

  const mark = document.createElement("button");
  mark.type = "button";
  mark.className = "settings-screen__mark";
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

  const form = document.createElement("form");
  form.className = "settings-screen__form";
  form.noValidate = true;
  form.hidden = true;

  /**
   * @param {{
   *   id: string;
   *   name: string;
   *   kind?: "text" | "select" | "readonly";
   *   autocomplete?: string;
   *   maxlength?: number;
   * }} cfg
   */
  function createField(cfg) {
    const field = document.createElement("div");
    field.className = "settings-screen__field";

    const label = document.createElement("label");
    label.className = "settings-screen__label";
    label.htmlFor = cfg.id;

    /** @type {HTMLInputElement | HTMLSelectElement | HTMLDivElement} */
    let control;
    if (cfg.kind === "readonly") {
      control = document.createElement("div");
      control.className = "settings-screen__readonly";
      control.id = cfg.id;
    } else if (cfg.kind === "select") {
      control = document.createElement("select");
      control.className = "settings-screen__select";
      control.id = cfg.id;
      control.name = cfg.name;
    } else {
      control = document.createElement("input");
      control.className = "settings-screen__control";
      control.type = "text";
      control.id = cfg.id;
      control.name = cfg.name;
      control.autocomplete = cfg.autocomplete ?? "off";
      if (typeof cfg.maxlength === "number") {
        control.maxLength = cfg.maxlength;
      }
    }

    const hint = document.createElement("p");
    hint.className = "settings-screen__hint";
    hint.hidden = true;

    const error = document.createElement("p");
    error.className = "settings-screen__error";
    error.id = `${cfg.id}-error`;
    error.hidden = true;

    field.append(label, control, hint, error);
    return { field, label, control, hint, error };
  }

  const displayNameField = createField({
    id: "settings-display-name",
    name: "display_name",
    autocomplete: "nickname",
    maxlength: PROFILE_DISPLAY_NAME_MAX,
  });
  const emailField = createField({
    id: "settings-email",
    name: "email",
    kind: "readonly",
  });
  const telegramField = createField({
    id: "settings-telegram",
    name: "telegram_username",
    autocomplete: "username",
    maxlength: 33,
  });
  const gradeField = createField({
    id: "settings-grade",
    name: "grade",
    kind: "readonly",
  });
  const roleField = createField({
    id: "settings-role",
    name: "role",
    kind: "select",
  });
  const workplaceField = createField({
    id: "settings-workplace",
    name: "workplace",
    autocomplete: "organization",
    maxlength: PROFILE_WORKPLACE_MAX,
  });
  const createdAtField = createField({
    id: "settings-created-at",
    name: "created_at",
    kind: "readonly",
  });

  const roleSelect = /** @type {HTMLSelectElement} */ (roleField.control);
  for (const option of getRoleOptions()) {
    const el = document.createElement("option");
    el.value = option.value;
    el.dataset.labelKey = option.labelKey;
    roleSelect.append(el);
  }

  const actions = document.createElement("div");
  actions.className = "settings-screen__actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "settings-screen__save";

  const status = document.createElement("p");
  status.className = "settings-screen__status";
  status.setAttribute("aria-live", "polite");

  actions.append(saveBtn, status);

  form.append(
    displayNameField.field,
    emailField.field,
    telegramField.field,
    gradeField.field,
    roleField.field,
    workplaceField.field,
    createdAtField.field,
    actions,
  );

  card.append(title, description, loadingBox, loadError, form);
  body.append(card);
  root.append(topbar, body);

  /**
   * @returns {SettingsFormValues}
   */
  function readValues() {
    const displayInput = /** @type {HTMLInputElement} */ (
      displayNameField.control
    );
    const telegramInput = /** @type {HTMLInputElement} */ (
      telegramField.control
    );
    const workplaceInput = /** @type {HTMLInputElement} */ (
      workplaceField.control
    );
    return {
      displayName: displayInput.value,
      telegramUsername: telegramInput.value,
      role: roleSelect.value,
      workplace: workplaceInput.value,
    };
  }

  /**
   * @returns {boolean}
   */
  function isDirty() {
    if (!baseline) return false;
    const current = readValues();
    const normalized = normalizeProfileSettings({
      display_name: current.displayName,
      telegram_username: current.telegramUsername,
      role: current.role,
      workplace: current.workplace,
    });
    if (!normalized.ok) return true;
    const base = normalizeProfileSettings({
      display_name: baseline.displayName,
      telegram_username: baseline.telegramUsername,
      role: baseline.role,
      workplace: baseline.workplace,
    });
    if (!base.ok) return true;
    return (
      normalized.patch.display_name !== base.patch.display_name ||
      normalized.patch.telegram_username !== base.patch.telegram_username ||
      normalized.patch.role !== base.patch.role ||
      normalized.patch.workplace !== base.patch.workplace
    );
  }

  /**
   * @param {string} message
   * @param {"idle" | "success" | "error"} [kind]
   */
  function setStatus(message, kind = "idle") {
    status.textContent = message;
    status.classList.toggle("settings-screen__status--success", kind === "success");
    status.classList.toggle("settings-screen__status--error", kind === "error");
  }

  /**
   * @param {{ field: HTMLElement; control: HTMLElement; error: HTMLElement }} field
   * @param {boolean} visible
   * @param {string} [message]
   */
  function setFieldInvalid(field, visible, message = "") {
    field.field.classList.toggle("settings-screen__field--invalid", visible);
    field.control.setAttribute("aria-invalid", visible ? "true" : "false");
    if (visible && message) {
      field.error.textContent = message;
      field.error.hidden = false;
      field.control.setAttribute("aria-describedby", field.error.id);
    } else {
      field.error.textContent = "";
      field.error.hidden = true;
      field.control.removeAttribute("aria-describedby");
    }
  }

  function clearFieldErrors() {
    setFieldInvalid(displayNameField, false);
    setFieldInvalid(telegramField, false);
    setFieldInvalid(roleField, false);
    setFieldInvalid(workplaceField, false);
  }

  function syncSaveEnabled() {
    saveBtn.disabled = loading || saving || !baseline || !isDirty();
  }

  /**
   * @param {string} code
   * @param {ReturnType<typeof getStrings>} t
   * @returns {string}
   */
  function errorMessageForCode(code, t) {
    switch (code) {
      case "display_name_required":
        return t.settingsDisplayNameRequired ?? "";
      case "display_name_too_long":
        return t.settingsDisplayNameTooLong ?? "";
      case "invalid_telegram_username":
        return t.settingsTelegramInvalid ?? "";
      case "invalid_role":
        return t.settingsRoleInvalid ?? "";
      case "workplace_too_long":
        return t.settingsWorkplaceTooLong ?? "";
      default:
        return t.settingsSaveFailed ?? "";
    }
  }

  /**
   * @param {string} code
   */
  function showValidationError(code) {
    const t = getStrings();
    clearFieldErrors();
    const message = errorMessageForCode(code, t);
    if (code.startsWith("display_name")) {
      setFieldInvalid(displayNameField, true, message);
    } else if (code.includes("telegram")) {
      setFieldInvalid(telegramField, true, message);
    } else if (code.includes("role")) {
      setFieldInvalid(roleField, true, message);
    } else if (code.includes("workplace")) {
      setFieldInvalid(workplaceField, true, message);
    }
    setStatus(message, "error");
  }

  function syncCopy() {
    const t = getStrings();
    title.textContent = t.settingsTitle ?? "";
    description.textContent = fixHangingPrepositions(t.settingsDescription ?? "");
    backBtn.textContent = t.settingsBack ?? "";
    backBtn.setAttribute("aria-label", t.settingsBackAria ?? t.settingsBack ?? "");
    mark.setAttribute("aria-label", t.homeMarkAria ?? t.homeTabFeed ?? "");

    displayNameField.label.textContent = t.settingsDisplayNameLabel ?? "";
    /** @type {HTMLInputElement} */ (displayNameField.control).placeholder =
      t.settingsDisplayNamePlaceholder ?? "";
    displayNameField.hint.hidden = true;

    emailField.label.textContent = t.settingsEmailLabel ?? "";
    emailField.hint.hidden = false;
    emailField.hint.textContent = fixHangingPrepositions(
      t.settingsEmailHint ?? "",
    );

    telegramField.label.textContent = t.settingsTelegramLabel ?? "";
    /** @type {HTMLInputElement} */ (telegramField.control).placeholder =
      t.settingsTelegramPlaceholder ?? "";
    telegramField.hint.hidden = false;
    telegramField.hint.textContent = fixHangingPrepositions(
      t.settingsTelegramHint ?? "",
    );

    gradeField.label.textContent = t.settingsGradeLabel ?? "";
    gradeField.hint.hidden = false;
    gradeField.hint.textContent = fixHangingPrepositions(
      t.settingsGradeHint ?? "",
    );

    roleField.label.textContent = t.settingsRoleLabel ?? "";
    roleField.hint.hidden = true;
    for (const option of roleSelect.options) {
      const key = option.dataset.labelKey;
      option.textContent = key && t[key] ? t[key] : option.value;
    }

    workplaceField.label.textContent = t.settingsWorkplaceLabel ?? "";
    /** @type {HTMLInputElement} */ (workplaceField.control).placeholder =
      t.settingsWorkplacePlaceholder ?? "";
    workplaceField.hint.hidden = false;
    workplaceField.hint.textContent = fixHangingPrepositions(
      t.settingsWorkplaceHint ?? "",
    );

    createdAtField.label.textContent = t.settingsCreatedAtLabel ?? "";
    createdAtField.hint.hidden = true;

    saveBtn.textContent = saving
      ? (t.settingsSaving ?? "")
      : (t.settingsSave ?? "");
    loadError.textContent = t.settingsLoadFailed ?? "";
  }

  /**
   * @param {import("../../api/profiles.js").Profile} profile
   */
  function fillForm(profile) {
    const t = getStrings();
    const locale = getLocale();
    const displayName = asText(profile.display_name);
    const telegramUsername = asText(profile.telegram_username);
    const workplace = asText(profile.workplace);
    let role = asText(profile.role) || DEFAULT_ONBOARDING_ROLE;
    if (!PROFILE_ROLE_VALUES.has(role)) role = DEFAULT_ONBOARDING_ROLE;

    /** @type {HTMLInputElement} */ (displayNameField.control).value =
      displayName;
    emailField.control.textContent =
      asText(profile.email) || (t.settingsEmailEmpty ?? "");
    /** @type {HTMLInputElement} */ (telegramField.control).value =
      telegramUsername ? `@${telegramUsername}` : "";
    gradeField.control.textContent = formatPortfolioGrade(profile.grade);
    roleSelect.value = role;
    /** @type {HTMLInputElement} */ (workplaceField.control).value = workplace;
    createdAtField.control.textContent =
      formatAccountCreatedAt(profile.created_at, locale) ||
      (t.settingsCreatedAtEmpty ?? "");

    baseline = {
      displayName,
      telegramUsername,
      role,
      workplace,
    };
    clearFieldErrors();
    setStatus("");
    syncSaveEnabled();
  }

  /**
   * @param {"loading" | "ready" | "error"} mode
   */
  function setViewMode(mode) {
    loading = mode === "loading";
    loadingBox.hidden = mode !== "loading";
    loadError.hidden = mode !== "error";
    form.hidden = mode !== "ready";
    syncSaveEnabled();
  }

  async function loadProfile() {
    const epoch = ++loadEpoch;
    setViewMode("loading");
    setStatus("");
    clearFieldErrors();
    const profile = await fetchMyProfile();
    if (epoch !== loadEpoch) return;
    if (!profile) {
      baseline = null;
      setViewMode("error");
      return;
    }
    fillForm(profile);
    setViewMode("ready");
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
    void loadProfile();
  }

  function close() {
    loadEpoch += 1;
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

  form.addEventListener("input", () => {
    if (saving) return;
    clearFieldErrors();
    if (status.classList.contains("settings-screen__status--success")) {
      setStatus("");
    }
    syncSaveEnabled();
  });

  form.addEventListener("change", () => {
    if (saving) return;
    syncSaveEnabled();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (saving || loading || !baseline || !isDirty()) return;

    const values = readValues();
    const normalized = normalizeProfileSettings({
      display_name: values.displayName,
      telegram_username: values.telegramUsername,
      role: values.role,
      workplace: values.workplace,
    });
    if (!normalized.ok) {
      showValidationError(normalized.error);
      syncSaveEnabled();
      return;
    }

    saving = true;
    syncCopy();
    syncSaveEnabled();
    setStatus("");

    void (async () => {
      const t = getStrings();
      try {
        const profile = await updateMySettings(normalized.patch);
        if (!profile) throw new Error("profile_update_failed");
        fillForm(profile);
        setStatus(t.settingsSaved ?? "", "success");
        await opts.onSaved?.();
      } catch (err) {
        const code =
          err instanceof Error && err.message ? err.message : "profile_update_failed";
        if (
          code === "display_name_required" ||
          code === "display_name_too_long" ||
          code === "invalid_telegram_username" ||
          code === "invalid_role" ||
          code === "workplace_too_long"
        ) {
          showValidationError(code);
        } else {
          setStatus(t.settingsSaveFailed ?? "", "error");
        }
      } finally {
        saving = false;
        syncCopy();
        syncSaveEnabled();
      }
    })();
  });

  backBtn.addEventListener("click", () => {
    void opts.onBack?.();
  });

  mark.addEventListener("click", () => {
    void (opts.onGoFeed ?? opts.onBack)?.();
  });

  return { root, open, close };
}
