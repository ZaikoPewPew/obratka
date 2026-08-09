/**
 * Email OTP на `/registration` (и экран `/registration/code`).
 * Выключено, пока нет стабильного custom SMTP (Unisender / аналог).
 * Включить → `true` + SMTP + шаблоны с `{{ .Token }}` в Dashboard.
 */
export const EMAIL_AUTH_ENABLED = false;
