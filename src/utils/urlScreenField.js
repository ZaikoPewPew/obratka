/**
 * Единый invalid-стейт url-screen поля: текст ошибки + aria + обводка.
 */

import {
  isFieldErrorVisible,
  setFieldErrorVisible,
} from "./fieldError.js";

const WRAP_INVALID = "url-screen__input-wrap--invalid";
const OTP_INVALID = "auth-code-screen__cells--invalid";

/**
 * @param {{
 *   wrap: HTMLElement;
 *   input: HTMLElement;
 *   error: HTMLElement;
 * }} field
 * @param {{ visible: boolean; message?: string }} state
 */
export function setUrlScreenFieldInvalid(field, state) {
  const visible = Boolean(state.visible);
  setFieldErrorVisible(field.error, visible, state.message);
  field.input.setAttribute("aria-invalid", visible ? "true" : "false");
  field.wrap.classList.toggle(WRAP_INVALID, visible);
}

/**
 * OTP-ячейки: текст ошибки + aria + обводка cells.
 * @param {{
 *   cells: HTMLElement;
 *   input: HTMLElement;
 *   error: HTMLElement;
 * }} field
 * @param {{ visible: boolean; message?: string }} state
 */
export function setUrlScreenOtpInvalid(field, state) {
  const visible = Boolean(state.visible);
  setFieldErrorVisible(field.error, visible, state.message);
  field.input.setAttribute("aria-invalid", visible ? "true" : "false");
  field.cells.classList.toggle(OTP_INVALID, visible);
}

export { isFieldErrorVisible };
